"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteStatusUpdate, publishStatusUpdate, saveStatusUpdate } from "@/lib/actions";
import { HEALTHS } from "./HealthBadge";

export function StatusUpdateForm({ projectId, current }: { projectId: string; current: string | null }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveStatusUpdate.bind(null, projectId), { status: "idle" } as { status: "idle" | "ok" | "error"; at?: number });
  // close the form once an update is saved
  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state]);
  if (!open)
    return (
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={() => setOpen(true)}>+ {t("progress.new")}</button>
        {state.status === "ok" && <span role="status" className="text-sm text-brand-600">{t("progress.published")}</span>}
      </div>
    );
  return (
    <form action={action} className="surface space-y-3 rounded-xl p-4">
      <fieldset className="flex flex-wrap gap-2" aria-label={t("progress.status")}>
        <legend className="mb-1 text-sm font-medium">{t("progress.status")}</legend>
        {HEALTHS.map((h) => (
          <label key={h} className="flex cursor-pointer items-center gap-1 rounded-full border border-line px-3 py-1 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-900/40">
            <input type="radio" name="status" value={h} defaultChecked={h === (current ?? "on_track")} className="accent-[var(--color-brand-600)]" />
            {t(`health.${h}`)}
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t("progress.headline")}</span>
        <input name="title" required maxLength={200} className="input" />
      </label>
      <textarea name="body" rows={5} placeholder={t("progress.body")} aria-label={t("progress.body")} className="input" />
      <div className="flex flex-wrap items-center gap-2">
        <button name="intent" value="publish" className="btn-primary" disabled={pending}>{t("progress.publish")}</button>
        <button name="intent" value="draft" className="btn-ghost" disabled={pending}>{t("progress.draft")}</button>
        {state.status === "error" && <span role="alert" className="text-sm text-rose-600">{t("errors.generic")}</span>}
      </div>
    </form>
  );
}

export function DraftActions({ id }: { id: string }) {
  const t = useTranslations("progress");
  const [pending, start] = useTransition();
  return (
    <span className="flex gap-1">
      <button type="button" className="btn-primary py-1 text-xs" disabled={pending} onClick={() => start(async () => { await publishStatusUpdate(id); })}>{t("publishDraft")}</button>
      <button type="button" className="btn-ghost py-1 text-xs text-rose-600" disabled={pending} onClick={() => start(async () => { await deleteStatusUpdate(id); })}>{t("delete")}</button>
    </span>
  );
}
