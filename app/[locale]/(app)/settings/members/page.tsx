import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "@/components/InviteForm";

export default async function MembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (session?.role !== "admin") redirect({ href: "/projects", locale });
  const t = await getTranslations("members");
  const supabase = await createClient();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("workspace_members").select("role, profiles(id, full_name)").eq("workspace_id", session!.workspaceId).order("created_at"),
    supabase.from("invitations").select("id, email, workspace_role, created_at").eq("workspace_id", session!.workspaceId).is("accepted_at", null).is("revoked_at", null).order("created_at"),
  ]);
  const rows = (members ?? []) as unknown as { role: string; profiles: { id: string; full_name: string } | null }[];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <section className="space-y-2">
        <h2 className="font-medium">{t("invite")}</h2>
        <InviteForm />
      </section>
      <ul className="surface divide-y divide-[var(--border)] rounded-xl">
        {rows.map((m) => (
          <li key={m.profiles?.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <span>{m.profiles?.full_name}</span>
            <span className="text-muted">{t(`role_${m.role}`)}</span>
          </li>
        ))}
      </ul>
      {!!invites?.length && (
        <section className="space-y-2">
          <h2 className="font-medium">{t("pending")}</h2>
          <p className="text-xs text-muted">{t("pendingHint")}</p>
          <ul className="surface divide-y divide-[var(--border)] rounded-xl">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span dir="ltr">{i.email}</span>
                <span className="text-muted">{t(`role_${i.workspace_role}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
