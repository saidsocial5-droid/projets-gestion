"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { removeProjectMember, removeWorkspaceMember, revokeInvitation, setProjectMemberRole, setWorkspaceRole } from "@/lib/actions";

type Result = { ok: boolean; error?: string };

function useAct() {
  const t = useTranslations("errors");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : t(r.error ?? "generic"));
    });
  return { error, pending, run };
}

const WS_ROLES = ["admin", "member", "guest"] as const;
const PROJECT_ROLES = ["admin", "editor", "commenter", "viewer"] as const;

export function WorkspaceMemberControls({ userId, role, self }: { userId: string; role: string; self: boolean }) {
  const t = useTranslations("members");
  const { error, pending, run } = useAct();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select aria-label={t("role")} defaultValue={role} disabled={pending} className="input w-auto py-1" onChange={(e) => run(() => setWorkspaceRole(userId, e.target.value))}>
        {WS_ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}`)}</option>)}
      </select>
      {!self && (
        <button type="button" disabled={pending} className="btn-ghost text-rose-600" onClick={() => confirm(t("confirmRemove")) && run(() => removeWorkspaceMember(userId))}>
          {t("remove")}
        </button>
      )}
      {error && <p role="alert" className="w-full text-end text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function ProjectMemberControls({ projectId, userId, role }: { projectId: string; userId: string; role: string }) {
  const t = useTranslations();
  const { error, pending, run } = useAct();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select aria-label={t("members.role")} defaultValue={role} disabled={pending} className="input w-auto py-1" onChange={(e) => run(() => setProjectMemberRole(projectId, userId, e.target.value))}>
        {PROJECT_ROLES.map((r) => <option key={r} value={r}>{t(`projectSettings.role_${r}`)}</option>)}
      </select>
      <button type="button" disabled={pending} className="btn-ghost text-rose-600" onClick={() => run(() => removeProjectMember(projectId, userId))}>
        {t("members.remove")}
      </button>
      {error && <p role="alert" className="w-full text-end text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function RevokeInvitation({ id }: { id: string }) {
  const t = useTranslations("members");
  const { error, pending, run } = useAct();
  return (
    <>
      <button type="button" disabled={pending} className="btn-ghost text-xs text-rose-600" onClick={() => run(() => revokeInvitation(id))}>{t("revoke")}</button>
      {error && <span role="alert" className="text-xs text-rose-600">{error}</span>}
    </>
  );
}
