"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { setFieldValue } from "@/lib/actions";
import type { CustomField, FieldValue } from "@/lib/types";

/** One input per custom field; each saves on its own when it changes. */
export function TaskFields({ taskId, fields, values, canEdit }: { taskId: string; fields: CustomField[]; values: Record<string, FieldValue>; canEdit: boolean }) {
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!fields.length) return null;
  const save = (fieldId: string, value: string | number | string[] | null) =>
    start(async () => {
      const r = await setFieldValue(taskId, fieldId, value);
      setError(r.ok ? null : t(`errors.${r.error}`));
    });

  return (
    <section className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => {
          const v = values[f.id];
          const id = `field-${f.id}`;
          return (
            <div key={f.id} className={`space-y-1 ${f.type === "multi_select" || f.type === "text" ? "col-span-2" : ""}`}>
              <label htmlFor={id} className="text-sm font-medium">{f.name}</label>
              {f.type === "single_select" && (
                <select id={id} disabled={!canEdit || pending} defaultValue={(v as string) ?? ""} className="input" onChange={(e) => save(f.id, e.target.value || null)}>
                  <option value="">{t("fields.none")}</option>
                  {f.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              )}
              {f.type === "multi_select" && (
                <div id={id} role="group" aria-label={f.name} className="flex flex-wrap gap-1">
                  {f.options.map((o) => {
                    const list = Array.isArray(v) ? v : [];
                    const on = list.includes(o.id);
                    return (
                      <label key={o.id} className="flex cursor-pointer items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-900/40">
                        <input type="checkbox" className="sr-only" disabled={!canEdit || pending} defaultChecked={on} onChange={(e) => save(f.id, e.target.checked ? [...list, o.id] : list.filter((x) => x !== o.id))} />
                        {o.label}
                      </label>
                    );
                  })}
                </div>
              )}
              {f.type === "text" && (
                <input id={id} disabled={!canEdit || pending} defaultValue={(v as string) ?? ""} maxLength={2000} className="input" onBlur={(e) => e.target.value !== (v ?? "") && save(f.id, e.target.value.trim() || null)} />
              )}
              {f.type === "number" && (
                <input id={id} type="number" step="any" dir="ltr" disabled={!canEdit || pending} defaultValue={v === undefined ? "" : String(v)} className="input" onBlur={(e) => e.target.value !== (v === undefined ? "" : String(v)) && save(f.id, e.target.value === "" ? null : Number(e.target.value))} />
              )}
              {f.type === "date" && (
                <input id={id} type="date" disabled={!canEdit || pending} defaultValue={(v as string) ?? ""} className="input" onChange={(e) => save(f.id, e.target.value || null)} />
              )}
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    </section>
  );
}
