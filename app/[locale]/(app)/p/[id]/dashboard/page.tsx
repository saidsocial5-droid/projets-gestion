import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectData } from "@/lib/project";
import { statusName } from "@/lib/status";
import { BarList, Columns } from "@/components/Charts";

interface Stats {
  total: number;
  done: number;
  overdue: number;
  due_week: number;
  by_status: { status_id: string; count: number }[];
  by_assignee: { assignee_id: string | null; open: number }[];
  completed_weekly: { week: string; count: number }[];
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const data = await getProjectData(id);
  if (!data) notFound();
  const t = await getTranslations("dashboard");
  const supabase = await createClient();
  const { data: raw } = await supabase.rpc("project_stats", { p: id });
  const s = raw as Stats;
  const statusById = new Map(data.statuses.map((x) => [x.id, x]));
  const personById = new Map(data.people.map((p) => [p.id, p.full_name]));
  const short = (d: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;

  const tiles = [
    { label: t("total"), value: s.total },
    { label: t("done"), value: s.done, sub: `${pct}%` },
    { label: t("overdue"), value: s.overdue, alert: s.overdue > 0 },
    { label: t("dueWeek"), value: s.due_week },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label} className="surface rounded-xl p-4">
            <p className="text-xs text-muted">{tile.label}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${tile.alert ? "text-rose-600" : ""}`}>{tile.value}</p>
            {tile.sub && <p className="text-xs tabular-nums text-muted">{tile.sub}</p>}
          </li>
        ))}
      </ul>
      {s.total === 0 ? (
        <p className="surface rounded-xl p-8 text-center text-muted">{t("empty")}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="surface space-y-4 rounded-xl p-4">
            <h2 className="text-sm font-semibold">{t("byStatus")}</h2>
            <BarList
              rows={s.by_status.map((b) => {
                const label = statusName(statusById.get(b.status_id)!, locale);
                return { key: b.status_id, label, value: b.count, title: `${label}: ${t("tasks", { count: b.count })}` };
              })}
            />
          </section>
          <section className="surface space-y-4 rounded-xl p-4">
            <h2 className="text-sm font-semibold">{t("byAssignee")}</h2>
            <BarList
              rows={s.by_assignee.map((b) => {
                const label = b.assignee_id ? personById.get(b.assignee_id) ?? "—" : t("unassigned");
                return { key: b.assignee_id ?? "none", label, value: b.open, title: `${label}: ${t("tasks", { count: b.open })}` };
              })}
            />
          </section>
          <section className="surface space-y-4 rounded-xl p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold">{t("weekly")}</h2>
            <Columns
              points={s.completed_weekly.map((w) => ({ key: w.week, label: short(w.week), value: w.count, tooltip: `${t("weekOf", { date: short(w.week) })}: ${t("tasks", { count: w.count })}` }))}
              tableLabel={t("asTable")}
              headers={[t("weekOf", { date: "" }).trim(), t("done")]}
            />
          </section>
        </div>
      )}
    </div>
  );
}
