import "server-only";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function appOrigin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/**
 * Sends the sign-in email to someone else (an invitee). Uses a cookie-less client so the
 * inviter's session is untouched; the email's token_hash link works in the invitee's browser.
 */
export async function sendSignInEmail(email: string, locale: "ar" | "fr"): Promise<boolean> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" },
  });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await appOrigin()}/auth/callback?locale=${locale}` },
  });
  return !error;
}
