// Drives the real desktop app (Electron) against a running platform.
// Run from the repository root:  xvfb-run npx playwright test -c desktop/test/playwright.config.ts
import { test, expect, _electron as electron, type ElectronApplication } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { emailCode, invite } from "../../e2e/helpers";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const appDir = path.join(__dirname, "..");
const profile = mkdtempSync(path.join(tmpdir(), "afmi-desktop-"));
const run = Date.now();
const user = `desk-${run}@afmi.test`;

function launch() {
  return electron.launch({ executablePath: path.join(appDir, "node_modules", "electron", "dist", "electron"), args: ["--no-sandbox", appDir], env: { ...process.env, AFMI_USER_DATA: profile, ELECTRON_DISABLE_SECURITY_WARNINGS: "1" } });
}

test("desktop app: first-run setup, code login, session kept after restart, external links leave the app", async () => {
  await invite(user, "member");
  let app: ElectronApplication = await launch();
  let win = await app.firstWindow();

  // first run: ask for the platform address
  await expect(win.locator("h1")).toHaveText("مرحباً بك في منصة مشاريع AFMI");
  await expect(win.locator("html")).toHaveAttribute("dir", "rtl");
  await win.locator("#url").fill("http://example.com");
  await win.locator("#save").click();
  await expect(win.locator("#error")).toHaveText(/غير صالح/);
  await win.locator("#url").fill(BASE);
  await win.locator("#save").click();

  // the platform opens inside the app window, on the login page
  await win.waitForURL(/\/ar\/login$/);
  const since = Date.now();
  await win.getByLabel("البريد الإلكتروني").fill(user);
  await win.getByRole("button", { name: "أرسل رمز الدخول" }).click();
  await win.getByLabel("رمز الدخول").fill(await emailCode(user, since));
  await win.getByRole("button", { name: "دخول" }).click();
  await win.waitForURL(/\/ar\/home$/);
  if (process.env.SHOTS_DIR) await win.screenshot({ path: `${process.env.SHOTS_DIR}/desktop-home-ar.png` });

  // links outside the platform go to the system browser, not a new app window
  await app.evaluate(({ shell }) => {
    (globalThis as unknown as { opened: string[] }).opened = [];
    shell.openExternal = async (url: string) => { (globalThis as unknown as { opened: string[] }).opened.push(url); };
  });
  await win.evaluate(() => window.open("https://example.org/doc.pdf"));
  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened)).toEqual(["https://example.org/doc.pdf"]);
  expect(app.windows()).toHaveLength(1);

  // the local bridge refuses calls coming from the remote platform
  const fromPlatform = await win.evaluate(() => (window as unknown as { afmi: { saveUrl: (u: string) => Promise<{ ok: boolean }> } }).afmi.saveUrl("https://evil.example"));
  expect(fromPlatform.ok).toBe(false);

  // restart: address and session are remembered
  await app.close();
  app = await launch();
  win = await app.firstWindow();
  await win.waitForURL(/\/ar\/home$/);
  await expect(win.getByRole("heading", { level: 1 })).toContainText("مرحباً");
  await app.close();
});
