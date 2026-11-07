import { test, expect } from "@playwright/test";
import { invite, signIn } from "./helpers";

const run = Date.now();
const owner = `fields-${run}@afmi.test`;
const project = `مخيمات بيئية ${run}`;
const region = `المنطقة ${String(run).slice(-4)}`;
const people = `المستفيدون ${String(run).slice(-4)}`;

test("M3b custom fields and list filters", async ({ browser }) => {
  await invite(owner, "admin");
  const a = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await signIn(a, owner);

  // define two fields
  await a.getByRole("navigation").getByRole("link", { name: "الإعدادات" }).click();
  await a.getByRole("link", { name: /الحقول/ }).click();
  await a.getByLabel("اسم الحقل").fill(region);
  await a.getByLabel("الخيارات (افصل بفاصلة)").fill("إفران، أزرو، الحاجب");
  await a.getByRole("button", { name: "إنشاء" }).click();
  await expect(a.getByText(region)).toBeVisible();
  await a.getByLabel("اسم الحقل").fill(people);
  await a.getByLabel("النوع").selectOption("number");
  await a.getByRole("button", { name: "إنشاء" }).click();
  await expect(a.getByText(people)).toBeVisible();

  // project with both fields
  await a.goto("/ar/projects");
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(project);
  await a.getByRole("button", { name: "إنشاء" }).click();
  for (const title of ["مخيم الربيع", "مخيم الصيف"]) {
    await a.getByRole("textbox", { name: "أضف مهمة…" }).fill(title);
    await a.getByRole("textbox", { name: "أضف مهمة…" }).press("Enter");
    await expect(a.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  }
  await a.getByRole("link", { name: "الإعدادات" }).last().click();
  await a.getByRole("checkbox", { name: new RegExp(region) }).check();
  await a.getByRole("checkbox", { name: new RegExp(people) }).check();
  await expect(a.getByRole("checkbox", { name: new RegExp(people) })).toBeChecked();

  // set values in the task panel
  await a.getByRole("link", { name: "قائمة" }).click();
  const panel = a.getByRole("complementary");
  await a.getByRole("link", { name: /مخيم الربيع/ }).click();
  await expect(panel.locator('input[name="title"]')).toHaveValue("مخيم الربيع");
  await panel.getByLabel(region).selectOption({ label: "إفران" });
  await expect(a.getByRole("link", { name: /مخيم الربيع/ })).toContainText("إفران");
  await a.getByRole("link", { name: /مخيم الصيف/ }).click();
  await expect(panel.locator('input[name="title"]')).toHaveValue("مخيم الصيف");
  await panel.getByLabel(region).selectOption({ label: "أزرو" });
  await expect(a.getByRole("link", { name: /مخيم الصيف/ })).toContainText("أزرو");
  await panel.getByLabel(people).fill("120");
  await panel.getByLabel(people).blur();
  await expect(a.getByRole("link", { name: /مخيم الصيف/ })).toContainText("120");
  await panel.getByRole("link", { name: "إغلاق" }).click();

  // filter by the custom field: the URL carries the filter
  await a.getByRole("search", { name: "تصفية" }).getByLabel(region).selectOption({ label: "أزرو" });
  await expect(a).toHaveURL(/f_[0-9a-f-]+=/);
  await expect(a.getByRole("link", { name: /مخيم الصيف/ })).toBeVisible();
  await expect(a.getByRole("link", { name: /مخيم الربيع/ })).toHaveCount(0);
  await expect(a.getByRole("status").filter({ hasText: "1 من 2 مهمة" })).toBeVisible();
  if (process.env.SHOTS_DIR) await a.screenshot({ path: `${process.env.SHOTS_DIR}/list-fields-ar.png` });

  // reload keeps the filter; "clear" removes it
  await a.reload();
  await expect(a.getByRole("link", { name: /مخيم الربيع/ })).toHaveCount(0);
  await a.getByRole("button", { name: "مسح" }).click();
  await expect(a.getByRole("link", { name: /مخيم الربيع/ })).toBeVisible();
});
