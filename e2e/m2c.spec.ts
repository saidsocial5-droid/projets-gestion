import { test, expect } from "@playwright/test";
import { invite, signIn } from "./helpers";

const run = Date.now();
const owner = `pm-${run}@afmi.test`;
const project = `مشتل إفران ${run}`;

test("M2c reporting: dashboard numbers, status update with snapshot, portfolio", async ({ browser }) => {
  await invite(owner, "admin");
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await signIn(a, owner);
  await a.goto("/ar/projects");
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(project);
  await a.getByRole("button", { name: "إنشاء" }).click();
  for (const title of ["تهيئة الأرض", "زرع البذور", "الري الأسبوعي"]) {
    await a.getByRole("textbox", { name: "أضف مهمة…" }).fill(title);
    await a.getByRole("textbox", { name: "أضف مهمة…" }).press("Enter");
    await expect(a.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  }

  // walk one task through the workflow to "done"
  await a.getByRole("link", { name: /تهيئة الأرض/ }).click();
  const panel = a.getByRole("complementary");
  for (const status of ["قيد التنفيذ", "قيد المراجعة", "منجز"]) {
    await panel.locator('select[name="status_id"]').selectOption({ label: status });
    await panel.getByRole("button", { name: "حفظ" }).click();
    await expect(panel.getByRole("status")).toHaveText("تم الحفظ");
  }
  await expect(panel.getByText("✓ منجزة")).toBeVisible();

  await a.getByRole("link", { name: "المتابعة" }).click();
  const tiles = a.getByRole("listitem");
  await expect(tiles.filter({ hasText: "كل المهام" })).toContainText("3");
  await expect(tiles.filter({ hasText: "منجزة" })).toContainText("33%");
  await expect(a.getByTitle("للتنفيذ: 2 مهمة")).toBeVisible();
  if (process.env.SHOTS_DIR) await a.screenshot({ path: `${process.env.SHOTS_DIR}/dashboard-ar.png` });

  // publish a status update; the database stores a progress snapshot
  await a.getByRole("link", { name: "التقدّم" }).click();
  await a.getByRole("button", { name: "+ تحديث جديد" }).click();
  await a.getByLabel("في خطر").check();
  await a.getByLabel("العنوان").fill("تأخر وصول البذور");
  await a.getByLabel(/ما الذي تحقق/).fill("المورد أجّل التسليم أسبوعين.");
  await a.getByRole("button", { name: "نشر", exact: true }).click();
  const article = a.getByRole("article").filter({ hasText: "تأخر وصول البذور" });
  await expect(article).toContainText("1 من 3 مهمة منجزة");
  await expect(article.getByText("في خطر")).toBeVisible();

  // a draft stays private until published
  await a.getByRole("button", { name: "+ تحديث جديد" }).click();
  await a.getByLabel("العنوان").fill("مسودة الأسبوع القادم");
  await a.getByRole("button", { name: "حفظ كمسودة" }).click();
  await expect(a.getByText("مسوداتي")).toBeVisible();
  await expect(a.getByRole("article").filter({ hasText: "مسودة الأسبوع القادم" })).toHaveCount(0);

  // the portfolio lists the project with its health
  await a.getByRole("navigation").getByRole("link", { name: "المحفظة" }).click();
  const row = a.getByRole("row").filter({ hasText: project });
  await expect(row.getByText("في خطر")).toBeVisible();
  await expect(row).toContainText("33%");
  if (process.env.SHOTS_DIR) await a.screenshot({ path: `${process.env.SHOTS_DIR}/portfolio-ar.png` });
});
