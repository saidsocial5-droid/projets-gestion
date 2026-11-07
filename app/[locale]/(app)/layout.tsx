import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/actions";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { unreadCount } from "@/lib/inbox";

export default async function AppLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });
  if (!session!.workspaceId) {
    // an invitation may have been created since the last sign-in
    const supabase = await createClient();
    const { data } = await supabase.rpc("bootstrap_or_join");
    if (!data) redirect({ href: "/no-access", locale });
    else redirect({ href: "/home", locale });
  }
  const t = await getTranslations("nav");
  const unread = await unreadCount(session!.userId);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="surface sticky top-0 z-20 print:hidden flex flex-wrap items-center gap-2 border-x-0 border-t-0 px-4 py-2">
        <Link href="/home" className="flex items-center gap-2 font-semibold">
          <span aria-hidden className="h-6 w-6 rounded bg-brand-600" />
          <span>AFMI</span>
        </Link>
        <nav className="order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto text-sm lg:order-none lg:ms-4 lg:w-auto">
          <Link href="/home" className="btn-ghost">{t("home")}</Link>
          <Link href="/my-tasks" className="btn-ghost">{t("myTasks")}</Link>
          <Link href="/inbox" className="btn-ghost">
            {t("inbox")}
            {unread > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white" aria-label={`${unread}`}>{unread}</span>}
          </Link>
          <Link href="/projects" className="btn-ghost">{t("projects")}</Link>
          {session!.role !== "guest" && (
            <>
              <Link href="/portfolio" className="btn-ghost">{t("portfolio")}</Link>
              <Link href="/reports" className="btn-ghost">{t("reports")}</Link>
              <Link href="/donors" className="btn-ghost">{t("donors")}</Link>
            </>
          )}
          {session!.role === "admin" && (
            <>
              <Link href="/settings/members" className="btn-ghost">{t("members")}</Link>
              <Link href="/settings/workflow" className="btn-ghost">{t("workflow")}</Link>
            </>
          )}
        </nav>
        <div className="ms-auto flex items-center gap-1 text-sm">
          <form action={`/${locale}/search`} role="search" className="hidden md:block">
            <input type="search" name="q" placeholder={t("search")} aria-label={t("search")} className="input w-40 py-1" />
          </form>
          <Link href="/me" className="btn-ghost">{t("profile")}</Link>
          <Suspense><LocaleSwitch /></Suspense>
          <form action={signOut}><button className="btn-ghost">{t("signOut")}</button></form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
