"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createTask, toggleSubtask } from "@/lib/actions";
import { AddRow } from "./AddRow";
import type { Task } from "@/lib/types";

export function TaskSubtasks({ parent, subtasks, canEdit }: { parent: Task; subtasks: Task[]; canEdit: boolean }) {
  const t = useTranslations("task");
  const [pending, start] = useTransition();
  // show the tick immediately; the server result replaces it after revalidation
  const [items, setDone] = useOptimistic(subtasks, (list, { id, done }: { id: string; done: boolean }) =>
    list.map((s) => (s.id === id ? { ...s, completed_at: done ? new Date().toISOString() : null } : s)),
  );
  const done = items.filter((s) => s.completed_at).length;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center justify-between text-sm font-semibold">
        <span>{t("subtasks")}</span>
        {items.length > 0 && <span className="text-xs font-normal text-muted">{done}/{items.length}</span>}
      </h3>
      <ul className="space-y-1">
        {items.map((s) => (
          <li key={s.id}>
            <label className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <input
                type="checkbox"
                checked={!!s.completed_at}
                disabled={!canEdit || pending}
                onChange={(e) => {
                  const checked = e.target.checked;
                  start(async () => {
                    setDone({ id: s.id, done: checked });
                    await toggleSubtask(s.id, checked);
                  });
                }}
                className="h-4 w-4 accent-[var(--color-brand-600)]"
              />
              <span className={s.completed_at ? "text-muted line-through" : ""}>{s.title}</span>
            </label>
          </li>
        ))}
      </ul>
      {canEdit && (
        <AddRow
          className="rounded-md border border-dashed border-line"
          placeholder={t("addSubtask")}
          onAdd={(title) => createTask(parent.project_id, null, title, parent.id)}
        />
      )}
    </section>
  );
}
