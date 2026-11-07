import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { DonorForm } from "@/components/DonorForm";

export default async function DonorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = (await getSession())!;
  if (session.role === "guest") redirect({ href: "/home", locale });
  const t = await getTranslations("donors");
  const supabase = await createClient();
  const [{ data: donors }, { data: projects }] = await Promise.all([
    supabase.from("donors").select("id, name, contact_name, contact_email, notes").order("name"),
    supabase.from("projects").select("donor_id").not("donor_id", "is", null),
  ]);
  const count = new Map<string, number>();
  for (const p of projects ?? []) count.set(p.donor_id!, (count.get(p.donor_id!) ?? 0) + 1);
  const isAdmin = session.role === "admin";

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {isAdmin && (
        <section className="surface space-y-2 rounded-xl p-4">
          <h2 className="font-medium">{t("new")}</h2>
          <DonorForm />
        </section>
      )}
      {!donors?.length && <p className="surface rounded-xl p-8 text-center text-muted">{t("empty")}</p>}
      <ul className="space-y-3">
        {(donors ?? []).map((d) => (
          <li key={d.id} className="surface rounded-xl p-4">
            {isAdmin ? (
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-xs text-muted">{t("projects", { count: count.get(d.id) ?? 0 })}</span>
                </summary>
                <div className="mt-3"><DonorForm donor={d} /></div>
              </details>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{d.name}</span>
                <span className="text-xs text-muted">{t("projects", { count: count.get(d.id) ?? 0 })}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
