import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions";
import { LocaleSwitch } from "@/components/LocaleSwitch";

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });
  if (!session!.workspaceId) {
    // an invitation may have been created since the last sign-in
    const supabase = await createClient();
    const { data } = await supabase.rpc("bootstrap_or_join");
    if (!data) redirect({ href: "/no-access", locale });
    else redirect({ href: "/projects", locale });
  }
  const t = await getTranslations("nav");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="surface sticky top-0 z-20 flex items-center gap-2 border-x-0 border-t-0 px-4 py-2">
        <Link href="/projects" className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="h-6 w-6 rounded bg-brand-600" />
          <span>AFMI</span>
        </Link>
        <nav className="ms-4 flex items-center gap-1 text-sm">
          <Link href="/projects" className="btn-ghost">{t("projects")}</Link>
          {session!.role === "admin" && <Link href="/settings/members" className="btn-ghost">{t("members")}</Link>}
        </nav>
        <div className="ms-auto flex items-center gap-1 text-sm">
          <span dir="ltr" className="hidden text-muted sm:inline">{session!.email}</span>
          <Suspense><LocaleSwitch /></Suspense>
          <form action={signOut}><button className="btn-ghost">{t("signOut")}</button></form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
