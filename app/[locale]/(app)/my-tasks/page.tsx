import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { bucketOf, getMyOpenTasks, type Bucket } from "@/lib/my-tasks";
import { MyTaskRow } from "@/components/MyTaskRow";

const ORDER: Bucket[] = ["overdue", "today", "week", "later", "noDate"];

export default async function MyTasksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("myTasks");
  const session = (await getSession())!;
  const tasks = await getMyOpenTasks(session.userId);
  const groups = ORDER.map((b) => ({ b, tasks: tasks.filter((x) => bucketOf(x.due_date) === b) })).filter((g) => g.tasks.length);
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {groups.length === 0 && <p className="surface rounded-xl p-8 text-center text-muted">{t("empty")}</p>}
      {groups.map((g) => (
        <section key={g.b} className="surface overflow-hidden rounded-xl">
          <h2 className={`border-b border-line px-4 py-2 text-sm font-semibold ${g.b === "overdue" ? "text-rose-600" : ""}`}>
            {t(g.b)} <span className="font-normal text-muted">({g.tasks.length})</span>
          </h2>
          <ul className="divide-y divide-[var(--border)]">
            {g.tasks.map((task) => <li key={task.id}><MyTaskRow task={task} locale={locale} /></li>)}
          </ul>
        </section>
      ))}
    </main>
  );
}
