const TZ = "Africa/Casablanca";

/** Today's calendar date in Morocco as YYYY-MM-DD (handles the Ramadan UTC+0 switch via tzdata). */
export function todayInMorocco(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function isOverdue(due: string | null, completedAt: string | null): boolean {
  return !!due && !completedAt && due < todayInMorocco();
}

/** Formats a calendar date (no time zone) for display. */
export function formatDate(d: string, locale: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-MA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, day)));
}
