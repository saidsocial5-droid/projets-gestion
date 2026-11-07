import { TaskPanel } from "./TaskPanel";
import { TaskSubtasks } from "./TaskSubtasks";
import { TaskAttachments } from "./TaskAttachments";
import { TaskConversation } from "./TaskConversation";
import { TaskDependencies } from "./TaskDependencies";
import { allowedTargets } from "@/lib/status";
import { getTaskDetail } from "@/lib/task-detail";
import { getSession } from "@/lib/session";
import type { ProjectData } from "@/lib/project";

/** Renders the side panel when ?task=<id> is in the URL. */
export async function TaskPanelSlot({ data, taskId }: { data: ProjectData; taskId?: string }) {
  const task = taskId ? data.tasks.find((t) => t.id === taskId) : undefined;
  if (!task) return null;
  const session = await getSession();
  const detail = await getTaskDetail(task, session!.userId);
  const allowed = [...allowedTargets(task.status_id, data.restrict, data.statuses, data.transitions)];
  return (
    <TaskPanel key={task.id} task={task} statuses={data.statuses} allowed={allowed} people={data.people} canEdit={data.canEdit} following={detail.following}>
      <TaskSubtasks parent={task} subtasks={detail.subtasks} canEdit={data.canEdit} />
      <TaskDependencies
        task={task}
        predecessors={data.dependencies.filter((d) => d.task_id === task.id).map((d) => data.tasks.find((x) => x.id === d.depends_on_task_id)).filter((x) => !!x)}
        successors={data.dependencies.filter((d) => d.depends_on_task_id === task.id).map((d) => data.tasks.find((x) => x.id === d.task_id)).filter((x) => !!x)}
        candidates={data.tasks.filter((x) => x.id !== task.id && !data.dependencies.some((d) => d.task_id === task.id && d.depends_on_task_id === x.id))}
        canEdit={data.canEdit}
      />
      <TaskAttachments projectId={task.project_id} taskId={task.id} files={detail.attachments} canUpload={detail.canComment} userId={session!.userId} canAdmin={data.canAdmin} />
      <TaskConversation
        taskId={task.id}
        comments={detail.comments}
        activities={detail.activities}
        people={data.people}
        statuses={data.statuses}
        userId={session!.userId}
        canComment={detail.canComment}
        canAdmin={data.canAdmin}
      />
    </TaskPanel>
  );
}
