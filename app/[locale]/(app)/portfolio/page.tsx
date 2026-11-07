import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/dates";
import { HealthBadge, type Health } from "@/components/HealthBadge";

const SEVERITY: Record<string, number> = { off_track: 0, at_risk: 1, on_hold: 2, none: 3, on_track: 4, complete: 5 };

export default async function PortfolioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = (await getSession())!;
  if (session.role === "guest") redirect({ href: "/home", locale });
  const t = await getTranslations("portfolio");
  const supabase = await createClient();
  const [{ data: projects }, { data: progress }, { data: updates }] = await Promise.all([
    supabase.from("projects").select("id, name, due_date, owner:profiles!projects_owner_id_fkey(full_name)").is("archived_at", null).eq("is_template", false),
    supabase.from("project_progress").select("project_id, tasks_total, tasks_done, tasks_overdue"),
    supabase.from("status_updates").select("project_id, status, published_at").not("published_at", "is", null).order("published_at", { ascending: false }),
  ]);
  const pr = new Map((progress ?? []).map((p) => [p.project_id, p]));
  const last = new Map<string, { status: Health; published_at: string }>();
  for (const u of (updates ?? []) as { project_id: string; status: Health; published_at: string }[]) if (!last.has(u.project_id)) last.set(u.project_id, u);
  const rows = ((projects ?? []) as unknown as { id: string; name: string; due_date: string | null; owner: { full_name: string } | null }[])
    .map((p) => {
      const x = pr.get(p.id);
      const total = Number(x?.tasks_total ?? 0);
      const done = Number(x?.tasks_done ?? 0);
      return { ...p, health: last.get(p.id)?.status ?? null, updated: last.get(p.id)?.published_at ?? null, pct: total ? Math.round((done / total) * 100) : 0, overdue: Number(x?.tasks_overdue ?? 0) };
    })
    .sort((a, b) => SEVERITY[a.health ?? "none"] - SEVERITY[b.health ?? "none"] || b.overdue - a.overdue || a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {rows.length === 0 ? (
        <p className="surface rounded-xl p-8 text-center text-muted">{t("empty")}</p>
      ) : (
        <div className="surface overflow-x-auto rounded-xl">
          <table className="w-full min-w-[42rem] text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                {[t("project"), t("health"), t("progress"), t("overdue"), t("owner"), t("due"), t("updated")].map((h) => <th key={h} className="px-4 py-2 text-start font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                  <td className="px-4 py-2 font-medium"><Link href={`/p/${r.id}/progress`} className="hover:underline">{r.name}</Link></td>
                  <td className="px-4 py-2"><HealthBadge health={r.health} /></td>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${r.pct}%` }} /></span>
                      <span className="tabular-nums text-muted">{r.pct}%</span>
                    </span>
                  </td>
                  <td className={`px-4 py-2 tabular-nums ${r.overdue ? "font-medium text-rose-600" : "text-muted"}`}>{r.overdue}</td>
                  <td className="px-4 py-2 text-muted"><bdi>{r.owner?.full_name ?? "—"}</bdi></td>
                  <td className="px-4 py-2 text-muted">{r.due_date ? formatDate(r.due_date, locale) : "—"}</td>
                  <td className="px-4 py-2 text-muted">{r.updated ? formatDate(r.updated.slice(0, 10), locale) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
