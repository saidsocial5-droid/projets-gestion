import type { Status, Transition } from "./types";

export function statusName(s: Pick<Status, "name_ar" | "name_fr">, locale: string) {
  return locale === "ar" ? s.name_ar : s.name_fr;
}

/** Statuses a task in `from` may move to. Mirrors the tasks_check_status trigger (the database is the authority). */
export function allowedTargets(from: string, restrict: boolean, statuses: Status[], transitions: Transition[]): Set<string> {
  if (!restrict) return new Set(statuses.map((s) => s.id).filter((id) => id !== from));
  return new Set(
    transitions.filter((t) => t.from_status_id === from || t.from_status_id === null).map((t) => t.to_status_id).filter((id) => id !== from),
  );
}

export const statusColors: Record<string, string> = {
  gray: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100",
  blue: "bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  green: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  red: "bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100",
};
