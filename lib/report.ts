import "server-only";
import { createClient } from "./supabase/server";
import type { Health } from "@/components/HealthBadge";

export interface ReportProject {
  id: string;
  name: string;
  start_date: string | null;
  due_date: string | null;
  budget_cents: number | null;
  currency: string;
  tasks_total: number;
  tasks_done: number;
  tasks_done_in_period: number;
  spent_cents: number;
  spent_in_period_cents: number;
  expenses_by_category: { category: string; amount_cents: number }[];
  indicators: { name_ar: string; name_fr: string; unit: string; baseline: number; target: number; current: number }[];
  updates: { status: Health; title: string; text: string | null; published_at: string }[];
}

export interface Report {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  locale: "ar" | "fr";
  created_at: string;
  donor: { name: string } | null;
  projects: ReportProject[];
}

export async function loadReport(id: string): Promise<Report | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("reports").select("id, title, period_start, period_end, locale, created_at, project_ids, donor:donors(name)").eq("id", id).maybeSingle();
  if (!r) return null;
  const projects = await Promise.all(
    (r.project_ids as string[]).map(async (p) => {
      const { data } = await supabase.rpc("report_project", { p, period_start: r.period_start, period_end: r.period_end });
      return data as ReportProject | null;
    }),
  );
  return { ...(r as unknown as Omit<Report, "projects">), projects: projects.filter((p): p is ReportProject => !!p) };
}

export function indicatorProgress(i: { baseline: number; target: number; current: number }): number {
  const span = Number(i.target) - Number(i.baseline);
  return span > 0 ? Math.max(0, Math.round(((Number(i.current) - Number(i.baseline)) / span) * 100)) : 100;
}
