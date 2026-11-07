"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { generateKeyBetween } from "fractional-indexing";
import { createClient } from "./supabase/server";
import { getSession } from "./session";
import { toActionError, type ActionResult } from "./errors";
import type { Priority } from "./types";

const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

export async function sendMagicLink(_prev: unknown, form: FormData): Promise<{ status: "idle" | "sent" | "error" }> {
  const email = str(form, "email").toLowerCase();
  const locale = str(form, "locale") === "fr" ? "fr" : "ar";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { status: "error" };
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?locale=${locale}` },
  });
  return { status: error ? "error" : "sent" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// projects and sections
// ---------------------------------------------------------------------------

export async function createProject(form: FormData): Promise<ActionResult<string>> {
  const name = str(form, "name");
  if (!name || name.length > 200) return { ok: false, error: "generic" };
  const privacy = str(form, "privacy") === "private" ? "private" : "workspace";
  const due = str(form, "due_date") || null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_project", {
    p_name: name,
    p_privacy: privacy,
    p_due_date: due,
    p_section_name: str(form, "section_name") || "المهام",
  });
  if (error) return { ok: false, error: toActionError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: data as string };
}

export async function createSection(projectId: string, name: string): Promise<ActionResult> {
  name = name.trim();
  if (!name) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("sections").select("rank").eq("project_id", projectId)
    .order("rank", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("sections").insert({
    project_id: projectId, name, rank: generateKeyBetween(last?.rank ?? null, null),
  });
  if (error) return { ok: false, error: toActionError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

export async function createTask(projectId: string, sectionId: string | null, title: string, parentId: string | null = null): Promise<ActionResult<string>> {
  title = title.trim();
  if (!title || title.length > 500) return { ok: false, error: "generic" };
  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("workflow_id").eq("id", projectId).maybeSingle();
  if (!project) return { ok: false, error: "forbidden" };
  const { data: first } = await supabase
    .from("workflow_statuses").select("id").eq("workflow_id", project.workflow_id)
    .order("rank").limit(1).single();

  let rankQ = supabase.from("tasks").select("rank").eq("project_id", projectId).order("rank", { ascending: false }).limit(1);
  if (parentId) rankQ = rankQ.eq("parent_task_id", parentId);
  else rankQ = (sectionId ? rankQ.eq("section_id", sectionId) : rankQ.is("section_id", null)).is("parent_task_id", null);
  const { data: lastRank } = await rankQ.maybeSingle();
  const { data: lastBoard } = await supabase
    .from("tasks").select("board_rank").eq("project_id", projectId).eq("status_id", first!.id)
    .order("board_rank", { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await supabase.from("tasks").insert({
    project_id: projectId,
    section_id: parentId ? null : sectionId,
    parent_task_id: parentId,
    status_id: first!.id,
    title,
    rank: generateKeyBetween(lastRank?.rank ?? null, null),
    board_rank: generateKeyBetween(lastBoard?.board_rank ?? null, null),
  }).select("id").single();
  if (error) return { ok: false, error: toActionError(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: data.id };
}

export interface TaskPatch {
  title?: string;
  status_id?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  priority?: Priority | null;
  description?: string;
}

/** Updates a task. `prevUpdatedAt` is an optimistic lock: the update only applies if nobody changed the task meanwhile. */
export async function updateTask(id: string, patch: TaskPatch, prevUpdatedAt: string): Promise<ActionResult> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t || t.length > 500) return { ok: false, error: "generic" };
    row.title = t;
  }
  if (patch.status_id !== undefined) row.status_id = patch.status_id;
  if (patch.assignee_id !== undefined) row.assignee_id = patch.assignee_id || null;
  if (patch.due_date !== undefined) row.due_date = patch.due_date || null;
  if (patch.priority !== undefined) row.priority = patch.priority && PRIORITIES.includes(patch.priority) ? patch.priority : null;
  if (patch.description !== undefined) row.description = { text: patch.description };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks").update(row).eq("id", id).eq("updated_at", prevUpdatedAt).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) {
    const { data: still } = await supabase.from("tasks").select("id").eq("id", id).maybeSingle();
    return { ok: false, error: still ? "conflict" : "forbidden" };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Moves a task to a board column, placed between two neighbours (fractional ranks). The database enforces the workflow. */
export async function moveTask(id: string, toStatusId: string, beforeRank: string | null, afterRank: string | null): Promise<ActionResult> {
  let boardRank: string;
  try {
    boardRank = generateKeyBetween(beforeRank, afterRank);
  } catch {
    return { ok: false, error: "generic" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks").update({ status_id: toStatusId, board_rank: boardRank }).eq("id", id).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// members (M1: invitation is claimed on first sign-in with that email)
// ---------------------------------------------------------------------------

export async function inviteMember(_prev: unknown, form: FormData): Promise<{ status: "idle" | "ok" | "error" }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { status: "error" };
  const email = str(form, "email").toLowerCase();
  const role = str(form, "role");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !["admin", "member", "guest"].includes(role)) return { status: "error" };
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({
    workspace_id: session.workspaceId, email, workspace_role: role,
  });
  if (error) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "ok" };
}

// ---------------------------------------------------------------------------
// subtasks, comments, attachments, followers, notifications (M2a)
// ---------------------------------------------------------------------------

/** Ticks or unticks a subtask: moves it to the workflow's first 'done' status or back to its first status. */
export async function toggleSubtask(id: string, done: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("project_id, projects(workflow_id)").eq("id", id).maybeSingle();
  const wf = (task as unknown as { projects: { workflow_id: string } } | null)?.projects.workflow_id;
  if (!wf) return { ok: false, error: "forbidden" };
  let q = supabase.from("workflow_statuses").select("id").eq("workflow_id", wf).order("rank").limit(1);
  if (done) q = q.eq("category", "done");
  const { data: status } = await q.maybeSingle();
  if (!status) return { ok: false, error: "generic" };
  const { data, error } = await supabase.from("tasks").update({ status_id: status.id }).eq("id", id).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addComment(taskId: string, text: string, mentions: string[]): Promise<ActionResult> {
  text = text.trim();
  if (!text || text.length > 10000) return { ok: false, error: "generic" };
  const ids = [...new Set(mentions)].filter((m) => /^[0-9a-f-]{36}$/.test(m)).slice(0, 50);
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({ task_id: taskId, body: { text, mentions: ids } });
  if (error) return { ok: false, error: toActionError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteComment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("comments").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Records a file the browser already uploaded to Storage (the storage policy checked the upload). */
export async function recordAttachment(taskId: string, path: string, fileName: string, mime: string, size: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("project_id").eq("id", taskId).maybeSingle();
  if (!task || !path.startsWith(`${task.project_id}/${taskId}/`)) return { ok: false, error: "forbidden" };
  const { error } = await supabase.from("attachments").insert({
    task_id: taskId, storage_path: path, file_name: fileName.slice(0, 255), mime_type: mime || "application/octet-stream", size_bytes: size,
  });
  if (error) {
    await supabase.storage.from("attachments").remove([path]);
    return { ok: false, error: toActionError(error) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteAttachment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("attachments").delete().eq("id", id).select("storage_path");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  await supabase.storage.from("attachments").remove([data[0].storage_path]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setFollowing(taskId: string, follow: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { error } = follow
    ? await supabase.from("followers").upsert({ task_id: taskId, user_id: session.userId }, { ignoreDuplicates: true })
    : await supabase.from("followers").delete().eq("task_id", taskId).eq("user_id", session.userId);
  if (error) return { ok: false, error: toActionError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
  revalidatePath("/", "layout");
}
