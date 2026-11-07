"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { updateTask } from "@/lib/actions";
import { todayInMorocco } from "@/lib/dates";
import type { Section, Status, Task } from "@/lib/types";

const ROW = 40;
const DAY = 86400000;
const toDay = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
const toIso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

interface Props {
  projectId: string;
  tasks: Task[];
  sections: Section[];
  statuses: Status[];
  dependencies: { task_id: string; depends_on_task_id: string }[];
  canEdit: boolean;
}

export function Timeline({ projectId, tasks: initial, sections, statuses, dependencies, canEdit }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const rtl = locale === "ar";
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [zoom, setZoom] = useState<"week" | "month">("week");
  const [drag, setDrag] = useState<{ id: string; x0: number; delta: number } | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => setTasks(initial), [initial]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const dayW = zoom === "week" ? 28 : 8;
  const today = toDay(todayInMorocco());
  const doneIds = useMemo(() => new Set(statuses.filter((s) => s.category === "done").map((s) => s.id)), [statuses]);

  // rows: scheduled tasks grouped by section, in section order then start date
  const scheduled = tasks.filter((x) => x.due_date);
  const unscheduled = tasks.filter((x) => !x.due_date);
  const order = new Map(sections.map((s, i) => [s.id, i]));
  const rows = [...scheduled].sort((a, b) =>
    (order.get(a.section_id ?? "") ?? 99) - (order.get(b.section_id ?? "") ?? 99) || toDay(a.start_date ?? a.due_date!) - toDay(b.start_date ?? b.due_date!),
  );
  const span = (x: Task) => {
    const end = toDay(x.due_date!);
    const s = x.start_date ? toDay(x.start_date) : end;
    return { s: Math.min(s, end), e: end };
  };

  const days = rows.flatMap((x) => [span(x).s, span(x).e]);
  const first = Math.min(today, ...days);
  const last = Math.max(today, ...days);
  const monday = (d: number) => d - ((new Date(d * DAY).getUTCDay() + 6) % 7);
  const from = monday(first - 7);
  const to = last + 21;
  const width = (to - from) * dayW;
  const x = (d: number) => (d - from) * dayW;

  // scroll so that today is visible on first render
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const offset = Math.max(0, x(today) - 120);
    el.scrollLeft = rtl ? -offset : offset;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const ticks: { day: number; label: string }[] = [];
  const fmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", zoom === "week" ? { day: "numeric", month: "short", timeZone: "UTC" } : { month: "long", year: "numeric", timeZone: "UTC" });
  for (let d = from; d < to; d++) {
    const date = new Date(d * DAY);
    if (zoom === "week" ? date.getUTCDay() === 1 : date.getUTCDate() === 1) ticks.push({ day: d, label: fmt.format(date) });
  }

  const rowIndex = new Map(rows.map((r, i) => [r.id, i]));
  const shift = (id: string) => (drag?.id === id ? drag.delta : 0);
  const arrows = dependencies
    .filter((d) => rowIndex.has(d.task_id) && rowIndex.has(d.depends_on_task_id))
    .map((d) => {
      const pre = rows[rowIndex.get(d.depends_on_task_id)!];
      const post = rows[rowIndex.get(d.task_id)!];
      const a = span(pre);
      const b = span(post);
      const x1 = x(a.e + 1 + shift(pre.id));
      const y1 = rowIndex.get(pre.id)! * ROW + ROW / 2;
      const x2 = x(b.s + shift(post.id));
      const y2 = rowIndex.get(post.id)! * ROW + ROW / 2;
      const late = b.s + shift(post.id) <= a.e + shift(pre.id);
      return { key: `${d.task_id}-${d.depends_on_task_id}`, x1, y1, x2, y2, late };
    });

  const onDown = (e: React.PointerEvent, task: Task) => {
    if (!canEdit) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: task.id, x0: e.clientX, delta: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x0) * (rtl ? -1 : 1);
    const delta = Math.round(dx / dayW);
    if (delta !== drag.delta) setDrag({ ...drag, delta });
  };
  const onUp = (task: Task) => {
    const d = drag;
    setDrag(null);
    if (!d || d.delta === 0) {
      router.push(`/p/${projectId}/timeline?task=${task.id}`, { scroll: false });
      return;
    }
    const sp = span(task);
    const patch = { start_date: task.start_date ? toIso(sp.s + d.delta) : null, due_date: toIso(sp.e + d.delta) };
    const before = tasks;
    setTasks((all) => all.map((x) => (x.id === task.id ? { ...x, ...patch } : x)));
    start(async () => {
      const res = await updateTask(task.id, patch, task.updated_at);
      if (res.ok) setToast({ kind: "ok", text: t("timeline.moved") });
      else {
        setTasks(before);
        setToast({ kind: "error", text: t(`errors.${res.error}`) });
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{t("timeline.dragHint")}</p>
        <div className="flex gap-1 rounded-lg bg-black/5 p-1 text-sm dark:bg-white/10" role="group" aria-label={t("timeline.zoom")}>
          {(["week", "month"] as const).map((z) => (
            <button key={z} type="button" aria-pressed={zoom === z} onClick={() => setZoom(z)} className={`rounded-md px-3 py-1 ${zoom === z ? "surface font-medium shadow-sm" : "text-muted"}`}>
              {t(`timeline.${z}`)}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="surface rounded-xl p-8 text-center text-muted">{t("timeline.empty")}</p>
      ) : (
        <div className="surface flex overflow-hidden rounded-xl">
          <ul className="w-56 shrink-0 border-e border-line" aria-hidden>
            <li className="h-8 border-b border-line" />
            {rows.map((r) => (
              <li key={r.id} style={{ height: ROW }} className="flex items-center truncate px-3 text-sm">
                <Link href={`/p/${projectId}/timeline?task=${r.id}`} scroll={false} className="truncate hover:underline">{r.title}</Link>
              </li>
            ))}
          </ul>
          <div ref={scroller} className="overflow-x-auto">
            <div style={{ width }} className="relative">
              <div className="relative h-8 border-b border-line text-[0.7rem] text-muted">
                {ticks.map((tk) => (
                  <span key={tk.day} style={{ insetInlineStart: x(tk.day) }} className="absolute top-0 flex h-full items-center whitespace-nowrap border-s border-line ps-1">{tk.label}</span>
                ))}
              </div>
              <div className="relative" style={{ height: rows.length * ROW }}>
                {ticks.map((tk) => <span key={tk.day} aria-hidden style={{ insetInlineStart: x(tk.day) }} className="absolute inset-y-0 border-s border-black/5 dark:border-white/5" />)}
                <span aria-hidden title={t("timeline.today")} style={{ insetInlineStart: x(today) + dayW / 2 }} className="absolute inset-y-0 z-10 border-s-2 border-rose-500" />
                <svg aria-hidden width={width} height={rows.length * ROW} className="pointer-events-none absolute inset-0 z-10" style={rtl ? { transform: "scaleX(-1)" } : undefined}>
                  <defs>
                    <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--muted)" /></marker>
                    <marker id="arr-late" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#e11d48" /></marker>
                  </defs>
                  {arrows.map((a) => {
                    const mid = a.x1 + 8;
                    return (
                      <path
                        key={a.key}
                        d={`M${a.x1},${a.y1} H${mid} V${a.y2} H${a.x2 - 2}`}
                        fill="none"
                        stroke={a.late ? "#e11d48" : "var(--muted)"}
                        strokeWidth={a.late ? 2 : 1.5}
                        markerEnd={`url(#${a.late ? "arr-late" : "arr"})`}
                      />
                    );
                  })}
                </svg>
                {rows.map((r, i) => {
                  const sp = span(r);
                  const d = shift(r.id);
                  const done = doneIds.has(r.status_id);
                  const overdue = !done && sp.e < today;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      data-task-id={r.id}
                      aria-label={`${r.title}: ${r.start_date ?? r.due_date} → ${r.due_date}`}
                      onPointerDown={(e) => onDown(e, r)}
                      onPointerMove={onMove}
                      onPointerUp={() => onUp(r)}
                      style={{ top: i * ROW + 8, height: ROW - 16, insetInlineStart: x(sp.s + d), width: Math.max(dayW, (sp.e - sp.s + 1) * dayW) }}
                      className={`absolute z-20 touch-none truncate rounded-[4px] px-2 text-start text-xs text-white shadow-sm ${canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${done ? "bg-brand-500/60" : overdue ? "bg-rose-500" : "bg-brand-600"} ${drag?.id === r.id ? "ring-2 ring-brand-500 ring-offset-1" : ""}`}
                    >
                      {zoom === "week" ? r.title : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <section className="surface space-y-2 rounded-xl p-4">
          <h2 className="text-sm font-semibold">{t("timeline.unscheduled")} <span className="font-normal text-muted">({unscheduled.length})</span></h2>
          <p className="text-xs text-muted">{t("timeline.unscheduledHint")}</p>
          <ul className="flex flex-wrap gap-2">
            {unscheduled.map((u) => (
              <li key={u.id}><Link href={`/p/${projectId}/timeline?task=${u.id}`} scroll={false} className="block rounded-md border border-dashed border-line px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10">{u.title}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {toast && (
        <div role={toast.kind === "error" ? "alert" : "status"} className={`fixed bottom-4 start-1/2 z-40 -translate-x-1/2 rounded-lg px-4 py-2 text-sm text-white shadow-lg rtl:translate-x-1/2 ${toast.kind === "error" ? "bg-rose-600" : "bg-brand-600"}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
