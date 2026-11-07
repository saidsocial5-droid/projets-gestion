export type StatusCategory = "todo" | "in_progress" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";
export type WorkspaceRole = "admin" | "member" | "guest";

export interface Status {
  id: string;
  name_ar: string;
  name_fr: string;
  color: string;
  category: StatusCategory;
  rank: string;
}

export interface Transition {
  from_status_id: string | null;
  to_status_id: string;
}

export interface Task {
  id: string;
  project_id: string;
  section_id: string | null;
  parent_task_id: string | null;
  status_id: string;
  assignee_id: string | null;
  title: string;
  description: { text?: string };
  priority: Priority | null;
  start_date: string | null;
  due_date: string | null;
  completed_at: string | null;
  rank: string;
  board_rank: string;
  updated_at: string;
}

export interface Section {
  id: string;
  name: string;
  rank: string;
}

export interface Person {
  id: string;
  full_name: string;
}

export interface Project {
  id: string;
  name: string;
  privacy: "private" | "workspace";
  due_date: string | null;
  color: string;
  workflow_id: string;
}
