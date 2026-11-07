import { test, expect } from "@playwright/test";
import { invite, signIn } from "./helpers";

const run = Date.now();
const owner = `tpl-${run}@afmi.test`;
const source = `مخيم صيفي ${run}`;
const template = `قالب مخيم ${run}`;
const copy = `مخيم 2027 ${run}`;

test("M3c templates and archiving", async ({ browser }) => {
  await invite(owner, "admin");
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await signIn(a, owner);

  // a source project with a section, two tasks, a subtask and a dependency
  await a.goto("/ar/projects");
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(source);
  await a.getByRole("button", { name: "إنشاء" }).click();
  await expect(a).toHaveURL(/\/list$/);
  await a.getByRole("textbox", { name: "قسم جديد…" }).fill("التحضير");
  await a.getByRole("textbox", { name: "قسم جديد…" }).press("Enter");
  await expect(a.getByRole("heading", { name: "التحضير" })).toBeVisible();
  const addInPrep = a.locator("section").filter({ has: a.getByRole("heading", { name: "التحضير" }) }).getByRole("textbox", { name: "أضف مهمة…" });
  for (const title of ["حجز الموقع", "دعوة المشاركين"]) {
    await addInPrep.fill(title);
    await addInPrep.press("Enter");
    await expect(a.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  }
  await a.getByRole("link", { name: /دعوة المشاركين/ }).click();
  const panel = a.getByRole("complementary");
  await expect(panel.locator('input[name="title"]')).toHaveValue("دعوة المشاركين");
  await panel.getByLabel("أضف مهمة تعتمد عليها…").selectOption({ label: "حجز الموقع" });
  await panel.getByRole("textbox", { name: "أضف مهمة فرعية…" }).fill("تصميم الدعوة");
  await panel.getByRole("textbox", { name: "أضف مهمة فرعية…" }).press("Enter");
  await expect(panel.getByText("تصميم الدعوة")).toBeVisible();

  // save as template
  await panel.getByRole("link", { name: "إغلاق" }).click();
  await a.getByRole("link", { name: "الإعدادات" }).last().click();
  await a.getByLabel("اسم القالب").fill(template);
  await a.getByRole("button", { name: "حفظ كقالب" }).click();
  await expect(a.getByRole("note")).toContainText("هذا قالب");
  await expect(a.getByRole("heading", { level: 1 })).toHaveText(template);

  // templates are listed apart and never in the active list
  await a.goto("/ar/projects");
  await expect(a.getByRole("link", { name: new RegExp(template) })).toHaveCount(0);
  await a.getByRole("link", { name: "القوالب" }).click();
  await expect(a.getByRole("link", { name: new RegExp(template) })).toBeVisible();

  // new project from the template copies the structure
  await a.getByRole("link", { name: "النشطة" }).click();
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(copy);
  await a.getByLabel("القالب").selectOption({ label: template });
  await a.getByRole("button", { name: "إنشاء" }).click();
  await expect(a).toHaveURL(/\/list$/);
  await expect(a.getByRole("heading", { name: "التحضير" })).toBeVisible();
  await expect(a.getByRole("link", { name: /دعوة المشاركين.*محجوبة/ })).toBeVisible();
  await a.getByRole("link", { name: /دعوة المشاركين/ }).click();
  await expect(panel.getByText("تصميم الدعوة")).toBeVisible();

  // archive the source project: it leaves the active list and comes back on unarchive
  await a.goto("/ar/projects");
  await a.getByRole("link", { name: new RegExp(source) }).click();
  await expect(a).toHaveURL(/\/list$/);
  await a.getByRole("link", { name: "الإعدادات" }).last().click();
  await a.getByRole("button", { name: /أرشفة المشروع/ }).click();
  await expect(a.getByRole("note")).toContainText("هذا المشروع مؤرشف");
  await a.goto("/ar/projects");
  await expect(a.getByRole("link", { name: new RegExp(source) })).toHaveCount(0);
  await a.getByRole("link", { name: "المؤرشفة" }).click();
  await a.getByRole("link", { name: new RegExp(source) }).click();
  await expect(a).toHaveURL(/\/list$/);
  await a.getByRole("link", { name: "الإعدادات" }).last().click();
  await a.getByRole("button", { name: "إلغاء الأرشفة" }).click();
  await expect(a.getByRole("note")).toHaveCount(0);
});
