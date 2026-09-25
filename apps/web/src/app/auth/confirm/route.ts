import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Landing point for the links in Supabase Auth emails (confirm sign-up, reset
// password, magic link). Supports both link styles: `?code=` (PKCE) and
// `?token_hash=&type=` (what our branded email templates use). On success the
// person has a session and is sent on to `next`; otherwise to a page that
// explains the link is no good.
function safeNext(next: string | null): string {
  // Only same-site paths, never let an email link bounce someone elsewhere.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  return NextResponse.redirect(`${origin}${ok ? next : "/login?link=invalid"}`);
}
