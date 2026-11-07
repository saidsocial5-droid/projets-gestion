import { TaskPanel } from "./TaskPanel";
import { allowedTargets } from "@/lib/status";
import type { ProjectData } from "@/lib/project";

/** Renders the side panel when ?task=<id> is in the URL. */
export function TaskPanelSlot({ data, taskId }: { data: ProjectData; taskId?: string }) {
  const task = taskId ? data.tasks.find((t) => t.id === taskId) : undefined;
  if (!task) return null;
  const allowed = [...allowedTargets(task.status_id, data.restrict, data.statuses, data.transitions)];
  return <TaskPanel task={task} statuses={data.statuses} allowed={allowed} people={data.people} canEdit={data.canEdit} />;
}
