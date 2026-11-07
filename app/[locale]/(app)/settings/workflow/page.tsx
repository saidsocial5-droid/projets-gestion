import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { WorkflowEditor } from "@/components/WorkflowEditor";
import type { Status, Transition } from "@/lib/types";

export default async function WorkflowPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = (await getSession())!;
  if (session.role !== "admin") redirect({ href: "/home", locale });
  const t = await getTranslations("workflow");
  const supabase = await createClient();
  const { data: wf } = await supabase.from("workflows").select("id, restrict_transitions").eq("workspace_id", session.workspaceId).order("created_at").limit(1).single();
  const [{ data: statuses }, { data: transitions }] = await Promise.all([
    supabase.from("workflow_statuses").select("id, name_ar, name_fr, color, category, rank").eq("workflow_id", wf!.id).order("rank"),
    supabase.from("workflow_transitions").select("from_status_id, to_status_id").eq("workflow_id", wf!.id),
  ]);
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-sm text-muted">{t("hint")}</p>
      <WorkflowEditor workflowId={wf!.id} statuses={(statuses ?? []) as Status[]} transitions={(transitions ?? []) as Transition[]} restrict={wf!.restrict_transitions} />
    </main>
  );
}
