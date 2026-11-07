import { test, expect } from "@playwright/test";
import { invite, signIn } from "./helpers";

const run = Date.now();
const owner = `admin2-${run}@afmi.test`;
const project = `تنظيف الغابة ${run}`;
const waiting = `بانتظار المانح ${String(run).slice(-4)}`;

test("M2e workflow editor, search, profile", async ({ browser }) => {
  await invite(owner, "admin");
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await signIn(a, owner);

  // profile: the display name is what others see
  await a.getByRole("link", { name: "ملفي" }).click();
  await a.getByLabel("الاسم الظاهر").fill(`فاطمة ${run}`);
  await a.getByRole("button", { name: "حفظ" }).click();
  await expect(a.getByRole("status")).toHaveText("تم الحفظ");

  // a project with a task in "للتنفيذ"
  await a.goto("/ar/projects");
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(project);
  await a.getByRole("button", { name: "إنشاء" }).click();
  await a.getByRole("textbox", { name: "أضف مهمة…" }).fill(`جمع النفايات ${run}`);
  await a.getByRole("textbox", { name: "أضف مهمة…" }).press("Enter");
  await expect(a.getByRole("link", { name: /جمع النفايات/ })).toBeVisible();

  // workflow: add a status, allow "To do" → new status, check the board
  await a.goto("/ar/settings/workflow");
  const add = a.locator("form").filter({ has: a.getByRole("button", { name: "إضافة حالة" }) });
  await add.getByLabel("الاسم بالعربية").fill(waiting);
  await add.getByLabel("الاسم بالفرنسية").fill("Attente bailleur");
  await add.getByLabel("اللون").selectOption("amber");
  await add.getByRole("button", { name: "إضافة حالة" }).click();
  await expect(a.getByRole("checkbox", { name: `للتنفيذ → ${waiting}` })).toBeVisible();
  await a.getByRole("checkbox", { name: `للتنفيذ → ${waiting}` }).check();
  await a.getByRole("button", { name: "حفظ الانتقالات" }).click();
  await expect(a.getByRole("status")).toHaveText("تم الحفظ");

  await a.goto("/ar/projects");
  await a.getByRole("link", { name: new RegExp(project) }).click();
  await a.getByRole("link", { name: "لوحة" }).click();
  await expect(a.getByRole("region", { name: waiting, exact: true })).toBeVisible();

  // deleting a status moves its tasks (even against the transition rules)
  await a.goto("/ar/settings/workflow");
  const todo = a.getByRole("listitem").filter({ has: a.getByText("للتنفيذ", { exact: true }) }).first();
  await todo.getByText(/حفظ \/ حذف/).click();
  await todo.getByRole("combobox").last().selectOption({ label: waiting });
  await todo.getByRole("button", { name: "حذف" }).click();
  await expect(a.getByRole("listitem").filter({ has: a.getByText("للتنفيذ", { exact: true }) })).toHaveCount(0);

  // search finds the task, now in the new status
  await a.getByRole("searchbox", { name: "بحث" }).first().fill(`النفايات ${run}`);
  await a.getByRole("searchbox", { name: "بحث" }).first().press("Enter");
  await expect(a).toHaveURL(/\/ar\/search\?q=/);
  await a.getByRole("link", { name: /جمع النفايات/ }).click();
  await expect(a.getByRole("complementary").locator('select[name="status_id"]')).toHaveValue(/.+/);
  await expect(a.getByRole("complementary").locator('select[name="status_id"] option:checked')).toHaveText(waiting);
  await expect(a.getByRole("complementary")).toContainText(`فاطمة ${run}`);
});
