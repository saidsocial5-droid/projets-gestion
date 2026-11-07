import { execSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Signs in through the real magic-link flow, reading the email from the local Mailpit inbox. */
export async function signIn(page: Page, email: string, locale = "ar") {
  const since = Date.now();
  await page.goto(`/${locale}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('form button').click();
  await expect(page.getByRole("status")).toBeVisible();

  let link: string | undefined;
  for (let i = 0; i < 30 && !link; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string; Created: string }[] };
    const fresh = messages.find((m) => new Date(m.Created).getTime() >= since - 2000);
    if (fresh) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { Text: string; HTML: string };
      link = (msg.HTML.match(/href="([^"]*verify[^"]*)"/)?.[1] ?? msg.Text.match(/(http\S*verify\S*)/)?.[1])?.replace(/&amp;/g, "&");
    }
    if (!link) await new Promise((r) => setTimeout(r, 500));
  }
  if (!link) throw new Error(`no magic link for ${email}`);
  await page.goto(link);
}

/** Drags a board card onto a column using real pointer events (dnd-kit needs movement past its 6px threshold). */
export async function dragCard(page: Page, cardText: string, columnLabel: string) {
  const card = page.locator("[data-task-id]", { hasText: cardText });
  const column = page.getByRole("region", { name: columnLabel, exact: true });
  const from = (await card.boundingBox())!;
  const to = (await column.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 });
  await page.mouse.up();
}

const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
// local stack only: read the secret key from `supabase status` (never committed)
function serviceKey(): string {
  if (process.env.SUPABASE_SECRET_KEY) return process.env.SUPABASE_SECRET_KEY;
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const key = out.match(/^SECRET_KEY="?([^"\n]+)"?/m)?.[1];
  if (!key) throw new Error("set SUPABASE_SECRET_KEY or start the local Supabase stack");
  process.env.SUPABASE_SECRET_KEY = key;
  return key;
}

async function rest(path: string, init: RequestInit = {}) {
  const SERVICE = serviceKey();
  const res = await fetch(`${API}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Test setup only: creates an invitation with the service key (skips the admin UI). */
export async function invite(email: string, role: "admin" | "member" | "guest", project?: { id: string; role: string }) {
  const [ws] = (await rest("workspaces?select=id&limit=1")) as { id: string }[];
  if (!ws) return; // empty database: the first sign-in bootstraps the workspace and becomes admin
  await rest("invitations", {
    method: "POST",
    body: JSON.stringify({ workspace_id: ws.id, email, workspace_role: role, project_id: project?.id ?? null, project_role: project?.role ?? null }),
  });
}

export function inDays(n: number) {
  const d = new Date(Date.now() + n * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(d);
}
