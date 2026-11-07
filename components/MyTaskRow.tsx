import { Link } from "@/i18n/navigation";
import { formatDate, isOverdue } from "@/lib/dates";
import type { MyTask } from "@/lib/my-tasks";

export function MyTaskRow({ task, locale }: { task: MyTask; locale: string }) {
  const target = task.parent_task_id ?? task.id;
  return (
    <Link href={`/p/${task.project.id}/list?task=${target}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <span className="min-w-0">
        <span className="block truncate">{task.title}</span>
        <span className="block truncate text-xs text-muted">{task.project.name}</span>
      </span>
      {task.due_date && (
        <span className={`shrink-0 text-xs ${isOverdue(task.due_date, null) ? "font-medium text-rose-600" : "text-muted"}`}>{formatDate(task.due_date, locale)}</span>
      )}
    </Link>
  );
}
