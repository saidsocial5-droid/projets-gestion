import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { signOut } from "@/lib/actions";
import { Link } from "@/i18n/navigation";

export default async function NoAccess() {
  const t = await getTranslations();
  const session = await getSession();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">{t("noAccess.title")}</h1>
      <p className="text-sm text-muted">{t("noAccess.body")}</p>
      <p dir="ltr" className="font-medium">{session?.email}</p>
      <div className="flex justify-center gap-2">
        <Link href="/projects" className="btn-primary">{t("noAccess.retry")}</Link>
        <form action={signOut}><button className="btn-ghost">{t("nav.signOut")}</button></form>
      </div>
    </main>
  );
}
