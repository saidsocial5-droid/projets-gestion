import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { formatDate, todayInMorocco } from "@/lib/dates";
import { NewReportForm } from "@/components/NewReportForm";

export default async function ReportsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = (await getSession())!;
  if (session.role === "guest") redirect({ href: "/home", locale });
  const t = await getTranslations("reports");
  const supabase = await createClient();
  const [{ data: reports }, { data: donors }, { data: projects }] = await Promise.all([
    supabase.from("reports").select("id, title, period_start, period_end, locale, donor:donors(name)").order("created_at", { ascending: false }),
    supabase.from("donors").select("id, name").order("name"),
    supabase.from("projects").select("id, name, donor_id").is("archived_at", null).eq("is_template", false).order("name"),
  ]);
  const today = todayInMorocco();
  const rows = (reports ?? []) as unknown as { id: string; title: string; period_start: string; period_end: string; locale: string; donor: { name: string } | null }[];

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <section className="space-y-2">
        <h2 className="font-medium">{t("new")}</h2>
        <NewReportForm donors={donors ?? []} projects={projects ?? []} defaultStart={`${today.slice(0, 4)}-01-01`} defaultEnd={today} />
      </section>
      {rows.length === 0 ? (
        <p className="surface rounded-xl p-8 text-center text-muted">{t("empty")}</p>
      ) : (
        <ul className="surface divide-y divide-[var(--border)] rounded-xl">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/reports/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-muted">{r.donor?.name ? `${r.donor.name} · ` : ""}{formatDate(r.period_start, locale)} – {formatDate(r.period_end, locale)} · {r.locale.toUpperCase()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
