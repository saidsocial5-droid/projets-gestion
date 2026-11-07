import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Email-link landing. The email template links here with ?token_hash=…&type=email,
 * verified server side (works from any browser). A PKCE ?code=… is accepted too.
 * Then claims invitations / bootstraps the workspace and routes the user.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "fr" ? "fr" : "ar";
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "email") as EmailOtpType;
  // request.url can carry the server's bind address; redirect to the host the browser used
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const origin = `${proto}://${host}`;
  const supabase = await createClient();

  const { error } = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("missing token") };
  if (error) return NextResponse.redirect(new URL(`/${locale}/login?error=1`, origin));

  const { data: workspaceId } = await supabase.rpc("bootstrap_or_join");
  const target = workspaceId ? `/${locale}/home` : `/${locale}/no-access`;
  return NextResponse.redirect(new URL(target, origin));
}
