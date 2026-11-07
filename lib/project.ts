import "server-only";
import { createClient } from "./supabase/server";
import type { CustomField, FieldValue, Person, Project, Section, Status, Task, Transition } from "./types";

export interface ProjectData {
  project: Project;
  restrict: boolean;
  statuses: Status[];
  transitions: Transition[];
  sections: Section[];
  tasks: Task[];
  people: Person[];
  canEdit: boolean;
  canAdmin: boolean;
  dependencies: { task_id: string; depends_on_task_id: string }[];
  fields: CustomField[];
  /** task id → field id → value */
  values: Map<string, Map<string, FieldValue>>;
}

const TASK_COLS =
  "id, project_id, section_id, parent_task_id, status_id, assignee_id, title, description, priority, start_date, due_date, completed_at, rank, board_rank, updated_at";

/** Everything the list, board and task panel need, read as the signed-in user (RLS). Null if not visible. */
export async function getProjectData(id: string): Promise<ProjectData | null> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects").select("id, name, privacy, due_date, color, workflow_id, workspace_id").eq("id", id).maybeSingle();
  if (!project) return null;

  const [wf, statuses, transitions, sections, tasks, members, projectMembers, role, admin] = await Promise.all([
    supabase.from("workflows").select("restrict_transitions").eq("id", project.workflow_id).single(),
    supabase.from("workflow_statuses").select("id, name_ar, name_fr, color, category, rank").eq("workflow_id", project.workflow_id).order("rank"),
    supabase.from("workflow_transitions").select("from_status_id, to_status_id").eq("workflow_id", project.workflow_id),
    supabase.from("sections").select("id, name, rank").eq("project_id", id).order("rank"),
    supabase.from("tasks").select(TASK_COLS).eq("project_id", id).is("parent_task_id", null).order("rank"),
    supabase.from("workspace_members").select("role, profiles(id, full_name)").eq("workspace_id", project.workspace_id).neq("role", "guest"),
    supabase.from("project_members").select("profiles(id, full_name)").eq("project_id", id),
    supabase.rpc("can_edit_project", { p: id }),
    supabase.rpc("can_admin_project", { p: id }),
  ]);

  const people = new Map<string, Person>();
  for (const m of [...(members.data ?? []), ...(projectMembers.data ?? [])] as unknown as { profiles: Person | null }[]) {
    if (m.profiles) people.set(m.profiles.id, m.profiles);
  }

  const ids = (tasks.data ?? []).map((t) => t.id);
  const [{ data: deps }, { data: pf }, { data: vals }] = await Promise.all([
    ids.length ? supabase.from("task_dependencies").select("task_id, depends_on_task_id").in("task_id", ids) : Promise.resolve({ data: [] }),
    supabase.from("project_fields").select("rank, field:custom_fields(id, name, type, options:custom_field_options(id, label, color, rank))").eq("project_id", id).order("rank"),
    ids.length ? supabase.from("task_field_values").select("task_id, field_id, value").in("task_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const fields = ((pf ?? []) as unknown as { field: CustomField }[]).map((r) => ({
    ...r.field,
    options: [...r.field.options].sort((a, b) => (a.rank < b.rank ? -1 : 1)),
  }));
  const values = new Map<string, Map<string, FieldValue>>();
  for (const v of (vals ?? []) as { task_id: string; field_id: string; value: FieldValue }[]) {
    if (!values.has(v.task_id)) values.set(v.task_id, new Map());
    values.get(v.task_id)!.set(v.field_id, v.value);
  }

  return {
    fields,
    values,
    dependencies: (deps ?? []) as { task_id: string; depends_on_task_id: string }[],
    project: project as Project,
    restrict: wf.data?.restrict_transitions ?? false,
    statuses: (statuses.data ?? []) as Status[],
    transitions: (transitions.data ?? []) as Transition[],
    sections: (sections.data ?? []) as Section[],
    tasks: (tasks.data ?? []) as Task[],
    people: [...people.values()].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    canEdit: role.data === true,
    canAdmin: admin.data === true,
  };
}

/** Open tasks whose predecessors are not all done: task id → titles of the unfinished predecessors. */
export function blockedTasks(data: ProjectData): Map<string, string[]> {
  const byId = new Map(data.tasks.map((t) => [t.id, t]));
  const out = new Map<string, string[]>();
  for (const d of data.dependencies) {
    const task = byId.get(d.task_id);
    const pre = byId.get(d.depends_on_task_id);
    if (task && !task.completed_at && pre && !pre.completed_at) out.set(task.id, [...(out.get(task.id) ?? []), pre.title]);
  }
  return out;
}
