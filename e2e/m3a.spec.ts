import { test, expect, type Page } from "@playwright/test";
import { inDays, invite, signIn } from "./helpers";

const run = Date.now();
const owner = `planner-${run}@afmi.test`;
const project = `برنامج التشجير ${run}`;

async function setDates(page: Page, title: string, start: string | null, due: string) {
  await page.getByRole("link", { name: new RegExp(title) }).first().click();
  const panel = page.getByRole("complementary");
  await expect(panel.locator('input[name="title"]')).toHaveValue(title);
  if (start) await panel.locator('input[name="start_date"]').fill(start);
  await panel.locator('input[name="due_date"]').fill(due);
  await panel.getByRole("button", { name: "حفظ" }).click();
  await expect(panel.getByRole("status")).toHaveText("تم الحفظ");
}

test("M3a timeline: dates, dependencies, cycle refusal, blocked badge, drag to reschedule", async ({ browser }) => {
  await invite(owner, "admin");
  const a = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await signIn(a, owner);
  await a.goto("/ar/projects");
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(project);
  await a.getByRole("button", { name: "إنشاء" }).click();
  for (const title of ["تحضير الحفر", "غرس الشتلات", "ورشة توعية"]) {
    await a.getByRole("textbox", { name: "أضف مهمة…" }).fill(title);
    await a.getByRole("textbox", { name: "أضف مهمة…" }).press("Enter");
    await expect(a.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  }
  await setDates(a, "تحضير الحفر", inDays(0), inDays(4));
  await setDates(a, "غرس الشتلات", inDays(2), inDays(8));

  // "planting" depends on "digging"
  const panel = a.getByRole("complementary");
  await panel.getByLabel("أضف مهمة تعتمد عليها…").selectOption({ label: "تحضير الحفر" });
  await expect(panel.getByRole("listitem").filter({ hasText: "تحضير الحفر" })).toBeVisible();
  await expect(a.getByRole("link", { name: /غرس الشتلات.*محجوبة/ })).toBeVisible();

  // the reverse dependency would be a cycle: refused by the database
  await a.getByRole("link", { name: /تحضير الحفر/ }).first().click();
  await expect(panel.locator('input[name="title"]')).toHaveValue("تحضير الحفر");
  await panel.getByLabel("أضف مهمة تعتمد عليها…").selectOption({ label: "غرس الشتلات" });
  await expect(panel.getByRole("alert")).toHaveText("هذه التبعية تُنشئ حلقة مغلقة.");
  await expect(panel).toContainText("تنتظرها: غرس الشتلات");

  // timeline: two bars, one unscheduled task, a red arrow (planting starts before digging ends)
  await panel.getByRole("link", { name: "إغلاق" }).click();
  await a.getByRole("link", { name: "الجدول الزمني" }).click();
  await expect(a.locator("button[data-task-id]")).toHaveCount(2);
  await expect(a.getByRole("link", { name: "ورشة توعية" })).toBeVisible();
  await expect(a.locator('path[stroke="#e11d48"]')).toHaveCount(1);
  if (process.env.SHOTS_DIR) await a.screenshot({ path: `${process.env.SHOTS_DIR}/timeline-ar.png` });

  // drag "planting" 7 days later (in RTL, later is to the left); the arrow is no longer red
  const bar = a.getByRole("button", { name: /^غرس الشتلات:/ });
  const box = (await bar.boundingBox())!;
  await a.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await a.mouse.down();
  await a.mouse.move(box.x + box.width / 2 - 28 * 7, box.y + box.height / 2, { steps: 10 });
  await a.mouse.up();
  await expect(a.getByRole("status")).toHaveText("تم تغيير التواريخ");
  await a.reload();
  await expect(a.getByRole("button", { name: new RegExp(`^غرس الشتلات: ${inDays(9)} → ${inDays(15)}`) })).toBeVisible();
  await expect(a.locator('path[stroke="#e11d48"]')).toHaveCount(0);
});
