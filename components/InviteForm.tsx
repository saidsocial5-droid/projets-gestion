"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { inviteMember } from "@/lib/actions";

export function InviteForm() {
  const t = useTranslations();
  const locale = useLocale();
  const [state, action, pending] = useActionState(inviteMember, { status: "idle" as const });
  return (
    <form action={action} className="surface grid gap-3 rounded-xl p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <input type="hidden" name="locale" value={locale} />
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("members.email")}</span>
        <input name="email" type="email" required dir="ltr" className="input text-start" />
      </label>
      <label className="space-y-1">
        <span className="text-sm font-medium">{t("members.role")}</span>
        <select name="role" defaultValue="member" className="input">
          <option value="member">{t("members.role_member")}</option>
          <option value="admin">{t("members.role_admin")}</option>
          <option value="guest">{t("members.role_guest")}</option>
        </select>
      </label>
      <button className="btn-primary" disabled={pending}>{t("members.send")}</button>
      {state.status === "ok" && <p role="status" className="text-sm text-brand-600 sm:col-span-3">{t("members.invited")}</p>}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-rose-600 sm:col-span-3">{state.message === "already_invited" ? t("members.alreadyInvited") : t("errors.generic")}</p>
      )}
    </form>
  );
}
