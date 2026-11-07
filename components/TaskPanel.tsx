"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { deleteTask, updateTask } from "@/lib/actions";
import { statusName } from "@/lib/status";
import type { Person, Priority, Status, Task } from "@/lib/types";

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

interface Props {
  task: Task;
  statuses: Status[];
  allowed: string[];
  people: Person[];
  canEdit: boolean;
}

export function TaskPanel({ task, statuses, allowed, people, canEdit }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const path = usePathname();
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const save = (form: FormData) =>
    start(async () => {
      setMsg(null);
      const res = await updateTask(
        task.id,
        {
          title: String(form.get("title") ?? ""),
          status_id: String(form.get("status_id")),
          assignee_id: String(form.get("assignee_id") ?? "") || null,
          due_date: String(form.get("due_date") ?? "") || null,
          priority: (String(form.get("priority") ?? "") || null) as Priority | null,
          description: String(form.get("description") ?? ""),
        },
        task.updated_at,
      );
      setMsg(res.ok ? { kind: "ok", text: t("task.saved") } : { kind: "error", text: t(`errors.${res.error}`) });
    });

  const remove = () => {
    if (!confirm(t("task.confirmDelete"))) return;
    start(async () => {
      const res = await deleteTask(task.id);
      if (res.ok) router.push(path);
      else setMsg({ kind: "error", text: t(`errors.${res.error}`) });
    });
  };

  return (
    <aside
      aria-label={task.title}
      className="surface fixed inset-y-0 end-0 z-30 w-full max-w-md overflow-y-auto border-y-0 border-e-0 p-5 shadow-xl"
    >
      <div className="mb-4 flex items-center justify-between">
        {task.completed_at ? <span className="text-sm text-brand-600">✓ {t("task.done")}</span> : <span />}
        <Link href={path} className="btn-ghost" aria-label={t("task.close")}>✕</Link>
      </div>
      {/* key: reset the form when the server sends a newer version */}
      <form key={task.updated_at} action={save} className="space-y-4">
        <fieldset disabled={!canEdit || pending} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("task.title")}</span>
            <input name="title" defaultValue={task.title} required maxLength={500} className="input text-base font-medium" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">{t("task.status")}</span>
              <select name="status_id" defaultValue={task.status_id} className="input">
                {statuses.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id !== task.status_id && !allowed.includes(s.id)}>
                    {statusName(s, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">{t("task.assignee")}</span>
              <select name="assignee_id" defaultValue={task.assignee_id ?? ""} className="input">
                <option value="">{t("task.unassigned")}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">{t("task.dueDate")}</span>
              <input name="due_date" type="date" defaultValue={task.due_date ?? ""} className="input" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">{t("task.priority")}</span>
              <select name="priority" defaultValue={task.priority ?? ""} className="input">
                <option value="">{t("task.priorityNone")}</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{t(`task.priority_${p}`)}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("task.description")}</span>
            <textarea name="description" rows={6} defaultValue={task.description?.text ?? ""} className="input" />
          </label>
        </fieldset>
        {msg && <p role={msg.kind === "error" ? "alert" : "status"} className={`text-sm ${msg.kind === "error" ? "text-rose-600" : "text-brand-600"}`}>{msg.text}</p>}
        {canEdit && (
          <div className="flex justify-between">
            <button className="btn-primary" disabled={pending}>{t("task.save")}</button>
            <button type="button" onClick={remove} className="btn-ghost text-rose-600" disabled={pending}>{t("task.delete")}</button>
          </div>
        )}
      </form>
    </aside>
  );
}
