"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Link } from "@/i18n/navigation";
import { createTask, moveTask } from "@/lib/actions";
import { allowedTargets, statusName } from "@/lib/status";
import { formatDate, isOverdue } from "@/lib/dates";
import { StatusBadge } from "./StatusBadge";
import type { Person, Status, Task, Transition } from "@/lib/types";

interface Props {
  projectId: string;
  statuses: Status[];
  transitions: Transition[];
  restrict: boolean;
  tasks: Task[];
  people: Person[];
  canEdit: boolean;
  defaultSectionId: string | null;
}

export function Board({ projectId, statuses, transitions, restrict, tasks: initial, people, canEdit, defaultSectionId }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [tasks, setTasks] = useState(initial);
  const [dragging, setDragging] = useState<Task | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, start] = useTransition();

  useEffect(() => setTasks(initial), [initial]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const columns = useMemo(
    () =>
      statuses.map((s) => ({
        status: s,
        tasks: tasks.filter((x) => x.status_id === s.id).sort((a, b) => (a.board_rank < b.board_rank ? -1 : a.board_rank > b.board_rank ? 1 : 0)),
      })),
    [statuses, tasks],
  );
  const allowed = dragging ? allowedTargets(dragging.status_id, restrict, statuses, transitions) : null;

  const onDragStart = (e: DragStartEvent) => setDragging(tasks.find((x) => x.id === e.active.id) ?? null);

  const onDragEnd = (e: DragEndEvent) => {
    const task = dragging;
    setDragging(null);
    const to = e.over?.id as string | undefined;
    if (!task || !to || to === task.status_id) return;

    const column = columns.find((c) => c.status.id === to)!;
    const last = column.tasks.at(-1)?.board_rank ?? null;
    const before = tasks;
    // optimistic: show the card in its new column right away; the server (database trigger) has the last word
    setTasks((all) => all.map((x) => (x.id === task.id ? { ...x, status_id: to, board_rank: (last ?? "") + "~" } : x)));
    start(async () => {
      const res = await moveTask(task.id, to, last, null);
      if (!res.ok) {
        setTasks(before);
        setToast(t(`errors.${res.error}`));
      }
    });
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto pb-4">
        {columns.map(({ status, tasks: colTasks }) => (
          <Column
            key={status.id}
            status={status}
            label={statusName(status, locale)}
            count={colTasks.length}
            state={!allowed ? "idle" : status.id === dragging?.status_id ? "origin" : allowed.has(status.id) ? "allowed" : "denied"}
          >
            {colTasks.map((task) => (
              <Card key={task.id} task={task} projectId={projectId} canDrag={canEdit}>
                <p className={`text-sm ${task.completed_at ? "text-muted line-through" : ""}`}>{task.title}</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                  <span className="truncate">{task.assignee_id ? personById.get(task.assignee_id)?.full_name : ""}</span>
                  {task.due_date && (
                    <span className={isOverdue(task.due_date, task.completed_at) ? "font-medium text-rose-600" : ""}>{formatDate(task.due_date, locale)}</span>
                  )}
                </div>
              </Card>
            ))}
            {colTasks.length === 0 && <p className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">{t("project.emptyColumn")}</p>}
            {canEdit && status.rank === statuses[0]?.rank && (
              <QuickAdd placeholder={t("project.addTask")} onAdd={(title) => createTask(projectId, defaultSectionId, title)} />
            )}
          </Column>
        ))}
      </div>
      {toast && (
        <div role="alert" className="fixed bottom-4 start-1/2 z-40 -translate-x-1/2 rounded-lg bg-rose-600 px-4 py-2 text-sm text-white shadow-lg rtl:translate-x-1/2">
          {toast}
        </div>
      )}
    </DndContext>
  );
}

function Column({ status, label, count, state, children }: { status: Status; label: string; count: number; state: "idle" | "origin" | "allowed" | "denied"; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const ring =
    state === "allowed" ? (isOver ? "ring-2 ring-brand-500" : "ring-1 ring-brand-500/40")
    : state === "denied" ? (isOver ? "ring-2 ring-rose-500 opacity-60" : "opacity-50")
    : "";
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      data-status-category={status.category}
      className={`flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-black/[0.04] p-3 transition dark:bg-white/[0.04] ${ring}`}
    >
      <header className="flex items-center justify-between">
        <StatusBadge name={label} color={status.color} />
        <span className="text-xs text-muted">{count}</span>
      </header>
      {children}
    </section>
  );
}

function Card({ task, projectId, canDrag, children }: { task: Task; projectId: string; canDrag: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: !canDrag });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} data-task-id={task.id} className={`surface rounded-lg shadow-sm ${isDragging ? "z-10 shadow-lg" : ""}`}>
      <Link href={`/p/${projectId}/board?task=${task.id}`} scroll={false} className="block p-3">
        {children}
      </Link>
    </div>
  );
}

function QuickAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => Promise<{ ok: boolean }> }) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        start(async () => {
          const res = await onAdd(value);
          if (res.ok) setValue("");
        });
      }}
    >
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} disabled={pending} className="input" />
    </form>
  );
}
