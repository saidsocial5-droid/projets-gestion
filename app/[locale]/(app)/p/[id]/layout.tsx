import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProjectTabs } from "@/components/ProjectTabs";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).maybeSingle();
  if (!project) notFound();
  const t = await getTranslations();
  const { data: isAdmin } = await supabase.rpc("can_admin_project", { p: id });
  return (
    <div className="px-4 py-6">
      <div className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <ProjectTabs id={id} labels={{ list: t("project.list"), board: t("project.board"), settings: t("projectSettings.tab") }} showSettings={isAdmin === true} />
      </div>
      {children}
    </div>
  );
}
