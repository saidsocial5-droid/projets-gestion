"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createProject } from "@/lib/actions";

export function NewProjectForm({ templates }: { templates: { id: string; name: string }[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>+ {t("projects.new")}</button>;

  return (
    <form
      className="surface grid gap-3 rounded-xl p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
      action={(form) =>
        start(async () => {
          form.set("section_name", t("projects.defaultSection"));
          const res = await createProject(form);
          if (res.ok) router.push(`/p/${res.data}/list`);
          else setError(t(`errors.${res.error}`));
        })
      }
    >
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("projects.name")}</span>
        <input name="name" required maxLength={200} autoFocus className="input" />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("projects.privacy")}</span>
        <select name="privacy" className="input">
          <option value="workspace">{t("projects.privacyWorkspace")}</option>
          <option value="private">{t("projects.privacyPrivate")}</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("projects.dueDate")}</span>
        <input name="due_date" type="date" className="input" />
      </label>
      {templates.length > 0 && (
        <label className="space-y-1 sm:col-span-4">
          <span className="text-sm font-medium">{t("templates.template")}</span>
          <select name="template_id" className="input">
            <option value="">{t("templates.blank")}</option>
            {templates.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
          </select>
        </label>
      )}
      <button className="btn-primary" disabled={pending}>{t("projects.create")}</button>
      {error && <p role="alert" className="text-sm text-rose-600 sm:col-span-4">{error}</p>}
    </form>
  );
}
