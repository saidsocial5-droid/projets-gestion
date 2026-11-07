import { notFound } from "next/navigation";
import { getProjectData } from "@/lib/project";
import { Board } from "@/components/Board";
import { TaskPanelSlot } from "@/components/TaskPanelSlot";

export default async function BoardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ task?: string }> }) {
  const [{ id }, { task: taskId }] = await Promise.all([params, searchParams]);
  const data = await getProjectData(id);
  if (!data) notFound();
  return (
    <>
      <Board
        projectId={id}
        statuses={data.statuses}
        transitions={data.transitions}
        restrict={data.restrict}
        tasks={data.tasks}
        people={data.people}
        canEdit={data.canEdit}
        defaultSectionId={data.sections[0]?.id ?? null}
      />
      <TaskPanelSlot data={data} taskId={taskId} />
    </>
  );
}
