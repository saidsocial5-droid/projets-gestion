import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ProjectTabs } from "@/components/ProjectTabs";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).maybeSingle();
  if (!project) notFound();
  const t = await getTranslations("project");
  return (
    <div className="px-4 py-6">
      <div className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <ProjectTabs id={id} labels={{ list: t("list"), board: t("board") }} />
      </div>
      {children}
    </div>
  );
}
