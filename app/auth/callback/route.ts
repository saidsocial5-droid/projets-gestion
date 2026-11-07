import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Magic-link landing: exchanges the PKCE code, claims invitations / bootstraps the workspace, then routes the user. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const locale = url.searchParams.get("locale") === "fr" ? "fr" : "ar";
  // request.url can carry the server's bind address; redirect to the host the browser used
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const origin = `${proto}://${host}`;
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL(`/${locale}/login?error=1`, origin));
  }
  const { data: workspaceId } = await supabase.rpc("bootstrap_or_join");
  const target = workspaceId ? `/${locale}/home` : `/${locale}/no-access`;
  return NextResponse.redirect(new URL(target, origin));
}
