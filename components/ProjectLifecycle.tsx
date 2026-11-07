"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteTemplate, saveAsTemplate, setArchived } from "@/lib/actions";

export function ProjectLifecycle({ projectId, name, archived, isTemplate }: { projectId: string; name: string; archived: boolean; isTemplate: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [templateName, setTemplateName] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (isTemplate)
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted">{t("templates.isTemplate")}</p>
        <button
          type="button"
          className="btn-ghost text-rose-600"
          disabled={pending}
          onClick={() => confirm(t("templates.confirmDeleteTemplate")) && start(async () => {
            const r = await deleteTemplate(projectId);
            if (r.ok) router.push("/projects?view=templates");
            else setError(t(`errors.${r.error}`));
          })}
        >
          {t("templates.deleteTemplate")}
        </button>
        {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
      </div>
    );

  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await saveAsTemplate(projectId, templateName);
            if (r.ok) router.push(`/p/${r.data}/list`);
            else setError(t(`errors.${r.error}`));
          });
        }}
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-48 flex-1 space-y-1">
            <span className="text-sm font-medium">{t("templates.templateName")}</span>
            <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} required maxLength={200} className="input" />
          </label>
          <button className="btn-primary" disabled={pending}>{t("templates.saveAs")}</button>
        </div>
        <p className="text-xs text-muted">{t("templates.saveAsHint")}</p>
      </form>
      <div className="space-y-1 border-t border-line pt-3">
        <button type="button" className="btn-ghost border border-line" disabled={pending} onClick={() => start(async () => {
          const r = await setArchived(projectId, !archived);
          setError(r.ok ? null : t(`errors.${r.error}`));
        })}>
          {archived ? t("templates.unarchive") : `🗄 ${t("templates.archive")}`}
        </button>
        <p className="text-xs text-muted">{t("templates.archiveHint")}</p>
      </div>
      {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
