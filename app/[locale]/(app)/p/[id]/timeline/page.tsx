import { notFound } from "next/navigation";
import { getProjectData } from "@/lib/project";
import { Timeline } from "@/components/Timeline";
import { TaskPanelSlot } from "@/components/TaskPanelSlot";

export default async function TimelinePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ task?: string }> }) {
  const [{ id }, { task: taskId }] = await Promise.all([params, searchParams]);
  const data = await getProjectData(id);
  if (!data) notFound();
  return (
    <>
      <Timeline projectId={id} tasks={data.tasks} sections={data.sections} statuses={data.statuses} dependencies={data.dependencies} canEdit={data.canEdit} />
      <TaskPanelSlot data={data} taskId={taskId} />
    </>
  );
}
