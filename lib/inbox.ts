import "server-only";
import { createClient } from "./supabase/server";

export interface InboxItem {
  id: string;
  read_at: string | null;
  created_at: string;
  activity: {
    action: string;
    payload: Record<string, string | null>;
    actor: { full_name: string } | null;
    task: { id: string; title: string } | null;
    project: { id: string; name: string } | null;
  };
}

export async function getInbox(userId: string, limit = 50): Promise<InboxItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, read_at, created_at, activity:activities(action, payload, actor:profiles(full_name), task:tasks(id, title), project:projects(id, name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as InboxItem[];
}

export async function unreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}
