"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { addFieldOption, createField, deleteField, deleteFieldOption, setProjectField } from "@/lib/actions";
import { AddRow } from "./AddRow";
import type { CustomField } from "@/lib/types";

const TYPES = ["text", "number", "single_select", "multi_select", "date"] as const;

export function NewFieldForm() {
  const t = useTranslations("fields");
  const te = useTranslations("errors");
  const [type, setType] = useState<string>("single_select");
  const [state, action, pending] = useActionState(createField, { status: "idle" } as { status: "idle" | "ok" | "error"; message?: string });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-2 sm:grid-cols-[1fr_11rem] sm:items-end">
      <label className="space-y-1"><span className="text-xs font-medium">{t("name")}</span><input name="name" required maxLength={100} className="input" /></label>
      <label className="space-y-1">
        <span className="text-xs font-medium">{t("type")}</span>
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">{TYPES.map((x) => <option key={x} value={x}>{t(`type_${x}`)}</option>)}</select>
      </label>
      {type.endsWith("select") && (
        <label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium">{t("options")}</span><input name="options" className="input" /></label>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{t("create")}</button>
        {state.status === "error" && <span role="alert" className="text-sm text-rose-600">{state.message === "options_required" ? t("optionsRequired") : te("generic")}</span>}
      </div>
    </form>
  );
}

export function FieldCard({ field }: { field: CustomField }) {
  const t = useTranslations("fields");
  const [pending, start] = useTransition();
  return (
    <li className="surface space-y-2 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span><span className="font-medium">{field.name}</span> <span className="text-xs text-muted">· {t(`type_${field.type}`)}</span></span>
        <button type="button" disabled={pending} className="btn-ghost text-xs text-rose-600" onClick={() => confirm(t("confirmDelete")) && start(async () => { await deleteField(field.id); })}>{t("delete")}</button>
      </div>
      {field.type.endsWith("select") && (
        <>
          <ul className="flex flex-wrap gap-1">
            {field.options.map((o) => (
              <li key={o.id} className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                {o.label}
                <button type="button" aria-label={`× ${o.label}`} disabled={pending} className="text-muted hover:text-rose-600" onClick={() => start(async () => { await deleteFieldOption(o.id); })}>×</button>
              </li>
            ))}
          </ul>
          <AddRow className="rounded-md border border-dashed border-line" placeholder={t("addOption")} onAdd={addFieldOption.bind(null, field.id)} />
        </>
      )}
    </li>
  );
}

export function ProjectFieldsPicker({ projectId, fields, attached }: { projectId: string; fields: CustomField[]; attached: string[] }) {
  const t = useTranslations("fields");
  const [pending, start] = useTransition();
  if (!fields.length) return <p className="text-sm text-muted">{t("empty")}</p>;
  return (
    <ul className="space-y-1">
      {fields.map((f) => (
        <li key={f.id}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked={attached.includes(f.id)}
              disabled={pending}
              onChange={(e) => { const on = e.target.checked; start(async () => { await setProjectField(projectId, f.id, on); }); }}
              className="accent-[var(--color-brand-600)]"
            />
            {f.name} <span className="text-xs text-muted">· {t(`type_${f.type}`)}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
