import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { WorkspaceRole } from "./types";

export interface SessionContext {
  userId: string;
  email: string;
  workspaceId: string;
  role: WorkspaceRole;
}

/** The signed-in user and their workspace membership, or null. Cached per request. */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!data) return { userId: user.id, email: user.email ?? "", workspaceId: "", role: "guest" };
  return { userId: user.id, email: user.email ?? "", workspaceId: data.workspace_id, role: data.role };
});
