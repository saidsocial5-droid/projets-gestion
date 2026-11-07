"use client";

import { Link, usePathname } from "@/i18n/navigation";

export function ProjectTabs({ id, labels, showSettings }: { id: string; labels: { list: string; board: string; settings: string }; showSettings: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: `/p/${id}/list`, label: labels.list },
    { href: `/p/${id}/board`, label: labels.board },
    ...(showSettings ? [{ href: `/p/${id}/settings`, label: labels.settings }] : []),
  ];
  return (
    <nav className="flex gap-1 rounded-lg bg-black/5 p-1 text-sm dark:bg-white/10">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={path === tab.href ? "page" : undefined}
          className={`rounded-md px-3 py-1 ${path === tab.href ? "surface font-medium shadow-sm" : "text-muted"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
