import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { DeleteExpense, ExpenseForm, IndicatorCurrent, IndicatorForm } from "@/components/FundingForms";

export default async function FundingPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const session = (await getSession())!;
  if (session.role === "guest") notFound();
  const t = await getTranslations();
  const supabase = await createClient();
  const [{ data: project }, { data: expenses }, { data: indicators }, { data: canEdit }] = await Promise.all([
    supabase.from("projects").select("budget_cents, currency, donor:donors(name)").eq("id", id).single(),
    supabase.from("expenses").select("id, amount_cents, currency, spent_on, category, label").eq("project_id", id).order("spent_on", { ascending: false }),
    supabase.from("indicators").select("id, name_ar, name_fr, unit, baseline, target, current").eq("project_id", id).order("rank"),
    supabase.rpc("can_edit_project", { p: id }),
  ]);
  if (!project) notFound();
  const p = project as unknown as { budget_cents: number | null; currency: string; donor: { name: string } | null };
  const spent = (expenses ?? []).reduce((s, e) => s + Number(e.amount_cents), 0);
  const budget = p.budget_cents != null ? Number(p.budget_cents) : null;
  const pct = budget ? Math.round((spent / budget) * 100) : 0;
  const money = (c: number) => formatMoney(c, p.currency, locale);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="surface space-y-3 rounded-xl p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">{t("funding.budget")}</h2>
          <span className="text-sm text-muted">{t("funding.donor")}: <bdi>{p.donor?.name ?? t("funding.noDonor")}</bdi></span>
        </div>
        {budget == null ? (
          <p className="text-sm text-muted">{t("funding.noBudget")}</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div><dt className="text-xs text-muted">{t("funding.budget")}</dt><dd className="text-lg font-semibold tabular-nums">{money(budget)}</dd></div>
              <div><dt className="text-xs text-muted">{t("funding.spent")}</dt><dd className="text-lg font-semibold tabular-nums">{money(spent)}</dd></div>
              <div><dt className="text-xs text-muted">{t("funding.remaining")}</dt><dd className={`text-lg font-semibold tabular-nums ${spent > budget ? "text-rose-600" : ""}`}>{money(budget - spent)}</dd></div>
            </dl>
            <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("funding.spent")}>
              <div className={`h-full rounded-full ${spent > budget ? "bg-rose-500" : "bg-brand-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <p className="text-xs text-muted">{pct}% {spent > budget && <span className="font-medium text-rose-600">▲ {t("funding.overBudget")}</span>}</p>
          </>
        )}
      </section>

      <section className="surface space-y-3 rounded-xl p-4">
        <h2 className="font-semibold">{t("funding.indicators")}</h2>
        {!indicators?.length && <p className="text-sm text-muted">{t("funding.noIndicators")}</p>}
        <ul className="divide-y divide-[var(--border)]">
          {(indicators ?? []).map((ind) => {
            const name = locale === "ar" ? ind.name_ar : ind.name_fr;
            const span = Number(ind.target) - Number(ind.baseline);
            const reached = span > 0 ? Math.max(0, Math.round(((Number(ind.current) - Number(ind.baseline)) / span) * 100)) : 100;
            return (
              <li key={ind.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="space-y-1">
                  <p className="font-medium">{name}</p>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-32 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, reached)}%` }} /></span>
                    <span className="text-xs text-muted">{t("funding.achieved", { pct: reached })} · {t("funding.baseline")} {Number(ind.baseline)} → {t("funding.target")} {Number(ind.target)} {ind.unit}</span>
                  </div>
                </div>
                {canEdit ? <IndicatorCurrent id={ind.id} current={Number(ind.current)} label={`${t("funding.current")}: ${name}`} /> : <span className="tabular-nums">{Number(ind.current)} {ind.unit}</span>}
              </li>
            );
          })}
        </ul>
        {canEdit && (
          <details className="rounded-lg border border-dashed border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">+ {t("funding.addIndicator")}</summary>
            <div className="mt-3"><IndicatorForm projectId={id} /></div>
          </details>
        )}
      </section>

      <section className="surface space-y-3 rounded-xl p-4">
        <h2 className="font-semibold">{t("funding.expenses")}</h2>
        {canEdit && <ExpenseForm projectId={id} />}
        {!expenses?.length ? (
          <p className="text-sm text-muted">{t("funding.noExpenses")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted"><tr>{[t("funding.date"), t("funding.label"), t("funding.category"), t("funding.amount"), ""].map((h, i) => <th key={i} className="py-2 text-start font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-[var(--border)]">
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 text-muted">{formatDate(e.spent_on, locale)}</td>
                    <td className="py-2"><bdi>{e.label}</bdi></td>
                    <td className="py-2 text-muted">{t(`category.${e.category}`)}</td>
                    <td className="py-2 tabular-nums">{formatMoney(Number(e.amount_cents), e.currency, locale)}</td>
                    <td className="py-2 text-end">{canEdit && <DeleteExpense id={e.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
