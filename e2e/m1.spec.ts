import { test, expect } from "@playwright/test";
import { dragCard, signIn } from "./helpers";

const run = Date.now();
const admin = `admin-${run}@afmi.test`;
const member = `member-${run}@afmi.test`;
const project = `تشجير الأطلس ${run}`;
const task = "غرس 1000 شجرة أرز";
const shots = process.env.SHOTS_DIR;

test("M1 vertical slice: sign in, create, move, workflow refusal, second user, French", async ({ browser }) => {
  // the database may already have a workspace from an earlier run; this test needs a fresh one
  // (run `npx supabase db reset` first). The first user to sign in becomes admin.
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
  await signIn(a, admin);
  await expect(a).toHaveURL(/\/ar\/projects$/);
  await expect(a.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(a.getByRole("heading", { name: "المشاريع" })).toBeVisible();

  // invite the second person
  await a.getByRole("link", { name: "الأعضاء" }).click();
  await a.locator('input[name="email"]').fill(member);
  await a.getByRole("button", { name: "دعوة" }).click();
  await expect(a.getByRole("status")).toHaveText("تمت الدعوة");
  await expect(a.getByText(member)).toBeVisible();

  // create a project and a task
  await a.getByRole("link", { name: "المشاريع" }).first().click();
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(project);
  await a.getByRole("button", { name: "إنشاء" }).click();
  await expect(a).toHaveURL(/\/p\/[0-9a-f-]+\/list$/);
  await a.getByRole("textbox", { name: "أضف مهمة…" }).fill(task);
  await a.getByRole("textbox", { name: "أضف مهمة…" }).press("Enter");
  await expect(a.getByRole("link", { name: new RegExp(task) })).toBeVisible();

  // edit it in the side panel
  await a.getByRole("link", { name: new RegExp(task) }).click();
  const panel = a.getByRole("complementary");
  await panel.locator('select[name="priority"]').selectOption("high");
  await panel.locator('input[name="due_date"]').fill("2026-12-15");
  await panel.getByRole("button", { name: "حفظ" }).click();
  await expect(panel.getByRole("status")).toHaveText("تم الحفظ");
  if (shots) await a.screenshot({ path: `${shots}/list-ar.png` });
  await panel.getByRole("link", { name: "إغلاق" }).click();

  // board: a forbidden move is refused by the database and the card goes back
  await a.getByRole("link", { name: "لوحة" }).click();
  await expect(a.getByRole("region", { name: "للتنفيذ", exact: true }).getByText(task)).toBeVisible();
  await dragCard(a, task, "منجز");
  await expect(a.getByRole("alert").filter({ hasText: "هذا الانتقال غير مسموح في سير العمل." })).toBeVisible();
  await expect(a.getByRole("region", { name: "للتنفيذ", exact: true }).getByText(task)).toBeVisible();

  // an allowed move sticks after reload
  await dragCard(a, task, "قيد التنفيذ");
  await expect(a.getByRole("region", { name: "قيد التنفيذ", exact: true }).getByText(task)).toBeVisible();
  await a.reload();
  await expect(a.getByRole("region", { name: "قيد التنفيذ", exact: true }).getByText(task)).toBeVisible();
  if (shots) await a.screenshot({ path: `${shots}/board-ar.png` });

  // second user claims the invitation on first sign-in and sees the same state
  const b = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
  await signIn(b, member, "fr");
  await expect(b).toHaveURL(/\/fr\/projects$/);
  await expect(b.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(b.getByRole("link", { name: "Membres" })).toHaveCount(0); // not an admin
  await b.getByRole("link", { name: new RegExp(project) }).click();
  await b.getByRole("link", { name: "Tableau" }).click();
  await expect(b.getByRole("region", { name: "En cours", exact: true }).getByText(task)).toBeVisible();
  await dragCard(b, task, "En revue");
  await expect(b.getByRole("region", { name: "En revue", exact: true }).getByText(task)).toBeVisible();
  if (shots) await b.screenshot({ path: `${shots}/board-fr.png` });

  // language switch keeps the page
  await b.getByRole("link", { name: "العربية" }).click();
  await expect(b).toHaveURL(/\/ar\/p\/[0-9a-f-]+\/board$/);
  await expect(b.locator("html")).toHaveAttribute("dir", "rtl");
});

test("signed-out users are sent to login; strangers get no access", async ({ page }) => {
  await page.goto("/ar/projects");
  await expect(page).toHaveURL(/\/ar\/login$/);
  await signIn(page, `stranger-${run}@example.test`);
  await expect(page).toHaveURL(/\/ar\/no-access$/);
  await expect(page.getByRole("heading", { name: "لا صلاحية لديك بعد" })).toBeVisible();
});
