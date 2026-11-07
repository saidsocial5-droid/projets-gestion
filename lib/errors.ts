export type ActionError = "transition_not_allowed" | "dependency_cycle" | "forbidden" | "conflict" | "generic";
export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: ActionError };

/** Maps a PostgREST / Postgres error to a message key. */
export function toActionError(e: { code?: string; message?: string; hint?: string } | null): ActionError {
  if (!e) return "generic";
  if (e.code === "P0001" && (e.hint === "workflow_transition" || e.message?.includes("transition not allowed"))) {
    return "transition_not_allowed";
  }
  if (e.message?.includes("dependency cycle")) return "dependency_cycle";
  if (e.code === "42501" || e.message?.includes("row-level security")) return "forbidden";
  return "generic";
}
