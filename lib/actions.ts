"use server";

import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import { createClient } from "./supabase/server";
import { getSession } from "./session";
import { toActionError, type ActionResult } from "./errors";
import type { Priority } from "./types";
import { appOrigin, sendSignInEmail } from "./mail";
import { EXPENSE_CATEGORIES, parseAmount } from "./money";

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
  const origin = await appOrigin();
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
// members and guests (M2b). An invitation is claimed when the invitee first
// signs in with that email; the sign-in email is sent right away.
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
type FormResult = { status: "idle" | "ok" | "error"; message?: string };

function lastAdmin(e: { hint?: string } | null) {
  return e?.hint === "last_admin";
}

export async function inviteMember(_prev: unknown, form: FormData): Promise<FormResult> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { status: "error" };
  const email = str(form, "email").toLowerCase();
  const role = str(form, "role");
  const locale = str(form, "locale") === "fr" ? "fr" : "ar";
  if (!EMAIL_RE.test(email) || !["admin", "member", "guest"].includes(role)) return { status: "error" };
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({ workspace_id: session.workspaceId, email, workspace_role: role });
  if (error) return { status: "error", message: error.code === "23505" ? "already_invited" : undefined };
  await sendSignInEmail(email, locale);
  revalidatePath("/", "layout");
  return { status: "ok" };
}

/** Invites someone by email to one project: a guest of the workspace with a project role. */
export async function inviteToProject(projectId: string, _prev: unknown, form: FormData): Promise<FormResult> {
  const session = await getSession();
  if (!session) return { status: "error" };
  const email = str(form, "email").toLowerCase();
  const role = str(form, "role");
  const locale = str(form, "locale") === "fr" ? "fr" : "ar";
  if (!EMAIL_RE.test(email) || !["admin", "editor", "commenter", "viewer"].includes(role)) return { status: "error" };
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({
    workspace_id: session.workspaceId, email, workspace_role: "guest", project_id: projectId, project_role: role,
  });
  if (error) return { status: "error", message: error.code === "23505" ? "already_invited" : undefined };
  await sendSignInEmail(email, locale);
  revalidatePath("/", "layout");
  return { status: "ok" };
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setWorkspaceRole(userId: string, role: string): Promise<ActionResult | { ok: false; error: "last_admin" }> {
  const session = await getSession();
  if (!session || !["admin", "member", "guest"].includes(role)) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspace_members").update({ role }).eq("workspace_id", session.workspaceId).eq("user_id", userId).select("user_id");
  if (lastAdmin(error)) return { ok: false, error: "last_admin" };
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeWorkspaceMember(userId: string): Promise<ActionResult | { ok: false; error: "last_admin" }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "forbidden" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("workspace_members").delete().eq("workspace_id", session.workspaceId).eq("user_id", userId).select("user_id");
  if (lastAdmin(error)) return { ok: false, error: "last_admin" };
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProject(projectId: string, _prev: unknown, form: FormData): Promise<FormResult> {
  const name = str(form, "name");
  const privacy = str(form, "privacy");
  if (!name || name.length > 200 || !["private", "workspace"].includes(privacy)) return { status: "error" };
  const row: Record<string, unknown> = { name, privacy, due_date: str(form, "due_date") || null };
  if (form.has("start_date")) row.start_date = str(form, "start_date") || null;
  if (form.has("donor_id")) row.donor_id = str(form, "donor_id") || null;
  if (form.has("budget")) {
    const raw = str(form, "budget");
    const cents = raw ? parseAmount(raw) : null;
    if (raw && cents === null) return { status: "error" };
    row.budget_cents = cents;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").update(row).eq("id", projectId).select("id");
  if (error || !data.length) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "ok" };
}

export async function addProjectMember(projectId: string, userId: string, role: string): Promise<ActionResult> {
  if (!["admin", "editor", "commenter", "viewer"].includes(role)) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").upsert({ project_id: projectId, user_id: userId, role });
  if (error) return { ok: false, error: toActionError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setProjectMemberRole(projectId: string, userId: string, role: string): Promise<ActionResult | { ok: false; error: "last_admin" }> {
  if (!["admin", "editor", "commenter", "viewer"].includes(role)) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_members").update({ role }).eq("project_id", projectId).eq("user_id", userId).select("user_id");
  if (lastAdmin(error)) return { ok: false, error: "last_admin" };
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeProjectMember(projectId: string, userId: string): Promise<ActionResult | { ok: false; error: "last_admin" }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", userId).select("user_id");
  if (lastAdmin(error)) return { ok: false, error: "last_admin" };
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
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

// ---------------------------------------------------------------------------
// status updates (M2c)
// ---------------------------------------------------------------------------

const HEALTH = ["on_track", "at_risk", "off_track", "on_hold", "complete"];

export async function saveStatusUpdate(projectId: string, _prev: unknown, form: FormData): Promise<{ status: "idle" | "ok" | "error"; at?: number }> {
  const status = str(form, "status");
  const title = str(form, "title");
  const text = str(form, "body");
  const publish = str(form, "intent") !== "draft";
  if (!HEALTH.includes(status) || !title || title.length > 200 || text.length > 20000) return { status: "error" };
  const supabase = await createClient();
  const { error } = await supabase.from("status_updates").insert({
    project_id: projectId, status, title, body: { text }, published_at: publish ? new Date().toISOString() : null,
  });
  if (error) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "ok", at: Date.now() };
}

export async function publishStatusUpdate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("status_updates").update({ published_at: new Date().toISOString() }).eq("id", id).is("published_at", null).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteStatusUpdate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("status_updates").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// donors, expenses, indicators, reports (M2d)
// ---------------------------------------------------------------------------

export async function saveDonor(id: string | null, _prev: unknown, form: FormData): Promise<FormResult> {
  const session = await getSession();
  const name = str(form, "name");
  if (!session || !name || name.length > 200) return { status: "error" };
  const row = { name, contact_name: str(form, "contact_name") || null, contact_email: str(form, "contact_email") || null, notes: str(form, "notes") || null };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("donors").update(row).eq("id", id)
    : await supabase.from("donors").insert({ ...row, workspace_id: session.workspaceId });
  if (error) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "ok" };
}

export async function addExpense(projectId: string, _prev: unknown, form: FormData): Promise<FormResult> {
  const cents = parseAmount(str(form, "amount"));
  const label = str(form, "label");
  const category = str(form, "category");
  const spentOn = str(form, "spent_on");
  if (cents === null) return { status: "error", message: "invalid_amount" };
  if (!label || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || !(EXPENSE_CATEGORIES as readonly string[]).includes(category)) return { status: "error" };
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("currency").eq("id", projectId).maybeSingle();
  const { error } = await supabase.from("expenses").insert({
    project_id: projectId, amount_cents: cents, currency: project?.currency ?? "MAD", spent_on: spentOn, category, label: label.slice(0, 300),
  });
  if (error) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "ok" };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("expenses").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

function num(form: FormData, key: string): number | null {
  const raw = str(form, key).replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export async function addIndicator(projectId: string, _prev: unknown, form: FormData): Promise<FormResult> {
  const nameAr = str(form, "name_ar");
  const nameFr = str(form, "name_fr");
  const target = num(form, "target");
  const baseline = num(form, "baseline") ?? 0;
  if ((!nameAr && !nameFr) || target === null || Number.isNaN(target) || Number.isNaN(baseline)) return { status: "error" };
  const supabase = await createClient();
  const { data: last } = await supabase.from("indicators").select("rank").eq("project_id", projectId).order("rank", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("indicators").insert({
    project_id: projectId, name_ar: nameAr || nameFr, name_fr: nameFr || nameAr, unit: str(form, "unit"),
    baseline, target, current: baseline, rank: generateKeyBetween(last?.rank ?? null, null),
  });
  if (error) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "ok" };
}

export async function setIndicatorCurrent(id: string, value: number): Promise<ActionResult> {
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: "generic" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("indicators").update({ current: value }).eq("id", id).select("id");
  if (error) return { ok: false, error: toActionError(error) };
  if (!data.length) return { ok: false, error: "forbidden" };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createReport(_prev: unknown, form: FormData): Promise<FormResult & { id?: string }> {
  const session = await getSession();
  if (!session || session.role === "guest") return { status: "error" };
  const title = str(form, "title");
  const start = str(form, "period_start");
  const end = str(form, "period_end");
  const projectIds = form.getAll("project_ids").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x));
  if (!projectIds.length) return { status: "error", message: "no_projects" };
  if (!title || !start || !end || end < start) return { status: "error" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports").insert({
    workspace_id: session.workspaceId, title, period_start: start, period_end: end, project_ids: projectIds,
    donor_id: str(form, "donor_id") || null, locale: str(form, "locale") === "ar" ? "ar" : "fr",
  }).select("id").single();
  if (error) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "ok", id: data.id };
}

// ---------------------------------------------------------------------------
// workflow administration, profile (M2e)
// ---------------------------------------------------------------------------

const COLORS = ["gray", "blue", "amber", "green", "red"];
const CATEGORIES = ["todo", "in_progress", "done"];

export async function saveStatus(workflowId: string, id: string | null, _prev: unknown, form: FormData): Promise<FormResult> {
  const nameAr = str(form, "name_ar");
  const nameFr = str(form, "name_fr");
  const color = str(form, "color");
  const category = str(form, "category");
  if (!nameAr || !nameFr || !COLORS.includes(color) || !CATEGORIES.includes(category)) return { status: "error" };
  const supabase = await createClient();
  let error;
  if (id) {
    ({ error } = await supabase.from("workflow_statuses").update({ name_ar: nameAr, name_fr: nameFr, color, category }).eq("id", id));
  } else {
    const { data: last } = await supabase.from("workflow_statuses").select("rank").eq("workflow_id", workflowId).order("rank", { ascending: false }).limit(1).maybeSingle();
    ({ error } = await supabase.from("workflow_statuses").insert({ workflow_id: workflowId, name_ar: nameAr, name_fr: nameFr, color, category, rank: generateKeyBetween(last?.rank ?? null, null) }));
  }
  if (error) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "ok" };
}

/** Moves a status one place up or down by giving it a rank between its new neighbours. */
export async function moveStatus(workflowId: string, id: string, direction: -1 | 1): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: list } = await supabase.from("workflow_statuses").select("id, rank").eq("workflow_id", workflowId).order("rank");
  const rows = list ?? [];
  const i = rows.findIndex((r) => r.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= rows.length) return { ok: false, error: "generic" };
  const before = direction === -1 ? rows[j - 1]?.rank ?? null : rows[j].rank;
  const after = direction === -1 ? rows[j].rank : rows[j + 1]?.rank ?? null;
  const { error } = await supabase.from("workflow_statuses").update({ rank: generateKeyBetween(before, after) }).eq("id", id);
  if (error) return { ok: false, error: toActionError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeStatus(id: string, moveTo: string): Promise<ActionResult | { ok: false; error: "min_statuses" }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_status", { p_status: id, p_move_to: moveTo });
  if (error?.hint === "min_statuses") return { ok: false, error: "min_statuses" };
  if (error) return { ok: false, error: toActionError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveTransitions(workflowId: string, restrict: boolean, pairs: { from: string | null; to: string }[]): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_transitions", { p_workflow: workflowId, p_restrict: restrict, p_pairs: pairs.map((p) => ({ from: p.from ?? "", to: p.to })) });
  if (error) return { ok: false, error: toActionError(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProfile(_prev: unknown, form: FormData): Promise<FormResult & { locale?: string }> {
  const session = await getSession();
  const name = str(form, "full_name");
  const locale = str(form, "locale") === "fr" ? "fr" : "ar";
  if (!session || !name || name.length > 120) return { status: "error" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name, locale }).eq("id", session.userId);
  if (error) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "ok", locale };
}
