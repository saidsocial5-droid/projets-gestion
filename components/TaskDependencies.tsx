"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addDependency, removeDependency } from "@/lib/actions";
import type { Task } from "@/lib/types";

interface Props {
  task: Task;
  predecessors: Task[];
  successors: Task[];
  candidates: Task[];
  canEdit: boolean;
}

export function TaskDependencies({ task, predecessors, successors, candidates, canEdit }: Props) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : t(`errors.${r.error ?? "generic"}`));
    });

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{t("deps.title")}</h3>
      {predecessors.length === 0 && <p className="text-xs text-muted">{t("deps.none")}</p>}
      <ul className="space-y-1">
        {predecessors.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-line px-2 py-1 text-sm">
            <span className={p.completed_at ? "text-muted line-through" : ""}>{p.completed_at ? "✓ " : "⏳ "}{p.title}</span>
            {canEdit && (
              <button type="button" disabled={pending} aria-label={`${t("deps.remove")}: ${p.title}`} className="text-xs text-muted hover:text-rose-600" onClick={() => run(() => removeDependency(task.id, p.id))}>✕</button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && candidates.length > 0 && (
        <select
          aria-label={t("deps.add")}
          value=""
          disabled={pending}
          className="input"
          onChange={(e) => e.target.value && run(() => addDependency(task.id, e.target.value))}
        >
          <option value="">{t("deps.add")}</option>
          {candidates.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      )}
      {successors.length > 0 && (
        <p className="text-xs text-muted">{t("deps.blocking")}: {successors.map((s) => s.title).join("، ")}</p>
      )}
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    </section>
  );
}
