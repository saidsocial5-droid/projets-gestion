import "server-only";

export interface Mail {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends one email. Resend in production (RESEND_API_KEY); the local Mailpit
 * inbox in development (MAILPIT_URL). Returns false if no transport is set.
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
