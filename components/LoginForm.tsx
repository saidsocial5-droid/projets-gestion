"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { sendMagicLink } from "@/lib/actions";

export function LoginForm() {
  const t = useTranslations("login");
  const locale = useLocale();
  const [state, action, pending] = useActionState(sendMagicLink, { status: "idle" as const });

  if (state.status === "sent") {
    return <p role="status" className="rounded-md bg-brand-50 p-4 text-sm text-brand-900">{t("sent")}</p>;
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t("email")}</span>
        <input name="email" type="email" required autoComplete="email" dir="ltr" className="input text-start" />
      </label>
      {state.status === "error" && <p role="alert" className="text-sm text-rose-600">{t("error")}</p>}
      <button className="btn-primary w-full" disabled={pending}>{t("submit")}</button>
      <p className="text-center text-xs text-muted">{t("inviteOnly")}</p>
    </form>
  );
}
