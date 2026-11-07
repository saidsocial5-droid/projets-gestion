import { todayInMorocco } from "./dates";
import type { FieldValue, Task } from "./types";

export type ListParams = Record<string, string | undefined>;

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Applies the list filters from the URL. Pure, so it is easy to test. */
export function filterTasks(tasks: Task[], params: ListParams, userId: string, values: Map<string, Map<string, FieldValue>>, today = todayInMorocco()): Task[] {
  const fieldFilters = Object.entries(params).filter(([k, v]) => k.startsWith("f_") && v) as [string, string][];
  return tasks.filter((t) => {
    if (params.status && t.status_id !== params.status) return false;
    if (params.assignee === "me" && t.assignee_id !== userId) return false;
    if (params.assignee === "none" && t.assignee_id) return false;
    if (params.assignee && !["me", "none"].includes(params.assignee) && t.assignee_id !== params.assignee) return false;
    if (params.done === "hide" && t.completed_at) return false;
    if (params.due === "overdue" && !(t.due_date && !t.completed_at && t.due_date < today)) return false;
    if (params.due === "week" && !(t.due_date && t.due_date >= today && t.due_date <= addDays(today, 7))) return false;
    if (params.due === "none" && t.due_date) return false;
    for (const [k, option] of fieldFilters) {
      const v = values.get(t.id)?.get(k.slice(2));
      if (!(v === option || (Array.isArray(v) && v.includes(option)))) return false;
    }
    return true;
  });
}
