import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml, sendMail } from "./mailer";
import { todayInMorocco } from "./dates";

/** Service client: bypasses RLS. Only for background jobs; every query below is scoped to one user by hand. */
function service(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}

const TEXT = {
  ar: {
    subject: "ملخصك اليومي — مشاريع AFMI",
    hello: (n: string) => `مرحباً ${n}،`,
    due: "مهامك المتأخرة أو المستحقة اليوم وغداً",
    news: "جديد منذ آخر ملخص",
    overdue: "متأخرة",
    open: "افتح المنصة",
    footer: "يمكنك إيقاف هذه الرسائل من صفحة «ملفي».",
    action: { "task.assigned": "أسند إليك مهمة", "task.status_changed": "غيّر حالة مهمة", "task.completed": "أنجز مهمة", "comment.created": "علّق على", "attachment.added": "أرفق ملفاً في", "status_update.posted": "نشر تحديث حالة لـ", "task.created": "أنشأ مهمة", default: "حدّث" } as Record<string, string>,
  },
  fr: {
    subject: "Votre résumé du jour — Projets AFMI",
    hello: (n: string) => `Bonjour ${n},`,
    due: "Vos tâches en retard ou à rendre aujourd'hui et demain",
    news: "Nouveautés depuis le dernier résumé",
    overdue: "en retard",
    open: "Ouvrir la plateforme",
    footer: "Vous pouvez désactiver ces e-mails depuis « Mon profil ».",
    action: { "task.assigned": "vous a assigné", "task.status_changed": "a changé le statut de", "task.completed": "a terminé", "comment.created": "a commenté", "attachment.added": "a joint un fichier à", "status_update.posted": "a publié un point sur", "task.created": "a créé", default: "a mis à jour" } as Record<string, string>,
  },
};

interface Result { sent: number; skipped: number; failed: number }

/** Sends at most one digest per person per day (profiles.last_digest_on) and marks the notifications it covered. */
export async function runDigest(appUrl: string, today = todayInMorocco()): Promise<Result> {
  const db = service();
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const result: Result = { sent: 0, skipped: 0, failed: 0 };

  const { data: profiles } = await db.from("profiles").select("id, full_name, locale, notify_email, last_digest_on").eq("notify_email", true);
  const emails = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) emails.set(u.id, u.email);
    if (!data || data.users.length < 1000) break;
  }

  for (const p of profiles ?? []) {
    const email = emails.get(p.id);
    if (!email || p.last_digest_on === today) { result.skipped++; continue; }
    const [{ data: tasks }, { data: notes }] = await Promise.all([
      db.from("tasks").select("id, title, due_date, parent_task_id, project:projects!inner(id, name, archived_at, is_template)")
        .eq("assignee_id", p.id).is("completed_at", null).lte("due_date", tomorrow)
        .is("project.archived_at", null).eq("project.is_template", false).order("due_date").limit(30),
      db.from("notifications").select("id, activity:activities(action, actor:profiles(full_name), task:tasks(title), project:projects(name))")
        .eq("user_id", p.id).is("read_at", null).is("emailed_at", null).order("created_at").limit(30),
    ]);
    const due = (tasks ?? []) as unknown as { id: string; title: string; due_date: string; parent_task_id: string | null; project: { id: string; name: string } }[];
    const news = (notes ?? []) as unknown as { id: string; activity: { action: string; actor: { full_name: string } | null; task: { title: string } | null; project: { name: string } | null } }[];
    if (!due.length && !news.length) { result.skipped++; continue; }

    const L = p.locale === "fr" ? "fr" : "ar";
    const T = TEXT[L];
    const base = `${appUrl}/${L}`;
    const li = (s: string) => `<li style="margin:4px 0">${s}</li>`;
    const html = `<!doctype html><html lang="${L}" dir="${L === "ar" ? "rtl" : "ltr"}"><body style="font-family:Arial,sans-serif;color:#1c1f1a;line-height:1.6">
<p>${escapeHtml(T.hello(p.full_name))}</p>
${due.length ? `<h3>${T.due}</h3><ul>${due.map((t) => li(`<a href="${base}/p/${t.project.id}/list?task=${t.parent_task_id ?? t.id}">${escapeHtml(t.title)}</a> — ${escapeHtml(t.project.name)} · ${t.due_date}${t.due_date < today ? ` <b style="color:#e11d48">${T.overdue}</b>` : ""}`)).join("")}</ul>` : ""}
${news.length ? `<h3>${T.news}</h3><ul>${news.map((n) => li(`${escapeHtml(n.activity.actor?.full_name ?? "—")} ${T.action[n.activity.action] ?? T.action.default} «${escapeHtml(n.activity.task?.title ?? n.activity.project?.name ?? "")}»`)).join("")}</ul>` : ""}
<p><a href="${base}/home" style="background:#23703f;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">${T.open}</a></p>
<p style="color:#5d6459;font-size:12px">${T.footer}</p></body></html>`;

    // claim the day first so a concurrent or repeated run cannot send twice
    const { data: claimed } = await db.from("profiles").update({ last_digest_on: today }).eq("id", p.id)
      .or(`last_digest_on.is.null,last_digest_on.neq.${today}`).select("id");
    if (!claimed?.length) { result.skipped++; continue; }

    const ok = await sendMail({ to: email, subject: T.subject, html });
    if (!ok) {
      await db.from("profiles").update({ last_digest_on: p.last_digest_on }).eq("id", p.id);
      result.failed++;
      continue;
    }
    if (news.length) await db.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", news.map((n) => n.id));
    result.sent++;
  }
  return result;
}
