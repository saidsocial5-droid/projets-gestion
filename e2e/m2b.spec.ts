import { test, expect } from "@playwright/test";
import { emailLink, invite, signIn } from "./helpers";

const run = Date.now();
const owner = `boss-${run}@afmi.test`;
const guest = `partner-${run}@donor.test`;
const guestName = `partner-${run}`;
const shared = `مشروع مشترك ${run}`;
const internal = `مشروع داخلي ${run}`;

test("M2b guests and roles: invite by email, see one project only, role change, removal", async ({ browser }) => {
  await invite(owner, "admin");
  const ctx = { viewport: { width: 1280, height: 900 } };
  const a = await (await browser.newContext(ctx)).newPage();
  await signIn(a, owner);

  for (const name of [internal, shared]) {
    await a.goto("/ar/projects");
    await a.getByRole("button", { name: "+ مشروع جديد" }).click();
    await a.locator('input[name="name"]').fill(name);
    await a.getByRole("button", { name: "إنشاء" }).click();
    await expect(a).toHaveURL(/\/list$/);
  }
  await a.getByRole("textbox", { name: "أضف مهمة…" }).fill("تقرير مرحلي للشريك");
  await a.getByRole("textbox", { name: "أضف مهمة…" }).press("Enter");
  await expect(a.getByRole("link", { name: /تقرير مرحلي/ })).toBeVisible();

  // invite the partner to the shared project only; the email goes out immediately
  const since = Date.now();
  await a.getByRole("link", { name: "الإعدادات" }).last().click();
  await a.getByLabel("دعوة ضيف (شريك، مانح…) بالبريد").fill(guest);
  await a.getByRole("button", { name: "دعوة", exact: true }).click();
  await expect(a.getByRole("status")).toHaveText("أرسلنا الدعوة");
  await expect(a.getByText(guest)).toBeVisible();

  // the guest opens the email link in their own browser (no PKCE state needed)
  const g = await (await browser.newContext(ctx)).newPage();
  await g.goto(await emailLink(guest, since));
  await expect(g).toHaveURL(/\/ar\/home$/);
  await g.goto("/ar/projects");
  await expect(g.getByRole("link", { name: new RegExp(shared) })).toBeVisible();
  await expect(g.getByRole("link", { name: new RegExp(internal) })).toHaveCount(0);
  await expect(g.getByRole("button", { name: "+ مشروع جديد" })).toHaveCount(0);
  await expect(g.getByRole("link", { name: "الأعضاء" })).toHaveCount(0);

  // viewer: read only, no settings tab, no comment box
  await g.getByRole("link", { name: new RegExp(shared) }).click();
  await expect(g.getByRole("link", { name: /تقرير مرحلي/ })).toBeVisible();
  await expect(g.getByRole("textbox", { name: "أضف مهمة…" })).toHaveCount(0);
  await expect(g.getByRole("link", { name: "الإعدادات" })).toHaveCount(0);
  await g.getByRole("link", { name: /تقرير مرحلي/ }).click();
  await expect(g.getByRole("textbox", { name: /اكتب تعليقاً/ })).toHaveCount(0);

  // the owner makes the guest a commenter
  await a.reload();
  const row = a.getByRole("listitem").filter({ hasText: guestName });
  await expect(row.getByText("ضيف")).toBeVisible();
  await row.getByRole("combobox").selectOption("commenter");
  await g.reload();
  await expect(g.getByRole("textbox", { name: /اكتب تعليقاً/ })).toBeVisible();

  // removing the guest from the association cuts access everywhere
  a.on("dialog", (d) => d.accept());
  await a.goto("/ar/settings/members");
  await a.getByRole("listitem").filter({ hasText: guestName }).getByRole("button", { name: "إزالة" }).click();
  await expect(a.getByRole("listitem").filter({ hasText: guestName })).toHaveCount(0);
  await g.goto("/ar/projects");
  await expect(g).toHaveURL(/\/ar\/no-access$/);
});
