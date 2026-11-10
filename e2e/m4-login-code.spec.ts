import { test, expect } from "@playwright/test";
import { emailCode, invite } from "./helpers";

const run = Date.now();
const user = `code-${run}@afmi.test`;

test("sign in with the 6-digit code (desktop app flow), wrong code refused", async ({ page }) => {
  await invite(user, "member");
  const since = Date.now();
  await page.goto("/ar/login");
  await page.getByLabel("البريد الإلكتروني").fill(user);
  await page.getByRole("button", { name: "أرسل رمز الدخول" }).click();
  await expect(page.getByRole("status")).toContainText("رمزاً من 6 أرقام");
  const code = await emailCode(user, since);

  await page.getByLabel("رمز الدخول").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "الرمز غير صحيح" })).toBeVisible();

  await page.getByLabel("رمز الدخول").fill(code);
  await page.getByRole("button", { name: "دخول" }).click();
  await expect(page).toHaveURL(/\/ar\/(home|no-access)$/);
});
