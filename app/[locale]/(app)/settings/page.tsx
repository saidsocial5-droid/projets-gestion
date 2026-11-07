import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";

export default async function SettingsHub({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = (await getSession())!;
  if (session.role !== "admin") redirect({ href: "/home", locale });
  const t = await getTranslations();
  const items = [
    { href: "/settings/members", title: t("nav.members"), hint: t("settingsHub.members") },
    { href: "/settings/workflow", title: t("nav.workflow"), hint: t("settingsHub.workflow") },
    { href: "/settings/fields", title: t("nav.fields"), hint: t("settingsHub.fields") },
  ];
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t("settingsHub.title")}</h1>
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="surface block h-full space-y-1 rounded-xl p-4 hover:shadow-md">
              <span className="font-medium">{i.title}</span>
              <span className="block text-xs text-muted">{i.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
