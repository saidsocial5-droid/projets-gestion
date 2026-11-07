import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/LoginForm";
import { LocaleSwitch } from "@/components/LocaleSwitch";

export default async function LoginPage() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-4">
      <div className="flex justify-end"><Suspense><LocaleSwitch /></Suspense></div>
      <div className="space-y-1 text-center">
        <div aria-hidden className="mx-auto mb-3 h-10 w-10 rounded-lg bg-brand-600" />
        <h1 className="text-2xl font-semibold">{t("app.name")}</h1>
        <p className="text-sm text-muted">{t("app.tagline")}</p>
      </div>
      <section className="surface rounded-xl p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-medium">{t("login.title")}</h2>
        <LoginForm />
      </section>
    </main>
  );
}
