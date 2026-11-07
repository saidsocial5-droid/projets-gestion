"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";

export function LocaleSwitch() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <Link href={search ? `${pathname}?${search}` : pathname} locale={locale === "ar" ? "fr" : "ar"} className="btn-ghost" lang={locale === "ar" ? "fr" : "ar"}>
      {t("language")}
    </Link>
  );
}
