import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { NewProjectForm } from "@/components/NewProjectForm";
import { formatDate } from "@/lib/dates";

interface Row {
  id: string;
  name: string;
  privacy: string;
  due_date: string | null;
}
interface Progress {
  project_id: string;
  tasks_total: number;
  tasks_done: number;
  tasks_overdue: number;
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("projects");
  const session = await getSession();
  const supabase = await createClient();
  const [{ data: projects }, { data: progress }] = await Promise.all([
    supabase.from("projects").select("id, name, privacy, due_date").is("archived_at", null).eq("is_template", false).order("created_at", { ascending: false }),
    supabase.from("project_progress").select("project_id, tasks_total, tasks_done, tasks_overdue"),
  ]);
  const byId = new Map(((progress ?? []) as Progress[]).map((p) => [p.project_id, p]));
  const rows = (projects ?? []) as Row[];

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
      </div>
      {session?.role !== "guest" && <NewProjectForm />}
      {rows.length === 0 ? (
        <p className="surface rounded-xl p-8 text-center text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => {
            const pr = byId.get(p.id);
            const total = Number(pr?.tasks_total ?? 0);
            const done = Number(pr?.tasks_done ?? 0);
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <li key={p.id}>
                <Link href={`/p/${p.id}/list`} className="surface block space-y-3 rounded-xl p-4 transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-medium">{p.name}</h2>
                    {p.privacy === "private" && <span aria-hidden title={t("privacyPrivate")}>🔒</span>}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
                    <span>{t("tasks", { done, total })}</span>
                    {Number(pr?.tasks_overdue ?? 0) > 0 && <span className="text-rose-600">{t("overdue", { count: Number(pr!.tasks_overdue) })}</span>}
                    {p.due_date && <span>{formatDate(p.due_date, locale)}</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
