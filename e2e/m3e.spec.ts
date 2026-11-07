import { test, expect } from "@playwright/test";
import { invite, signIn } from "./helpers";

const run = Date.now();
const owner = `live-${run}@afmi.test`;
const mate = `mate-${run}@afmi.test`;
const project = `تحديث لحظي ${run}`;

test("M3e realtime: a change by one person appears for another without reloading", async ({ browser }) => {
  await invite(owner, "admin");
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await signIn(a, owner); // on an empty database this first sign-in creates the workspace
  await invite(mate, "member");
  const b = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await signIn(b, mate);

  await a.goto("/ar/projects");
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(project);
  await a.getByRole("button", { name: "إنشاء" }).click();
  await expect(a).toHaveURL(/\/list$/);
  const boardUrl = a.url().replace(/\/list$/, "/board");

  // the teammate watches the board
  await b.goto(boardUrl);
  await expect(b.getByRole("region").first()).toBeVisible();
  await b.waitForTimeout(1500); // let the realtime subscription join

  // the owner adds a task: it shows up on the teammate's board
  await a.getByRole("textbox", { name: "أضف مهمة…" }).fill("مهمة مباشرة");
  await a.getByRole("textbox", { name: "أضف مهمة…" }).press("Enter");
  await expect(b.locator("[data-task-id]", { hasText: "مهمة مباشرة" })).toBeVisible({ timeout: 10_000 });

  // the owner comments; then deletes the task: the teammate's board follows
  a.on("dialog", (d) => d.accept());
  await a.getByRole("link", { name: /مهمة مباشرة/ }).click();
  await a.getByRole("complementary").getByRole("button", { name: "حذف المهمة" }).click();
  await expect(b.locator("[data-task-id]", { hasText: "مهمة مباشرة" })).toHaveCount(0, { timeout: 10_000 });
});
