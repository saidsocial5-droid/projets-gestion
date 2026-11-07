import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { bucketOf, getMyOpenTasks } from "@/lib/my-tasks";
import { getInbox } from "@/lib/inbox";
import { peopleNames, statusNames } from "@/lib/statuses";
import { MyTaskRow } from "@/components/MyTaskRow";
import { InboxList } from "@/components/InboxList";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("home");
  const session = (await getSession())!;
  const supabase = await createClient();
  const [tasks, inbox, names, people, { data: profile }, { data: projects }, { data: progress }] = await Promise.all([
    getMyOpenTasks(session.userId),
    getInbox(session.userId, 20),
    statusNames(locale),
    peopleNames(),
    supabase.from("profiles").select("full_name").eq("id", session.userId).single(),
    supabase.from("projects").select("id, name").is("archived_at", null).eq("is_template", false).order("updated_at", { ascending: false }).limit(6),
    supabase.from("project_progress").select("project_id, tasks_total, tasks_done"),
  ]);
  const soon = tasks.filter((x) => ["overdue", "today", "week"].includes(bucketOf(x.due_date))).slice(0, 8);
  const overdue = tasks.filter((x) => bucketOf(x.due_date) === "overdue").length;
  const unread = inbox.filter((n) => !n.read_at).slice(0, 5);
  const pr = new Map((progress ?? []).map((p) => [p.project_id, p]));

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("hello", { name: profile?.full_name ?? "" })}</h1>
        {overdue > 0 && <p className="text-sm text-rose-600">{t("overdueCount", { count: overdue })}</p>}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{t("dueSoon")}</h2>
            <Link href="/my-tasks" className="text-sm text-brand-700 hover:underline dark:text-brand-100">{t("allTasks")}</Link>
          </div>
          <ul className="surface divide-y divide-[var(--border)] overflow-hidden rounded-xl">
            {soon.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">—</li>}
            {soon.map((task) => <li key={task.id}><MyTaskRow task={task} locale={locale} /></li>)}
          </ul>
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{t("unread")}</h2>
            <Link href="/inbox" className="text-sm text-brand-700 hover:underline dark:text-brand-100">{t("allInbox")}</Link>
          </div>
          {unread.length === 0 ? <p className="surface rounded-xl px-4 py-6 text-center text-sm text-muted">—</p> : <InboxList items={unread} statusNames={names} people={people} />}
        </section>
      </div>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{t("projects")}</h2>
          <Link href="/projects" className="text-sm text-brand-700 hover:underline dark:text-brand-100">{t("allProjects")}</Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(projects ?? []).map((p) => {
            const x = pr.get(p.id);
            const pct = x && Number(x.tasks_total) ? Math.round((Number(x.tasks_done) / Number(x.tasks_total)) * 100) : 0;
            return (
              <li key={p.id}>
                <Link href={`/p/${p.id}/list`} className="surface block space-y-2 rounded-xl p-4 hover:shadow-md">
                  <span className="font-medium">{p.name}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
