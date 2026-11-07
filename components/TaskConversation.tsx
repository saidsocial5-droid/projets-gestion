"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addComment, deleteComment } from "@/lib/actions";
import { statusName } from "@/lib/status";
import type { ActivityRow, CommentRow } from "@/lib/task-detail";
import type { Person, Status } from "@/lib/types";

interface Props {
  taskId: string;
  comments: CommentRow[];
  activities: ActivityRow[];
  people: Person[];
  statuses: Status[];
  userId: string;
  canComment: boolean;
  canAdmin: boolean;
}

type Item = { kind: "comment"; at: string; c: CommentRow } | { kind: "activity"; at: string; a: ActivityRow };

export function TaskConversation({ taskId, comments, activities, people, statuses, userId, canComment, canAdmin }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const nameOf = useMemo(() => {
    const m = new Map(people.map((p) => [p.id, p.full_name]));
    return (id: string | null) => (id && m.get(id)) || t("activity.someone");
  }, [people, t]);
  const statusOf = useMemo(() => new Map(statuses.map((s) => [s.id, statusName(s, locale)])), [statuses, locale]);
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(iso));

  const items: Item[] = [
    ...comments.map((c) => ({ kind: "comment" as const, at: c.created_at, c })),
    ...activities.map((a) => ({ kind: "activity" as const, at: a.created_at, a })),
  ].sort((x, y) => (x.at < y.at ? -1 : 1));

  const describe = (a: ActivityRow) => {
    switch (a.action) {
      case "task.status_changed":
        return t("activity.task.status_changed", { to: statusOf.get(a.payload.to ?? "") ?? "?" });
      case "task.assigned":
        return a.payload.to ? t("activity.task.assigned", { to: `\u2068${nameOf(a.payload.to)}\u2069` }) : t("activity.task.unassigned");
      case "attachment.added":
        return t("activity.attachment.added", { file: `\u2068${a.payload.file_name ?? ""}\u2069` });
      default:
        return t.has(`activity.${a.action}`) ? t(`activity.${a.action}`) : a.action;
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">{t("task.comments")}</h3>
      <ol className="space-y-3">
        {items.map((it) =>
          it.kind === "activity" ? (
            <li key={it.a.id} className="text-xs text-muted">
              <bdi className="font-medium">{nameOf(it.a.actor_id)}</bdi> · <bdi>{describe(it.a)}</bdi> · <time dateTime={it.a.created_at}><bdi>{when(it.a.created_at)}</bdi></time>
            </li>
          ) : (
            <li key={it.c.id} className="rounded-lg bg-black/[0.03] p-3 text-sm dark:bg-white/[0.04]">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
                <span><bdi className="font-medium text-[var(--text)]">{nameOf(it.c.author_id)}</bdi> · <time dateTime={it.c.created_at}><bdi>{when(it.c.created_at)}</bdi></time></span>
                {(it.c.author_id === userId || canAdmin) && <DeleteComment id={it.c.id} label={t("task.deleteComment")} />}
              </div>
              <p className="whitespace-pre-wrap break-words">{highlight(it.c.body.text ?? "", it.c.body.mentions ?? [], nameOf)}</p>
            </li>
          ),
        )}
      </ol>
      {comments.length === 0 && <p className="text-xs text-muted">{t("task.noComments")}</p>}
      {canComment && <CommentBox taskId={taskId} people={people} />}
    </section>
  );
}

function highlight(text: string, mentions: string[], nameOf: (id: string) => string) {
  const names = mentions.map(nameOf).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return text;
  const re = new RegExp(`(@(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="rounded bg-brand-100 px-0.5 text-brand-900"><bdi>{part}</bdi></mark> : part));
}

function DeleteComment({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="hover:text-rose-600" onClick={() => start(async () => { await deleteComment(id); })}>
      {label}
    </button>
  );
}

/** Textarea with "@name" suggestions. Mentions are kept as user ids; a mention is dropped if its "@name" is edited away. */
function CommentBox({ taskId, people }: { taskId: string; people: Person[] }) {
  const t = useTranslations();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Person[]>([]);
  const [query, setQuery] = useState<{ start: number; q: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onChange = (value: string, caret: number) => {
    setText(value);
    const before = value.slice(0, caret);
    const m = before.match(/(^|\s)@([^\s@]*)$/);
    setQuery(m ? { start: caret - m[2].length - 1, q: m[2].toLowerCase() } : null);
  };
  const suggestions = query ? people.filter((p) => p.full_name.toLowerCase().includes(query.q)).slice(0, 6) : [];

  const pick = (p: Person) => {
    if (!query) return;
    const caret = ref.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, query.start)}@${p.full_name} ${text.slice(caret)}`;
    setText(next);
    setPicked((list) => (list.some((x) => x.id === p.id) ? list : [...list, p]));
    setQuery(null);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const submit = () =>
    start(async () => {
      const mentions = picked.filter((p) => text.includes(`@${p.full_name}`)).map((p) => p.id);
      const res = await addComment(taskId, text, mentions);
      if (res.ok) {
        setText("");
        setPicked([]);
        setError(null);
      } else setError(t(`errors.${res.error}`));
    });

  return (
    <div className="relative space-y-2">
      <textarea
        ref={ref}
        rows={3}
        value={text}
        placeholder={t("task.commentPlaceholder")}
        aria-label={t("task.commentPlaceholder")}
        className="input"
        disabled={pending}
        onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
        onKeyDown={(e) => {
          if (suggestions.length && (e.key === "Enter" || e.key === "Tab")) {
            e.preventDefault();
            pick(suggestions[0]);
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") setQuery(null);
        }}
      />
      {suggestions.length > 0 && (
        <ul role="listbox" className="surface absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md shadow-lg">
          {suggestions.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button type="button" className="w-full px-3 py-2 text-start text-sm hover:bg-black/5 dark:hover:bg-white/10" onMouseDown={(e) => { e.preventDefault(); pick(p); }}>
                @{p.full_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end">
        <button type="button" className="btn-primary" disabled={pending || !text.trim()} onClick={submit}>{t("task.send")}</button>
      </div>
    </div>
  );
}
