"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createReport } from "@/lib/actions";

interface Props {
  donors: { id: string; name: string }[];
  projects: { id: string; name: string; donor_id: string | null }[];
  defaultStart: string;
  defaultEnd: string;
}

export function NewReportForm({ donors, projects, defaultStart, defaultEnd }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [donor, setDonor] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(createReport, { status: "idle" } as { status: "idle" | "ok" | "error"; message?: string; id?: string });
  useEffect(() => {
    if (state.status === "ok" && state.id) router.push(`/reports/${state.id}`);
  }, [state, router]);

  const chooseDonor = (id: string) => {
    setDonor(id);
    if (id) setPicked(new Set(projects.filter((p) => p.donor_id === id).map((p) => p.id)));
  };

  return (
    <form action={action} className="surface grid gap-3 rounded-xl p-4 sm:grid-cols-2">
      <label className="space-y-1 sm:col-span-2"><span className="text-sm font-medium">{t("reports.reportTitle")}</span><input name="title" required maxLength={200} className="input" /></label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("reports.donor")}</span>
        <select name="donor_id" value={donor} onChange={(e) => chooseDonor(e.target.value)} className="input">
          <option value="">{t("funding.noDonor")}</option>
          {donors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("reports.language")}</span>
        <select name="locale" defaultValue={locale} className="input"><option value="fr">Français</option><option value="ar">العربية</option></select>
      </label>
      <label className="space-y-1"><span className="text-sm font-medium">{t("reports.periodStart")}</span><input name="period_start" type="date" required defaultValue={defaultStart} className="input" /></label>
      <label className="space-y-1"><span className="text-sm font-medium">{t("reports.periodEnd")}</span><input name="period_end" type="date" required defaultValue={defaultEnd} className="input" /></label>
      <fieldset className="space-y-1 sm:col-span-2">
        <legend className="text-sm font-medium">{t("reports.allProjects")}</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {projects.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="project_ids"
                value={p.id}
                checked={picked.has(p.id)}
                onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n; })}
                className="accent-[var(--color-brand-600)]"
              />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{t("reports.create")}</button>
        {state.status === "error" && <span role="alert" className="text-sm text-rose-600">{state.message === "no_projects" ? t("reports.noProjects") : t("errors.generic")}</span>}
      </div>
    </form>
  );
}
