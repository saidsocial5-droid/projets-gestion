import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Opens a notification: marks it read, then goes to its task. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select("activity:activities(project_id, task_id, task:tasks(parent_task_id))")
    .maybeSingle();
  const a = (data as unknown as { activity: { project_id: string; task_id: string | null; task: { parent_task_id: string | null } | null } } | null)?.activity;
  const taskId = a?.task?.parent_task_id ?? a?.task_id;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const target = a ? `/${locale}/p/${a.project_id}/list${taskId ? `?task=${taskId}` : ""}` : `/${locale}/inbox`;
  return NextResponse.redirect(new URL(target, `${proto}://${host}`));
}
