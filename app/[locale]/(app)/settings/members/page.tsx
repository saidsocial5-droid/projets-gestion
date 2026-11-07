import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "@/components/InviteForm";
import { RevokeInvitation, WorkspaceMemberControls } from "@/components/MemberControls";

export default async function MembersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (session?.role !== "admin") redirect({ href: "/home", locale });
  const t = await getTranslations("members");
  const supabase = await createClient();
  const [{ data: members }, { data: invites }, { data: emails }] = await Promise.all([
    supabase.from("workspace_members").select("role, profiles(id, full_name)").eq("workspace_id", session!.workspaceId).order("created_at"),
    supabase.from("invitations").select("id, email, workspace_role, project_id, projects(name)").eq("workspace_id", session!.workspaceId).is("accepted_at", null).is("revoked_at", null).order("created_at"),
    supabase.rpc("member_emails", { ws: session!.workspaceId }),
  ]);
  const emailOf = new Map(((emails ?? []) as { user_id: string; email: string }[]).map((e) => [e.user_id, e.email]));
  const rows = (members ?? []) as unknown as { role: string; profiles: { id: string; full_name: string } }[];
  const pending = (invites ?? []) as unknown as { id: string; email: string; workspace_role: string; projects: { name: string } | null }[];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <section className="space-y-2">
        <h2 className="font-medium">{t("invite")}</h2>
        <InviteForm />
      </section>
      <ul className="surface divide-y divide-[var(--border)] rounded-xl">
        {rows.map((m) => (
          <li key={m.profiles.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <span>
              <bdi className="font-medium">{m.profiles.full_name}</bdi> {m.profiles.id === session!.userId && <span className="text-muted">{t("you")}</span>}
              <span dir="ltr" className="block text-xs text-muted">{emailOf.get(m.profiles.id)}</span>
            </span>
            <WorkspaceMemberControls userId={m.profiles.id} role={m.role} self={m.profiles.id === session!.userId} />
          </li>
        ))}
      </ul>
      {pending.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">{t("pending")}</h2>
          <p className="text-xs text-muted">{t("pendingHint")}</p>
          <ul className="surface divide-y divide-[var(--border)] rounded-xl">
            {pending.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span dir="ltr">{i.email}</span>
                  <span className="block text-xs text-muted">{t(`role_${i.workspace_role}`)}{i.projects ? ` · ${i.projects.name}` : ""}</span>
                </span>
                <RevokeInvitation id={i.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
