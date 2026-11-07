import { test, expect } from "@playwright/test";
import { inDays, invite, signIn } from "./helpers";

const run = Date.now();
const owner = `owner-${run}@afmi.test`;
const helper = `helper${run}@afmi.test`;
const helperName = `helper${run}`;
const project = `حملة توعية ${run}`;
const task = "إعداد ملصقات التوعية";

test("M2a collaboration: subtasks, attachment, @mention, notifications, my tasks, home", async ({ browser }) => {
  await invite(owner, "admin");
  await invite(helper, "member");
  const ctx = { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 };

  // the helper signs in once so they exist and can be assigned
  const b = await (await browser.newContext(ctx)).newPage();
  await signIn(b, helper);
  await expect(b).toHaveURL(/\/ar\/home$/);

  const a = await (await browser.newContext(ctx)).newPage();
  await signIn(a, owner);
  await a.getByRole("navigation").getByRole("link", { name: "المشاريع" }).click();
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(project);
  await a.getByRole("button", { name: "إنشاء" }).click();
  await a.getByRole("textbox", { name: "أضف مهمة…" }).fill(task);
  await a.getByRole("textbox", { name: "أضف مهمة…" }).press("Enter");
  await a.getByRole("link", { name: new RegExp(task) }).click();

  const panel = a.getByRole("complementary");
  await panel.locator('select[name="assignee_id"]').selectOption({ label: helperName });
  await panel.locator('input[name="due_date"]').fill(inDays(3));
  await panel.getByRole("button", { name: "حفظ" }).click();
  await expect(panel.getByRole("status")).toHaveText("تم الحفظ");

  // subtasks are a checklist: ticking one ignores the workflow transition rules
  await panel.getByRole("textbox", { name: "أضف مهمة فرعية…" }).fill("طباعة 200 ملصق");
  await panel.getByRole("textbox", { name: "أضف مهمة فرعية…" }).press("Enter");
  await panel.getByRole("textbox", { name: "أضف مهمة فرعية…" }).fill("توزيع الملصقات");
  await panel.getByRole("textbox", { name: "أضف مهمة فرعية…" }).press("Enter");
  await panel.getByRole("checkbox", { name: "طباعة 200 ملصق" }).check();
  await expect(panel.getByText("1/2")).toBeVisible();

  // attachment goes to Supabase Storage through the storage RLS policy
  await panel.locator('input[type="file"]').setInputFiles({ name: "ملصق.txt", mimeType: "text/plain", buffer: Buffer.from("affiche AFMI") });
  await expect(panel.getByRole("link", { name: "ملصق.txt" })).toBeVisible();
  await expect(panel.getByText(/إرفاق .?ملصق\.txt/)).toBeVisible();

  // comment with an @mention picked from the suggestions
  const box = panel.getByRole("textbox", { name: /اكتب تعليقاً/ });
  await box.fill("المرجو المراجعة @help");
  await panel.getByRole("option").getByRole("button", { name: `@${helperName}` }).click();
  await box.pressSequentially("قبل الجمعة");
  await panel.getByRole("button", { name: "إرسال" }).click();
  await expect(panel.locator("mark", { hasText: `@${helperName}` })).toBeVisible();
  if (process.env.SHOTS_DIR) await a.screenshot({ path: `${process.env.SHOTS_DIR}/task-panel-ar.png`, fullPage: false });

  // the helper is notified (assigned + comment + file) and lands on the task from the inbox
  await b.goto("/ar/home");
  await expect(b.getByRole("navigation").getByRole("link", { name: /الإشعارات/ })).toContainText(/\d/);
  await expect(b.getByRole("link", { name: new RegExp(task) }).first()).toBeVisible(); // due in 3 days → "due soon"
  await b.getByRole("navigation").getByRole("link", { name: /الإشعارات/ }).click();
  await b.getByRole("link", { name: /تعليق: «المرجو المراجعة/ }).click();
  await expect(b).toHaveURL(/\/p\/[0-9a-f-]+\/list\?task=/);
  const bPanel = b.getByRole("complementary");
  await expect(bPanel.getByText("قبل الجمعة")).toBeVisible();
  const href = await bPanel.getByRole("link", { name: "ملصق.txt" }).getAttribute("href");
  expect(await (await fetch(href!)).text()).toBe("affiche AFMI");

  // the opened notification is read; my tasks lists the assignment
  await b.goto("/ar/my-tasks");
  await expect(b.getByRole("heading", { name: /هذا الأسبوع/ })).toBeVisible();
  await expect(b.getByRole("link", { name: new RegExp(task) })).toBeVisible();
  if (process.env.SHOTS_DIR) {
    await b.goto("/ar/inbox");
    await b.screenshot({ path: `${process.env.SHOTS_DIR}/inbox-ar.png` });
  }
});
