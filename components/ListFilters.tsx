"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { CustomField, Person, Status } from "@/lib/types";

/** Filter bar: every change rewrites the URL query, so filters are shareable and the server does the filtering. */
export function ListFilters({ statuses, people, fields, locale, shown, total }: { statuses: Status[]; people: Person[]; fields: CustomField[]; locale: string; shown: number; total: number }) {
  const t = useTranslations("filters");
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    next.delete("task");
    if (value) next.set(key, value);
    else next.delete(key);
    const q = next.toString();
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  };
  const active = [...params.keys()].some((k) => k !== "task");
  const selects = fields.filter((f) => f.type.endsWith("select"));

  return (
    <form role="search" aria-label={t("title")} className="flex flex-wrap items-end gap-2 text-sm" onSubmit={(e) => e.preventDefault()}>
      <label className="space-y-1">
        <span className="block text-xs text-muted">{t("status")}</span>
        <select value={params.get("status") ?? ""} onChange={(e) => set("status", e.target.value)} className="input w-auto py-1">
          <option value="">{t("any")}</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{locale === "ar" ? s.name_ar : s.name_fr}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-muted">{t("assignee")}</span>
        <select value={params.get("assignee") ?? ""} onChange={(e) => set("assignee", e.target.value)} className="input w-auto py-1">
          <option value="">{t("any")}</option>
          <option value="me">{t("me")}</option>
          <option value="none">{t("unassigned")}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-xs text-muted">{t("due")}</span>
        <select value={params.get("due") ?? ""} onChange={(e) => set("due", e.target.value)} className="input w-auto py-1">
          <option value="">{t("any")}</option>
          <option value="overdue">{t("overdue")}</option>
          <option value="week">{t("week")}</option>
          <option value="none">{t("noDate")}</option>
        </select>
      </label>
      {selects.map((f) => (
        <label key={f.id} className="space-y-1">
          <span className="block text-xs text-muted">{f.name}</span>
          <select value={params.get(`f_${f.id}`) ?? ""} onChange={(e) => set(`f_${f.id}`, e.target.value)} className="input w-auto py-1">
            <option value="">{t("any")}</option>
            {f.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      ))}
      <label className="flex items-center gap-2 pb-1.5">
        <input type="checkbox" checked={params.get("done") === "hide"} onChange={(e) => set("done", e.target.checked ? "hide" : "")} className="accent-[var(--color-brand-600)]" />
        {t("hideDone")}
      </label>
      {active && <button type="button" className="btn-ghost py-1" onClick={() => router.replace(path, { scroll: false })}>{t("clear")}</button>}
      <span className="ms-auto pb-1.5 text-xs text-muted" role="status">{t("count", { shown, total })}</span>
    </form>
  );
}
