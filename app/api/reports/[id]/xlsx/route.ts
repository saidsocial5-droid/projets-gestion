import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { loadReport, indicatorProgress } from "@/lib/report";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const r = await loadReport(id);
  if (!r) return new NextResponse("Not found", { status: 404 });

  const L = r.locale;
  const t = await getTranslations({ locale: L, namespace: "doc" });
  const tr = await getTranslations({ locale: L });
  const healthOf = (p: (typeof r.projects)[number]) => {
    const s = p.updates.at(-1)?.status;
    return s ? tr(`health.${s}`) : tr("health.none");
  };
  const wb = new ExcelJS.Workbook();
  wb.creator = "AFMI";
  const view = [{ rightToLeft: L === "ar", state: "frozen" as const, ySplit: 1 }];
  const header = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD5ECDC" } };
  };
  const moneyFmt = '#,##0.00 "MAD"';

  const summary = wb.addWorksheet(t("summary"), { views: view });
  summary.columns = [
    { header: t("project"), key: "name", width: 36 },
    { header: t("health"), key: "health", width: 14 },
    { header: t("tasksDone"), key: "done", width: 12 },
    { header: tr("dashboard.total"), key: "total", width: 12 },
    { header: t("doneInPeriod"), key: "period", width: 14 },
    { header: t("budget"), key: "budget", width: 16, style: { numFmt: moneyFmt } },
    { header: t("spentTotal"), key: "spent", width: 16, style: { numFmt: moneyFmt } },
    { header: t("spentPeriod"), key: "spentPeriod", width: 16, style: { numFmt: moneyFmt } },
    { header: t("rate"), key: "rate", width: 10, style: { numFmt: "0%" } },
  ];
  for (const p of r.projects) {
    summary.addRow({
      name: p.name, health: healthOf(p), done: Number(p.tasks_done), total: Number(p.tasks_total), period: Number(p.tasks_done_in_period),
      budget: p.budget_cents != null ? Number(p.budget_cents) / 100 : null, spent: Number(p.spent_cents) / 100, spentPeriod: Number(p.spent_in_period_cents) / 100,
      rate: p.budget_cents ? Number(p.spent_cents) / Number(p.budget_cents) : null,
    });
  }
  header(summary);

  const ind = wb.addWorksheet(t("indicators"), { views: view });
  ind.columns = [
    { header: t("project"), key: "project", width: 30 },
    { header: t("indicator"), key: "name", width: 36 },
    { header: tr("funding.unit"), key: "unit", width: 10 },
    { header: tr("funding.baseline"), key: "baseline", width: 12 },
    { header: tr("funding.target"), key: "target", width: 12 },
    { header: tr("funding.current"), key: "current", width: 12 },
    { header: "%", key: "pct", width: 8, style: { numFmt: "0%" } },
  ];
  for (const p of r.projects)
    for (const i of p.indicators)
      ind.addRow({ project: p.name, name: L === "ar" ? i.name_ar : i.name_fr, unit: i.unit, baseline: Number(i.baseline), target: Number(i.target), current: Number(i.current), pct: indicatorProgress(i) / 100 });
  header(ind);

  const exp = wb.addWorksheet(tr("funding.expenses"), { views: view });
  exp.columns = [
    { header: t("project"), key: "project", width: 30 },
    { header: tr("funding.category"), key: "category", width: 18 },
    { header: tr("funding.amount"), key: "amount", width: 16, style: { numFmt: moneyFmt } },
  ];
  for (const p of r.projects)
    for (const e of p.expenses_by_category) exp.addRow({ project: p.name, category: tr(`category.${e.category}`), amount: Number(e.amount_cents) / 100 });
  header(exp);

  const buf = await wb.xlsx.writeBuffer();
  const ascii = r.title.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "rapport";
  return new NextResponse(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ascii}.xlsx"; filename*=UTF-8''${encodeURIComponent(r.title)}.xlsx`,
      "Cache-Control": "private, no-store",
    },
  });
}
