"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { moveStatus, removeStatus, saveStatus, saveTransitions } from "@/lib/actions";
import { statusName } from "@/lib/status";
import { StatusBadge } from "./StatusBadge";
import type { Status, Transition } from "@/lib/types";

const COLORS = ["gray", "blue", "amber", "green", "red"] as const;
const CATEGORIES = ["todo", "in_progress", "done"] as const;

function StatusForm({ workflowId, status }: { workflowId: string; status?: Status }) {
  const t = useTranslations("workflow");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(saveStatus.bind(null, workflowId, status?.id ?? null), { status: "idle" } as { status: "idle" | "ok" | "error" });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok" && !status) ref.current?.reset();
  }, [state, status]);
  return (
    <form ref={ref} action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_8rem_auto] sm:items-end">
      <label className="space-y-1"><span className="text-xs font-medium">{t("nameAr")}</span><input name="name_ar" dir="rtl" required defaultValue={status?.name_ar} className="input" /></label>
      <label className="space-y-1"><span className="text-xs font-medium">{t("nameFr")}</span><input name="name_fr" dir="ltr" required defaultValue={status?.name_fr} className="input" /></label>
      <label className="space-y-1">
        <span className="text-xs font-medium">{t("color")}</span>
        <select name="color" defaultValue={status?.color ?? "gray"} className="input">{COLORS.map((c) => <option key={c} value={c}>{t(`color_${c}`)}</option>)}</select>
      </label>
      <label className="space-y-1">
        <span className="text-xs font-medium">{t("category")}</span>
        <select name="category" defaultValue={status?.category ?? "in_progress"} className="input">{CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat_${c}`)}</option>)}</select>
      </label>
      <button className="btn-primary" disabled={pending}>{status ? t("save") : t("add")}</button>
      {state.status === "error" && <p role="alert" className="text-xs text-rose-600 sm:col-span-5">{te("generic")}</p>}
    </form>
  );
}

function StatusRow({ workflowId, status, others, first, last }: { workflowId: string; status: Status; others: Status[]; first: boolean; last: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : t(`errors.${r.error ?? "generic"}`));
    });
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <StatusBadge name={statusName(status, locale)} color={status.color} />
          <span className="text-xs text-muted">{t(`workflow.cat_${status.category}`)}</span>
        </span>
        <span className="flex items-center gap-1">
          <button type="button" className="btn-ghost px-2 py-1" disabled={pending || first} aria-label={t("workflow.up")} onClick={() => run(() => moveStatus(workflowId, status.id, -1))}>↑</button>
          <button type="button" className="btn-ghost px-2 py-1" disabled={pending || last} aria-label={t("workflow.down")} onClick={() => run(() => moveStatus(workflowId, status.id, 1))}>↓</button>
        </span>
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-muted">{t("workflow.save")} / {t("workflow.delete")}</summary>
        <div className="mt-2 space-y-3">
          <StatusForm workflowId={workflowId} status={status} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              {t("workflow.moveTo")}
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="input w-auto py-1">
                {others.map((o) => <option key={o.id} value={o.id}>{statusName(o, locale)}</option>)}
              </select>
            </label>
            <button type="button" className="btn-ghost text-rose-600" disabled={pending || !moveTo} onClick={() => run(() => removeStatus(status.id, moveTo))}>{t("workflow.confirmDelete")}</button>
          </div>
        </div>
      </details>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    </li>
  );
}

function TransitionMatrix({ workflowId, statuses, transitions, restrict }: { workflowId: string; statuses: Status[]; transitions: Transition[]; restrict: boolean }) {
  const t = useTranslations("workflow");
  const te = useTranslations("errors");
  const locale = useLocale();
  const key = (from: string | null, to: string) => `${from ?? "*"}>${to}`;
  const [on, setOn] = useState(new Set(transitions.map((x) => key(x.from_status_id, x.to_status_id))));
  const [limited, setLimited] = useState(restrict);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (k: string) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const rows: (Status | null)[] = [null, ...statuses];

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={limited} onChange={(e) => setLimited(e.target.checked)} className="accent-[var(--color-brand-600)]" />
        {t("restrict")}
      </label>
      {limited && (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="p-2 text-start text-xs font-medium text-muted">{t("from")}</th>
                {statuses.map((s) => <th key={s.id} className="p-2 text-xs font-medium">{statusName(s, locale)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((from) => (
                <tr key={from?.id ?? "any"} className="border-t border-line">
                  <th className="p-2 text-start text-xs font-medium">{from ? statusName(from, locale) : <em>{t("any")}</em>}</th>
                  {statuses.map((to) => (
                    <td key={to.id} className="p-2 text-center">
                      {from?.id === to.id ? <span className="text-muted">—</span> : (
                        <input
                          type="checkbox"
                          aria-label={`${from ? statusName(from, locale) : t("any")} → ${statusName(to, locale)}`}
                          checked={on.has(key(from?.id ?? null, to.id))}
                          onChange={() => toggle(key(from?.id ?? null, to.id))}
                          className="accent-[var(--color-brand-600)]"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const pairs = [...on].map((k) => { const [f, to] = k.split(">"); return { from: f === "*" ? null : f, to }; });
              const r = await saveTransitions(workflowId, limited, pairs);
              setMsg(r.ok ? t("saved") : te("generic"));
            })
          }
        >
          {t("saveTransitions")}
        </button>
        {msg && <span role="status" className="text-sm text-brand-600">{msg}</span>}
      </div>
    </div>
  );
}

export function WorkflowEditor({ workflowId, statuses, transitions, restrict }: { workflowId: string; statuses: Status[]; transitions: Transition[]; restrict: boolean }) {
  const t = useTranslations("workflow");
  return (
    <div className="space-y-6">
      <section className="surface space-y-2 rounded-xl p-4">
        <h2 className="font-semibold">{t("statuses")}</h2>
        <ul className="divide-y divide-[var(--border)]">
          {statuses.map((s, i) => (
            <StatusRow key={s.id} workflowId={workflowId} status={s} others={statuses.filter((o) => o.id !== s.id)} first={i === 0} last={i === statuses.length - 1} />
          ))}
        </ul>
        <div className="rounded-lg border border-dashed border-line p-3"><StatusForm workflowId={workflowId} /></div>
      </section>
      <section className="surface space-y-2 rounded-xl p-4">
        <h2 className="font-semibold">{t("transitions")}</h2>
        <TransitionMatrix key={statuses.map((s) => s.id).join()} workflowId={workflowId} statuses={statuses} transitions={transitions} restrict={restrict} />
      </section>
    </div>
  );
}
