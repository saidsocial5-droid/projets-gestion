"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { sendMagicLink, verifyLoginCode } from "@/lib/actions";

/** Step 1: email → a 6-digit code is emailed. Step 2: type the code (works in the desktop app and any browser). */
export function LoginForm() {
  const t = useTranslations("login");
  const locale = useLocale();
  const [sendState, send, sending] = useActionState(sendMagicLink, { status: "idle" as const });
  const [codeState, verify, verifying] = useActionState(verifyLoginCode, { status: "idle" as const });
  const [haveCode, setHaveCode] = useState(false);
  const [email, setEmail] = useState("");

  const step2 = sendState.status === "sent" || haveCode;
  const knownEmail = sendState.email ?? codeState.email ?? email;

  if (step2) {
    return (
      <form action={verify} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {sendState.status === "sent" ? (
          <>
            <p role="status" className="rounded-md bg-brand-50 p-3 text-sm text-brand-900">{t("sent")}</p>
            <input type="hidden" name="email" value={knownEmail} />
            <p dir="ltr" className="text-center text-sm text-muted">{knownEmail}</p>
          </>
        ) : (
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t("email")}</span>
            <input name="email" type="email" required autoComplete="email" dir="ltr" defaultValue={knownEmail} className="input text-start" />
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t("code")}</span>
          <input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            autoFocus
            dir="ltr"
            className="input text-center font-mono text-2xl tracking-[0.5em]"
          />
        </label>
        {codeState.status === "error" && <p role="alert" className="text-sm text-rose-600">{t("badCode")}</p>}
        <button className="btn-primary w-full" disabled={verifying}>{t("verify")}</button>
        <div className="flex justify-between text-xs">
          <button type="button" className="text-muted hover:underline" onClick={() => location.reload()}>{t("changeEmail")}</button>
          {sendState.status === "sent" && (
            <button type="submit" formAction={send} className="text-muted hover:underline" disabled={sending}>{t("resend")}</button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form action={send} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t("email")}</span>
        <input name="email" type="email" required autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="input text-start" />
      </label>
      {sendState.status === "error" && <p role="alert" className="text-sm text-rose-600">{t("error")}</p>}
      <button className="btn-primary w-full" disabled={sending}>{t("submit")}</button>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{t("inviteOnly")}</span>
        <button type="button" className="hover:underline" onClick={() => setHaveCode(true)}>{t("haveCode")}</button>
      </div>
    </form>
  );
}
