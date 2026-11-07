import "server-only";
import { createClient } from "./supabase/server";
import { todayInMorocco } from "./dates";

export interface MyTask {
  id: string;
  title: string;
  due_date: string | null;
  parent_task_id: string | null;
  project: { id: string; name: string };
}
export type Bucket = "overdue" | "today" | "week" | "later" | "noDate";

export async function getMyOpenTasks(userId: string): Promise<MyTask[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, due_date, parent_task_id, project:projects!inner(id, name, archived_at)")
    .eq("assignee_id", userId)
    .is("completed_at", null)
    .is("project.archived_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at");
  return (data ?? []) as unknown as MyTask[];
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function bucketOf(due: string | null, today = todayInMorocco()): Bucket {
  if (!due) return "noDate";
  if (due < today) return "overdue";
  if (due === today) return "today";
  if (due <= addDays(today, 7)) return "week";
  return "later";
}
