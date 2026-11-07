import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AddProjectMemberForm, InviteGuestForm, ProjectGeneralForm } from "@/components/ProjectSettingsForms";
import { ProjectMemberControls, RevokeInvitation } from "@/components/MemberControls";
import type { Person } from "@/lib/types";

export default async function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("can_admin_project", { p: id });
  if (!isAdmin) notFound();
  const t = await getTranslations();

  const { data: project } = await supabase.from("projects").select("id, name, privacy, due_date, workspace_id").eq("id", id).single();
  const [{ data: members }, { data: staff }, { data: invites }] = await Promise.all([
    supabase.from("project_members").select("role, profiles(id, full_name)").eq("project_id", id).order("created_at"),
    supabase.from("workspace_members").select("role, profiles(id, full_name)").eq("workspace_id", project!.workspace_id),
    supabase.from("invitations").select("id, email, project_role").eq("project_id", id).is("accepted_at", null).is("revoked_at", null).order("created_at"),
  ]);
  const memberRows = (members ?? []) as unknown as { role: string; profiles: Person }[];
  const staffRows = (staff ?? []) as unknown as { role: string; profiles: Person }[];
  const guestIds = new Set(staffRows.filter((s) => s.role === "guest").map((s) => s.profiles.id));
  const memberIds = new Set(memberRows.map((m) => m.profiles.id));
  const candidates = staffRows.filter((s) => !memberIds.has(s.profiles.id)).map((s) => s.profiles);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-2">
        <h2 className="font-medium">{t("projectSettings.general")}</h2>
        <ProjectGeneralForm project={project!} />
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">{t("projectSettings.members")}</h2>
        <p className="text-xs text-muted">{t("projectSettings.membersHint")}</p>
        <ul className="surface divide-y divide-[var(--border)] rounded-xl">
          {memberRows.map((m) => (
            <li key={m.profiles.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span>
                <bdi className="font-medium">{m.profiles.full_name}</bdi>
                {guestIds.has(m.profiles.id) && <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{t("projectSettings.guest")}</span>}
              </span>
              <ProjectMemberControls projectId={id} userId={m.profiles.id} role={m.role} />
            </li>
          ))}
        </ul>
        <div className="surface space-y-4 rounded-xl p-4">
          {candidates.length > 0 && <AddProjectMemberForm projectId={id} candidates={candidates} />}
          <InviteGuestForm projectId={id} />
        </div>
        {!!invites?.length && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t("projectSettings.pending")}</h3>
            <ul className="surface divide-y divide-[var(--border)] rounded-xl">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span><span dir="ltr">{i.email}</span> <span className="text-xs text-muted">· {t(`projectSettings.role_${i.project_role ?? "viewer"}`)}</span></span>
                  <RevokeInvitation id={i.id} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
