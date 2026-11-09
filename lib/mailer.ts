import "server-only";
import nodemailer from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends one email through the first transport that is configured:
 *  1. Resend API (RESEND_API_KEY) — free tier, needs the association's domain;
 *  2. any SMTP server (SMTP_HOST…) — e.g. a free Gmail account with an app password;
 *  3. the local Mailpit inbox (MAILPIT_URL) in development.
 * Returns false if none is set or sending failed.
 */
export async function sendMail(mail: Mail): Promise<boolean> {
  const from = process.env.MAIL_FROM ?? "AFMI <noreply@afmi.local>";
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html }),
    });
    return res.ok;
  }
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    try {
      await transport.sendMail({ from, to: mail.to, subject: mail.subject, html: mail.html });
      return true;
    } catch (e) {
      console.error("smtp send failed", e instanceof Error ? e.message : e);
      return false;
    }
  }
  if (process.env.MAILPIT_URL) {
    const m = from.match(/^(.*)<(.+)>$/);
    const res = await fetch(`${process.env.MAILPIT_URL}/api/v1/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        From: { Email: m ? m[2].trim() : from, Name: m ? m[1].trim() : "" },
        To: [{ Email: mail.to }],
        Subject: mail.subject,
        HTML: mail.html,
      }),
    });
    return res.ok;
  }
  return false;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
