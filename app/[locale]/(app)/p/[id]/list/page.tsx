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
import { ListFilters } from "@/components/ListFilters";
import { filterTasks } from "@/lib/filters";
import { getSession } from "@/lib/session";
import type { CustomField, FieldValue } from "@/lib/types";

function fieldText(f: CustomField, v: FieldValue | undefined, locale: string): string {
  if (v === undefined) return "";
  if (f.type === "single_select") return f.options.find((o) => o.id === v)?.label ?? "";
  if (f.type === "multi_select") return (v as string[]).map((id) => f.options.find((o) => o.id === id)?.label).filter(Boolean).join("، ");
  if (f.type === "date") return formatDate(v as string, locale);
  return String(v);
}
import type { Task } from "@/lib/types";

export default async function ListPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ locale, id }, query] = await Promise.all([params, searchParams]);
  const taskId = query.task;
  const data = await getProjectData(id);
  if (!data) notFound();
  const t = await getTranslations();
  const statusById = new Map(data.statuses.map((s) => [s.id, s]));
  const personById = new Map(data.people.map((p) => [p.id, p]));
  const blocked = blockedTasks(data);
  const session = (await getSession())!;
  const visible = filterTasks(data.tasks, query, session.userId, data.values);
  const filtering = Object.keys(query).some((k) => k !== "task");
  const cols = data.fields.slice(0, 3);
  const grid = { gridTemplateColumns: `1fr 9rem 9rem 6rem${cols.map(() => " 8rem").join("")}` };

  const groups: { id: string | null; name: string; tasks: Task[] }[] = [];
  const unsectioned = visible.filter((x) => !x.section_id);
  if (unsectioned.length) groups.push({ id: null, name: "—", tasks: unsectioned });
  for (const s of data.sections) {
    const tasks = visible.filter((x) => x.section_id === s.id);
    if (!filtering || tasks.length) groups.push({ id: s.id, name: s.name, tasks });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ListFilters statuses={data.statuses} people={data.people} fields={data.fields} locale={locale} shown={visible.length} total={data.tasks.length} />
      {groups.map((g) => (
        <section key={g.id ?? "none"} className="surface overflow-hidden rounded-xl">
          <h2 className="flex border-b border-line bg-black/[0.02] px-4 py-2 text-sm font-semibold dark:bg-white/[0.03]">
            <span className="flex-1">{g.name}</span>
            {cols.length > 0 && <span className="hidden gap-4 text-xs font-normal text-muted lg:grid" style={{ gridTemplateColumns: cols.map(() => "8rem").join(" ") }}>{cols.map((f) => <span key={f.id} className="truncate">{f.name}</span>)}</span>}
          </h2>
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
                    style={cols.length ? grid : undefined}
                    className={`grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2 text-sm hover:bg-black/[0.03] sm:grid-cols-[1fr_9rem_9rem_6rem] dark:hover:bg-white/[0.04] ${cols.length ? "max-lg:!grid-cols-[1fr_auto] sm:max-lg:!grid-cols-[1fr_9rem_9rem_6rem]" : ""} ${taskId === task.id ? "bg-brand-50 dark:bg-brand-900/40" : ""}`}
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
                    {cols.map((f) => (
                      <span key={f.id} className="hidden truncate text-muted lg:block">{fieldText(f, data.values.get(task.id)?.get(f.id), locale)}</span>
                    ))}
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
