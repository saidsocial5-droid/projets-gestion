"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { updateProfile } from "@/lib/actions";

export function ProfileForm({ name, locale, email }: { name: string; locale: string; email: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [state, action, pending] = useActionState(updateProfile, { status: "idle" } as { status: "idle" | "ok" | "error"; locale?: string });
  useEffect(() => {
    if (state.status === "ok" && state.locale && state.locale !== locale) router.replace("/me", { locale: state.locale });
  }, [state, locale, router]);
  return (
    <form action={action} className="surface space-y-4 rounded-xl p-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t("profile.name")}</span>
        <input name="full_name" required maxLength={120} defaultValue={name} className="input" />
        <span className="block text-xs text-muted">{t("profile.nameHint")}</span>
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t("profile.language")}</span>
        <select name="locale" defaultValue={locale} className="input"><option value="ar">العربية</option><option value="fr">Français</option></select>
      </label>
      <p className="text-sm"><span className="text-muted">{t("profile.email")}: </span><span dir="ltr">{email}</span></p>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{t("profile.save")}</button>
        {state.status === "ok" && <span role="status" className="text-sm text-brand-600">{t("profile.saved")}</span>}
        {state.status === "error" && <span role="alert" className="text-sm text-rose-600">{t("errors.generic")}</span>}
      </div>
    </form>
  );
}
