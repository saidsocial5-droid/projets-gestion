import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { getInbox } from "@/lib/inbox";
import { peopleNames, statusNames } from "@/lib/statuses";
import { markAllNotificationsRead } from "@/lib/actions";
import { InboxList } from "@/components/InboxList";

export default async function InboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("inbox");
  const session = (await getSession())!;
  const [items, names, people] = await Promise.all([getInbox(session.userId), statusNames(locale), peopleNames()]);
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {items.some((i) => !i.read_at) && (
          <form action={markAllNotificationsRead}><button className="btn-ghost text-sm">{t("markAll")}</button></form>
        )}
      </div>
      {items.length === 0 ? <p className="surface rounded-xl p-8 text-center text-muted">{t("empty")}</p> : <InboxList items={items} statusNames={names} people={people} />}
    </main>
  );
}
