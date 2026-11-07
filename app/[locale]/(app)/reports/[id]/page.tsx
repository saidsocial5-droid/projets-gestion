import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { loadReport, indicatorProgress } from "@/lib/report";
import { formatMoney } from "@/lib/money";
import { HealthBadge } from "@/components/HealthBadge";
import { PrintButton } from "@/components/PrintButton";

export default async function ReportPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  const r = await loadReport(id);
  if (!r) notFound();
  const ui = await getTranslations("reports");
  // the document itself is written in the report's language, whatever the UI language is
  const L = r.locale;
  const t = await getTranslations({ locale: L, namespace: "doc" });
  const tr = await getTranslations({ locale: L });
  const date = (d: string) => new Intl.DateTimeFormat(L === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${d.slice(0, 10)}T00:00:00Z`));
  const money = (c: number, cur: string) => formatMoney(c, cur, L);
  const totals = r.projects.reduce(
    (a, p) => ({ budget: a.budget + Number(p.budget_cents ?? 0), spent: a.spent + Number(p.spent_cents), period: a.period + Number(p.spent_in_period_cents) }),
    { budget: 0, spent: 0, period: 0 },
  );
  const currency = r.projects[0]?.currency ?? "MAD";

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <a href={`/api/reports/${r.id}/xlsx`} className="btn-ghost border border-line">⬇ {ui("excel")}</a>
        <PrintButton label={ui("print")} />
      </div>
        <article lang={L} dir={L === "ar" ? "rtl" : "ltr"} className="surface space-y-8 rounded-xl p-8 print:border-0 print:p-0 print:shadow-none">
          <header className="space-y-1 border-b border-line pb-4">
            <p className="text-sm text-muted">{L === "ar" ? "جمعية الغابة النموذجية بإفران" : "Association Forêt Modèle d'Ifrane"}{r.donor ? ` — ${r.donor.name}` : ""}</p>
            <h1 className="text-2xl font-semibold">{r.title}</h1>
            <p className="text-sm text-muted">{tr("reports.period", { start: date(r.period_start), end: date(r.period_end) })}</p>
          </header>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("summary")}</h2>
            <table className="w-full text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>{[t("project"), t("health"), t("progress"), t("budget"), t("spentPeriod"), t("rate")].map((h) => <th key={h} className="py-2 text-start font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {r.projects.map((p) => {
                  const last = p.updates.at(-1);
                  const pct = p.tasks_total ? Math.round((p.tasks_done / p.tasks_total) * 100) : 0;
                  return (
                    <tr key={p.id} className="break-inside-avoid">
                      <td className="py-2 font-medium"><bdi>{p.name}</bdi></td>
                      <td className="py-2"><HealthBadge health={last?.status ?? null} label={tr(`health.${last?.status ?? "none"}`)} /></td>
                      <td className="py-2 tabular-nums">{pct}%</td>
                      <td className="py-2 tabular-nums">{p.budget_cents != null ? money(Number(p.budget_cents), p.currency) : "—"}</td>
                      <td className="py-2 tabular-nums">{money(Number(p.spent_in_period_cents), p.currency)}</td>
                      <td className="py-2 tabular-nums">{p.budget_cents ? `${Math.round((Number(p.spent_cents) / Number(p.budget_cents)) * 100)}%` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              {r.projects.length > 1 && (
                <tfoot className="border-t border-line font-medium">
                  <tr><td className="py-2">{t("total")}</td><td /><td /><td className="py-2 tabular-nums">{money(totals.budget, currency)}</td><td className="py-2 tabular-nums">{money(totals.period, currency)}</td><td className="py-2 tabular-nums">{totals.budget ? `${Math.round((totals.spent / totals.budget) * 100)}%` : "—"}</td></tr>
                </tfoot>
              )}
            </table>
          </section>

          {r.projects.map((p) => (
            <section key={p.id} className="space-y-4 break-before-page border-t border-line pt-6 first-of-type:break-before-auto">
              <h2 className="text-lg font-semibold"><bdi>{p.name}</bdi></h2>
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-xs text-muted">{t("tasksDone")}</dt><dd className="font-semibold tabular-nums">{p.tasks_done} / {p.tasks_total}</dd></div>
                <div><dt className="text-xs text-muted">{t("doneInPeriod")}</dt><dd className="font-semibold tabular-nums">{p.tasks_done_in_period}</dd></div>
                <div><dt className="text-xs text-muted">{t("spentTotal")}</dt><dd className="font-semibold tabular-nums">{money(Number(p.spent_cents), p.currency)}</dd></div>
                <div><dt className="text-xs text-muted">{t("spentPeriod")}</dt><dd className="font-semibold tabular-nums">{money(Number(p.spent_in_period_cents), p.currency)}</dd></div>
              </dl>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t("indicators")}</h3>
                {p.indicators.length === 0 ? <p className="text-sm text-muted">{t("noIndicators")}</p> : (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted"><tr>{[t("indicator"), tr("funding.baseline"), tr("funding.target"), tr("funding.current"), "%"].map((h) => <th key={h} className="py-1 text-start font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {p.indicators.map((i, k) => (
                        <tr key={k}>
                          <td className="py-1">{L === "ar" ? i.name_ar : i.name_fr}{i.unit ? <> (<bdi>{i.unit}</bdi>)</> : ""}</td>
                          <td className="py-1 tabular-nums">{Number(i.baseline)}</td>
                          <td className="py-1 tabular-nums">{Number(i.target)}</td>
                          <td className="py-1 tabular-nums">{Number(i.current)}</td>
                          <td className="py-1 tabular-nums">{indicatorProgress(i)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {p.expenses_by_category.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">{t("byCategory")}</h3>
                  <ul className="space-y-1 text-sm">
                    {p.expenses_by_category.map((e) => (
                      <li key={e.category} className="flex justify-between gap-2 border-b border-dotted border-line py-1">
                        <span>{tr(`category.${e.category}`)}</span><span className="tabular-nums">{money(Number(e.amount_cents), p.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t("updates")}</h3>
                {p.updates.length === 0 ? <p className="text-sm text-muted">{t("noUpdates")}</p> : (
                  <ol className="space-y-3">
                    {p.updates.map((u, k) => (
                      <li key={k} className="break-inside-avoid space-y-1 text-sm">
                        <p className="flex flex-wrap items-center gap-2"><HealthBadge health={u.status} label={tr(`health.${u.status}`)} /><bdi className="font-medium">{u.title}</bdi><span className="text-xs text-muted">{date(u.published_at)}</span></p>
                        {u.text && <p className="whitespace-pre-wrap">{u.text}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          ))}

          <footer className="border-t border-line pt-4 text-xs text-muted">{t("generated", { date: date(new Date().toISOString()) })}</footer>
        </article>
    </main>
  );
}
