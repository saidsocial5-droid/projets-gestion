import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { HealthBadge, type Health } from "@/components/HealthBadge";
import { DraftActions, StatusUpdateForm } from "@/components/StatusUpdateForm";

interface Update {
  id: string;
  status: Health;
  title: string;
  body: { text?: string; snapshot?: { total: number; done: number; overdue: number } };
  published_at: string | null;
  created_at: string;
  author_id: string | null;
  author: { full_name: string } | null;
}

export default async function ProgressPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations("progress");
  const session = (await getSession())!;
  const supabase = await createClient();
  const [{ data }, { data: canEdit }] = await Promise.all([
    supabase.from("status_updates").select("id, status, title, body, published_at, created_at, author_id, author:profiles(full_name)").eq("project_id", id).order("created_at", { ascending: false }),
    supabase.rpc("can_edit_project", { p: id }),
  ]);
  const updates = (data ?? []) as unknown as Update[];
  const published = updates.filter((u) => u.published_at).sort((a, b) => (a.published_at! < b.published_at! ? 1 : -1));
  const drafts = updates.filter((u) => !u.published_at && u.author_id === session.userId);
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "long", timeZone: "Africa/Casablanca" }).format(new Date(iso));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        {published[0] && <HealthBadge health={published[0].status} />}
      </div>
      {canEdit && <StatusUpdateForm projectId={id} current={published[0]?.status ?? null} />}
      {drafts.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-muted">{t("drafts")}</h3>
          {drafts.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-line p-3 text-sm">
              <span className="flex items-center gap-2"><HealthBadge health={d.status} /> {d.title}</span>
              <DraftActions id={d.id} />
            </div>
          ))}
        </section>
      )}
      {published.length === 0 ? (
        <p className="surface rounded-xl p-8 text-center text-muted">{t("empty")}</p>
      ) : (
        <ol className="space-y-4">
          {published.map((u) => {
            const s = u.body.snapshot;
            const pct = s && s.total ? Math.round((s.done / s.total) * 100) : 0;
            return (
              <li key={u.id}>
                <article className="surface space-y-3 rounded-xl p-4">
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">{u.title}</h3>
                    <HealthBadge health={u.status} />
                  </header>
                  {u.body.text && <p className="whitespace-pre-wrap text-sm">{u.body.text}</p>}
                  {s && (
                    <div className="space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
                      <p className="text-xs text-muted">{t("snapshot", { done: s.done, total: s.total, overdue: s.overdue })}</p>
                    </div>
                  )}
                  <footer className="text-xs text-muted"><bdi>{t("by", { name: u.author?.full_name ?? "—", date: when(u.published_at!) })}</bdi></footer>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
