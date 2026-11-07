import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { InboxItem } from "@/lib/inbox";

/** Server-rendered list of notifications; statuses are shown by name via the activity payload where possible. */
export async function InboxList({ items, statusNames, people }: { items: InboxItem[]; statusNames: Map<string, string>; people: Map<string, string> }) {
  const t = await getTranslations();
  const locale = await getLocale();
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(iso));
  const describe = (a: InboxItem["activity"]) => {
    switch (a.action) {
      case "task.status_changed":
        return t("activity.task.status_changed", { to: statusNames.get(a.payload.to ?? "") ?? "?" });
      case "task.assigned":
        return a.payload.to ? t("activity.task.assigned", { to: people.get(a.payload.to) ?? t("activity.someone") }) : t("activity.task.unassigned");
      case "comment.created":
        return t("activity.comment.created", { excerpt: a.payload.excerpt ?? "" });
      case "attachment.added":
        return t("activity.attachment.added", { file: `\u2068${a.payload.file_name ?? ""}\u2069` });
      default:
        return t.has(`activity.${a.action}`) ? t(`activity.${a.action}`) : a.action;
    }
  };
  return (
    <ul className="surface divide-y divide-[var(--border)] overflow-hidden rounded-xl">
      {items.map((n) => (
        <li key={n.id}>
          <Link href={`/inbox/${n.id}`} className={`block px-4 py-3 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${n.read_at ? "text-muted" : ""}`}>
            <div className="flex items-start gap-2">
              {!n.read_at && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              <div className="min-w-0 space-y-0.5">
                <p className={n.read_at ? "" : "font-medium"}>
                  <bdi>{n.activity.actor?.full_name ?? t("activity.someone")}</bdi> · <bdi>{describe(n.activity)}</bdi>
                </p>
                <p className="truncate text-xs text-muted">
                  <bdi>{n.activity.task?.title}</bdi> · {t("inbox.in", { project: n.activity.project?.name ?? "" })} · <bdi>{when(n.created_at)}</bdi>
                </p>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
