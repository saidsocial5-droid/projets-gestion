import { test, expect } from "@playwright/test";
import { inDays, invite, signIn } from "./helpers";

const run = Date.now();
const owner = `boss3-${run}@afmi.test`;
const worker = `worker${run}@afmi.test`;
const task = `جرد المعدات ${run}`;
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const SECRET = process.env.CRON_SECRET ?? "local-cron-secret";

async function digestsTo(email: string) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email} subject:ملخصك`)}`);
  return ((await res.json()) as { messages: { ID: string }[] }).messages;
}

test("M3d daily digest: overdue task + comment, sent once per day, cron secret required", async ({ browser }) => {
  await invite(owner, "admin");
  await invite(worker, "member");
  const w = await (await browser.newContext()).newPage();
  await signIn(w, worker);
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await signIn(a, owner);

  await a.goto("/ar/projects");
  await a.getByRole("button", { name: "+ مشروع جديد" }).click();
  await a.locator('input[name="name"]').fill(`مخزن ${run}`);
  await a.getByRole("button", { name: "إنشاء" }).click();
  await a.getByRole("textbox", { name: "أضف مهمة…" }).fill(task);
  await a.getByRole("textbox", { name: "أضف مهمة…" }).press("Enter");
  await a.getByRole("link", { name: new RegExp(task) }).click();
  const panel = a.getByRole("complementary");
  await panel.locator('select[name="assignee_id"]').selectOption({ label: `worker${run}` });
  await panel.locator('input[name="due_date"]').fill(inDays(-1));
  await panel.getByRole("button", { name: "حفظ" }).click();
  await expect(panel.getByRole("status")).toHaveText("تم الحفظ");
  await panel.getByRole("textbox", { name: /اكتب تعليقاً/ }).fill("المرجو الإسراع");
  await panel.getByRole("button", { name: "إرسال" }).click();
  await expect(panel.getByText("المرجو الإسراع")).toBeVisible();

  // the cron endpoint refuses calls without the secret
  expect((await fetch(`${BASE}/api/cron/digest`)).status).toBe(401);

  const first = await (await fetch(`${BASE}/api/cron/digest`, { headers: { Authorization: `Bearer ${SECRET}` } })).json();
  expect(first.sent).toBeGreaterThanOrEqual(1);
  const mails = await digestsTo(worker);
  expect(mails).toHaveLength(1);
  const body = (await (await fetch(`${MAILPIT}/api/v1/message/${mails[0].ID}`)).json()) as { HTML: string };
  expect(body.HTML).toContain(task);
  expect(body.HTML).toContain("متأخرة");
  expect(body.HTML).toContain("علّق على");

  // a second run the same day sends nothing new to this person
  await fetch(`${BASE}/api/cron/digest`, { headers: { Authorization: `Bearer ${SECRET}` } });
  expect(await digestsTo(worker)).toHaveLength(1);
});
