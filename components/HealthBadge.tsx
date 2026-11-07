import { useTranslations } from "next-intl";

export type Health = "on_track" | "at_risk" | "off_track" | "on_hold" | "complete";

// status colors are reserved for project health and always ship with an icon + label
const STYLE: Record<Health | "none", { icon: string; cls: string }> = {
  on_track: { icon: "●", cls: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100" },
  at_risk: { icon: "▲", cls: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100" },
  off_track: { icon: "■", cls: "bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100" },
  on_hold: { icon: "❚❚", cls: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100" },
  complete: { icon: "✓", cls: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100" },
  none: { icon: "○", cls: "bg-transparent text-muted border border-line" },
};

export function HealthBadge({ health }: { health: Health | null }) {
  const t = useTranslations("health");
  const key = health ?? "none";
  const s = STYLE[key];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <span aria-hidden className="text-[0.6rem]">{s.icon}</span>
      {t(key)}
    </span>
  );
}

export const HEALTHS: Health[] = ["on_track", "at_risk", "off_track", "on_hold", "complete"];
