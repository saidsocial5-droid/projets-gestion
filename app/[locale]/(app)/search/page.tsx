import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

function like(q: string) {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q: raw = "" } = await searchParams;
  const q = raw.trim().slice(0, 100);
  const t = await getTranslations("search");
  const supabase = await createClient();
  const ok = q.length >= 2;
  const [{ data: tasks }, { data: projects }] = ok
    ? await Promise.all([
        supabase.from("tasks").select("id, title, parent_task_id, completed_at, project:projects(id, name)").ilike("title", like(q)).order("updated_at", { ascending: false }).limit(30),
        supabase.from("projects").select("id, name").ilike("name", like(q)).limit(10),
      ])
    : [{ data: [] }, { data: [] }];
  const taskRows = (tasks ?? []) as unknown as { id: string; title: string; parent_task_id: string | null; completed_at: string | null; project: { id: string; name: string } }[];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <form role="search" className="flex gap-2">
        <input type="search" name="q" defaultValue={q} placeholder={t("placeholder")} aria-label={t("title")} autoFocus className="input text-base" />
        <button className="btn-primary">{t("title")}</button>
      </form>
      {!ok && <p className="text-sm text-muted">{t("hint")}</p>}
      {ok && !taskRows.length && !projects?.length && <p className="surface rounded-xl p-8 text-center text-muted">{t("none", { q })}</p>}
      {!!projects?.length && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("projects")}</h2>
          <ul className="surface divide-y divide-[var(--border)] rounded-xl">
            {projects.map((p) => <li key={p.id}><Link href={`/p/${p.id}/list`} className="block px-4 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">{p.name}</Link></li>)}
          </ul>
        </section>
      )}
      {!!taskRows.length && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("tasks")}</h2>
          <ul className="surface divide-y divide-[var(--border)] rounded-xl">
            {taskRows.map((x) => (
              <li key={x.id}>
                <Link href={`/p/${x.project.id}/list?task=${x.parent_task_id ?? x.id}`} className="block px-4 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                  <span className={x.completed_at ? "text-muted line-through" : ""}>{x.title}</span>
                  <span className="block text-xs text-muted">{x.project.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
