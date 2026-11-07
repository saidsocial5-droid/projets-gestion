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
