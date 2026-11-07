import "server-only";
import { createClient } from "./supabase/server";
import type { Task } from "./types";

export interface CommentRow {
  id: string;
  author_id: string | null;
  body: { text?: string; mentions?: string[] };
  created_at: string;
  edited_at: string | null;
}
export interface ActivityRow {
  id: string;
  actor_id: string | null;
  action: string;
  payload: Record<string, string | null>;
  created_at: string;
}
export interface AttachmentRow {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploader_id: string | null;
  storage_path: string;
  url: string | null;
}
export interface TaskDetail {
  subtasks: Task[];
  comments: CommentRow[];
  activities: ActivityRow[];
  attachments: AttachmentRow[];
  following: boolean;
  canComment: boolean;
}

const TASK_COLS =
  "id, project_id, section_id, parent_task_id, status_id, assignee_id, title, description, priority, start_date, due_date, completed_at, rank, board_rank, updated_at";

export async function getTaskDetail(task: Task, userId: string): Promise<TaskDetail> {
  const supabase = await createClient();
  const [subtasks, comments, activities, attachments, follow, canComment] = await Promise.all([
    supabase.from("tasks").select(TASK_COLS).eq("parent_task_id", task.id).order("rank"),
    supabase.from("comments").select("id, author_id, body, created_at, edited_at").eq("task_id", task.id).order("created_at"),
    supabase.from("activities").select("id, actor_id, action, payload, created_at").eq("task_id", task.id).neq("action", "comment.created").order("created_at"),
    supabase.from("attachments").select("id, file_name, mime_type, size_bytes, uploader_id, storage_path").eq("task_id", task.id).order("created_at"),
    supabase.from("followers").select("user_id").eq("task_id", task.id).eq("user_id", userId).maybeSingle(),
    supabase.rpc("can_comment_project", { p: task.project_id }),
  ]);

  const files = (attachments.data ?? []) as Omit<AttachmentRow, "url">[];
  let urls = new Map<string, string>();
  if (files.length) {
    const { data } = await supabase.storage.from("attachments").createSignedUrls(files.map((f) => f.storage_path), 3600);
    urls = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path!, d.signedUrl as string] as [string, string]));
  }

  return {
    subtasks: (subtasks.data ?? []) as Task[],
    comments: (comments.data ?? []) as CommentRow[],
    activities: (activities.data ?? []) as ActivityRow[],
    attachments: files.map((f) => ({ ...f, url: urls.get(f.storage_path) ?? null })),
    following: !!follow.data,
    canComment: canComment.data === true,
  };
}
