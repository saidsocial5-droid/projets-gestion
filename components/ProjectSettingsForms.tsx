"use client";

import { useActionState, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addProjectMember, inviteToProject, updateProject } from "@/lib/actions";
import type { Person } from "@/lib/types";

type FormResult = { status: "idle" | "ok" | "error"; message?: string };

interface ProjectRow {
  id: string;
  name: string;
  privacy: string;
  due_date: string | null;
  start_date: string | null;
  donor_id: string | null;
  budget_cents: number | null;
  currency: string;
}

export function ProjectGeneralForm({ project, donors }: { project: ProjectRow; donors: { id: string; name: string }[] | null }) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateProject.bind(null, project.id), { status: "idle" } as FormResult);
  return (
    <form action={action} className="surface grid gap-3 rounded-xl p-4 sm:grid-cols-2">
      <label className="space-y-1 sm:col-span-2">
        <span className="text-sm font-medium">{t("projects.name")}</span>
        <input name="name" defaultValue={project.name} required maxLength={200} className="input" />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("projects.privacy")}</span>
        <select name="privacy" defaultValue={project.privacy} className="input">
          <option value="workspace">{t("projects.privacyWorkspace")}</option>
          <option value="private">{t("projects.privacyPrivate")}</option>
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("projects.dueDate")}</span>
        <input name="due_date" type="date" defaultValue={project.due_date ?? ""} className="input" />
      </label>
      {donors && (
        <fieldset className="grid gap-3 border-t border-line pt-3 sm:col-span-2 sm:grid-cols-3">
          <legend className="text-sm font-semibold">{t("projectSettings.funding")}</legend>
          <label className="space-y-1">
            <span className="text-sm font-medium">{t("funding.donor")}</span>
            <select name="donor_id" defaultValue={project.donor_id ?? ""} className="input">
              <option value="">{t("funding.noDonor")}</option>
              {donors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">{t("projectSettings.budgetAmount")} ({project.currency})</span>
            <input name="budget" inputMode="decimal" dir="ltr" defaultValue={project.budget_cents != null ? String(project.budget_cents / 100) : ""} className="input text-start" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">{t("projectSettings.startDate")}</span>
            <input name="start_date" type="date" defaultValue={project.start_date ?? ""} className="input" />
          </label>
        </fieldset>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{t("projectSettings.save")}</button>
        {state.status === "ok" && <span role="status" className="text-sm text-brand-600">{t("projectSettings.saved")}</span>}
        {state.status === "error" && <span role="alert" className="text-sm text-rose-600">{t("errors.generic")}</span>}
      </div>
    </form>
  );
}

const ROLES = ["editor", "commenter", "viewer", "admin"] as const;

export function AddProjectMemberForm({ projectId, candidates }: { projectId: string; candidates: Person[] }) {
  const t = useTranslations();
  const [user, setUser] = useState("");
  const [role, setRole] = useState("editor");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!user) return;
        start(async () => {
          const r = await addProjectMember(projectId, user, role);
          if (r.ok) { setUser(""); setError(null); } else setError(t(`errors.${r.error}`));
        });
      }}
    >
      <label className="min-w-48 flex-1 space-y-1">
        <span className="text-sm font-medium">{t("projectSettings.addMember")}</span>
        <select value={user} onChange={(e) => setUser(e.target.value)} className="input">
          <option value="">{t("projectSettings.choose")}</option>
          {candidates.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </label>
      <select aria-label={t("members.role")} value={role} onChange={(e) => setRole(e.target.value)} className="input w-auto">
        {ROLES.map((r) => <option key={r} value={r}>{t(`projectSettings.role_${r}`)}</option>)}
      </select>
      <button className="btn-primary" disabled={pending || !user}>{t("projectSettings.add")}</button>
      {error && <p role="alert" className="w-full text-sm text-rose-600">{error}</p>}
    </form>
  );
}

export function InviteGuestForm({ projectId }: { projectId: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(inviteToProject.bind(null, projectId), { status: "idle" } as FormResult);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 space-y-1">
          <span className="text-sm font-medium">{t("projectSettings.inviteGuest")}</span>
          <input name="email" type="email" required dir="ltr" className="input text-start" />
        </label>
        <select name="role" aria-label={t("members.role")} defaultValue="viewer" className="input w-auto">
          {ROLES.map((r) => <option key={r} value={r}>{t(`projectSettings.role_${r}`)}</option>)}
        </select>
        <button className="btn-primary" disabled={pending}>{t("projectSettings.invite")}</button>
      </div>
      <p className="text-xs text-muted">{t("projectSettings.guestHint")}</p>
      {state.status === "ok" && <p role="status" className="text-sm text-brand-600">{t("projectSettings.invited")}</p>}
      {state.status === "error" && <p role="alert" className="text-sm text-rose-600">{state.message === "already_invited" ? t("members.alreadyInvited") : t("errors.generic")}</p>}
    </form>
  );
}
