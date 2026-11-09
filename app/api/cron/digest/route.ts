import { NextResponse, type NextRequest } from "next/server";
import { runDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily digest. The GitHub Actions workflow .github/workflows/daily-digest.yml calls it with "Authorization: Bearer $CRON_SECRET". */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.SUPABASE_SECRET_KEY) return NextResponse.json({ error: "SUPABASE_SECRET_KEY missing" }, { status: 500 });
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const appUrl = process.env.APP_URL ?? `${proto}://${host}`;
  const result = await runDigest(appUrl);
  return NextResponse.json(result);
}
