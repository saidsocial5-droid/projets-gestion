import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProjectTabs } from "@/components/ProjectTabs";
import { LiveRefresh } from "@/components/LiveRefresh";
import { getSession } from "@/lib/session";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, name, is_template, archived_at").eq("id", id).maybeSingle();
  if (!project) notFound();
  const t = await getTranslations();
  const session = await getSession();
  const { data: isAdmin } = await supabase.rpc("can_admin_project", { p: id });
  return (
    <div className="px-4 py-6">
      {(project.is_template || project.archived_at) && (
        <p role="note" className="mx-auto mb-3 max-w-7xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
          {project.is_template ? `📋 ${t("templates.isTemplate")}` : `🗄 ${t("templates.isArchived")}`}
        </p>
      )}
      <div className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <ProjectTabs id={id} labels={{ list: t("project.list"), board: t("project.board"), timeline: t("project.timeline"), progress: t("project.progress"), dashboard: t("project.dashboard"), funding: t("project.funding"), settings: t("projectSettings.tab") }} showSettings={isAdmin === true} showFunding={session?.role !== "guest"} />
      </div>
      <LiveRefresh projectId={id} />
      {children}
    </div>
  );
}
