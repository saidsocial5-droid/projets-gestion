import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { blockedTasks, getProjectData } from "@/lib/project";
import { createSection, createTask } from "@/lib/actions";
import { statusName } from "@/lib/status";
import { formatDate, isOverdue } from "@/lib/dates";
import { AddRow } from "@/components/AddRow";
import { StatusBadge } from "@/components/StatusBadge";
import { TaskPanelSlot } from "@/components/TaskPanelSlot";
import type { Task } from "@/lib/types";

export default async function ListPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ task?: string }> }) {
  const [{ locale, id }, { task: taskId }] = await Promise.all([params, searchParams]);
  const data = await getProjectData(id);
  if (!data) notFound();
  const t = await getTranslations();
  const statusById = new Map(data.statuses.map((s) => [s.id, s]));
  const personById = new Map(data.people.map((p) => [p.id, p]));
  const blocked = blockedTasks(data);

  const groups: { id: string | null; name: string; tasks: Task[] }[] = [];
  const unsectioned = data.tasks.filter((x) => !x.section_id);
  if (unsectioned.length) groups.push({ id: null, name: "—", tasks: unsectioned });
  for (const s of data.sections) groups.push({ id: s.id, name: s.name, tasks: data.tasks.filter((x) => x.section_id === s.id) });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {groups.map((g) => (
        <section key={g.id ?? "none"} className="surface overflow-hidden rounded-xl">
          <h2 className="border-b border-line bg-black/[0.02] px-4 py-2 text-sm font-semibold dark:bg-white/[0.03]">{g.name}</h2>
          {g.tasks.length === 0 && <p className="px-4 py-3 text-sm text-muted">{t("project.emptySection")}</p>}
          <ul className="divide-y divide-[var(--border)]">
            {g.tasks.map((task) => {
              const st = statusById.get(task.status_id);
              const overdue = isOverdue(task.due_date, task.completed_at);
              return (
                <li key={task.id}>
                  <Link
                    href={`/p/${id}/list?task=${task.id}`}
                    scroll={false}
                    className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2 text-sm hover:bg-black/[0.03] sm:grid-cols-[1fr_9rem_9rem_6rem] dark:hover:bg-white/[0.04] ${taskId === task.id ? "bg-brand-50 dark:bg-brand-900/40" : ""}`}
                  >
                    <span className={task.completed_at ? "text-muted line-through" : ""}>
                      {task.title}
                      {blocked.has(task.id) && (
                        <span title={t("deps.blockedBy", { tasks: blocked.get(task.id)!.join("، ") })} className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-100">⛔ {t("deps.blocked")}</span>
                      )}
                    </span>
                    <span className="justify-self-end sm:justify-self-start">{st && <StatusBadge name={statusName(st, locale)} color={st.color} />}</span>
                    <span className="truncate text-muted">{task.assignee_id ? personById.get(task.assignee_id)?.full_name : ""}</span>
                    <span className={`justify-self-end sm:justify-self-start ${overdue ? "font-medium text-rose-600" : "text-muted"}`}>
                      {task.due_date ? formatDate(task.due_date, locale) : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {data.canEdit && <AddRow className="border-t border-line" placeholder={t("project.addTask")} onAdd={createTask.bind(null, id, g.id)} />}
        </section>
      ))}
      {data.canEdit && <AddRow className="surface rounded-xl" placeholder={t("project.addSection")} onAdd={createSection.bind(null, id)} />}
      <TaskPanelSlot data={data} taskId={taskId} />
    </div>
  );
}
