import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { invite, signIn } from "./helpers";

const run = Date.now();
const owner = `finance-${run}@afmi.test`;
const donor = `Fondation Atlas ${run}`;
const project = `غابة الأرز ${run}`;

test("M2d funding: donor, budget, indicator, expense, donor report (print + Excel)", async ({ browser }) => {
  await invite(owner, "admin");
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await signIn(a, owner);

  // donor
  await a.getByRole("navigation").getByRole("link", { name: "المانحون" }).click();
  const newDonor = a.locator("section").filter({ has: a.getByRole("heading", { name: "مانح جديد" }) });
  await newDonor.getByLabel("الاسم").fill(donor);
  await newDonor.getByLabel("البريد").fill("contact@atlas.test");
  await newDonor.getByRole("button", { name: "حفظ" }).click();
  await expect(a.getByText(donor, { exact: true })).toBeVisible();

  // project with donor and budget
  await a.goto("/ar/projects");
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(project);
  await a.getByRole("button", { name: "إنشاء" }).click();
  await a.getByRole("link", { name: "الإعدادات" }).click();
  await a.getByLabel("المانح").selectOption({ label: donor });
  await a.getByLabel(/^الميزانية/).fill("50 000");
  await a.getByRole("button", { name: "حفظ" }).click();
  await expect(a.getByRole("status")).toHaveText("تم الحفظ");

  // indicator and expense
  await a.getByRole("link", { name: "التمويل" }).click();
  await a.getByText("+ إضافة مؤشر").click();
  await a.getByLabel("الاسم بالعربية").fill("عدد الأشجار المغروسة");
  await a.getByLabel("الاسم بالفرنسية").fill("Arbres plantés");
  await a.getByLabel("الوحدة").fill("شجرة");
  await a.getByLabel("الهدف").fill("1000");
  await a.locator("details").getByRole("button", { name: "إضافة" }).click();
  const current = a.getByLabel("المحقق: عدد الأشجار المغروسة");
  await current.fill("250");
  await a.getByRole("button", { name: "تحديث" }).click();
  await expect(a.getByText("25% من الهدف")).toBeVisible();

  await a.getByLabel("البيان").fill("شراء شتلات الأرز");
  await a.getByLabel("الفئة").selectOption("equipment");
  await a.getByLabel("المبلغ (درهم)").fill("12 500,50");
  await a.locator("section").filter({ has: a.getByRole("heading", { name: "المصاريف" }) }).getByRole("button", { name: "إضافة" }).click();
  await expect(a.getByRole("cell", { name: "شراء شتلات الأرز" })).toBeVisible();
  await expect(a.getByText("25%", { exact: true })).toBeVisible(); // 12 500,50 of 50 000 → 25%
  if (process.env.SHOTS_DIR) await a.screenshot({ path: `${process.env.SHOTS_DIR}/funding-ar.png`, fullPage: true });

  // a French report for the donor; choosing the donor pre-selects its projects
  await a.getByRole("navigation").getByRole("link", { name: "التقارير" }).click();
  await a.getByLabel("عنوان التقرير").fill(`Rapport annuel ${run}`);
  await a.getByLabel("المانح").selectOption({ label: donor });
  await expect(a.getByRole("checkbox", { name: project })).toBeChecked();
  await a.getByLabel("لغة التقرير").selectOption("fr");
  await a.getByRole("button", { name: "إنشاء التقرير" }).click();
  await expect(a).toHaveURL(/\/reports\/[0-9a-f-]+$/);

  const doc = a.locator("article");
  await expect(doc).toHaveAttribute("dir", "ltr");
  await expect(doc.getByRole("heading", { name: "Synthèse" })).toBeVisible();
  await expect(doc.getByRole("row").filter({ hasText: "Arbres plantés" })).toContainText("25%");
  await expect(doc).toContainText("Équipement");
  await expect(doc).toContainText(donor);

  // print to PDF (what the "Imprimer / PDF" button does) and download the Excel file
  if (process.env.SHOTS_DIR) {
    await a.emulateMedia({ media: "print" });
    await a.pdf({ path: `${process.env.SHOTS_DIR}/report-fr.pdf`, format: "A4", printBackground: true });
    await a.emulateMedia({ media: "screen" });
  }
  const [download] = await Promise.all([a.waitForEvent("download"), a.getByRole("link", { name: /Excel/ }).click()]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(await download.path());
  expect(wb.worksheets.map((w) => w.name)).toEqual(["Synthèse", "Indicateurs", "Dépenses"]);
  const row = wb.getWorksheet("Synthèse")!.getRow(2);
  expect(row.getCell(1).value).toBe(project);
  expect(row.getCell(6).value).toBe(50000);
  expect(row.getCell(7).value).toBe(12500.5);
});
