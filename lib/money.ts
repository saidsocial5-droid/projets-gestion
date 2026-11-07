/** "1 234,50", "1234.50", "1,234.50" → 123450 (cents). Null if not a positive amount. */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[\s  ]/g, "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastSep = Math.max(s.lastIndexOf(","), s.lastIndexOf("."));
  // a separator followed by exactly 1–2 digits at the end is the decimal mark
  if (lastSep >= 0 && s.length - lastSep - 1 <= 2) {
    s = s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  } else {
    s = s.replace(/[.,]/g, "");
  }
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatMoney(cents: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-MA" : "fr-MA", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);
}

export const EXPENSE_CATEGORIES = ["personnel", "equipment", "travel", "services", "training", "other"] as const;
