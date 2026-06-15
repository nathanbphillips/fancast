import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/db/server";
import { safeNextPath } from "@/lib/redirect";
import { THEME_COOKIE, themeCookieOptions, type ThemeChoice } from "@/lib/theme";

/**
 * Auth landing for both sign-in paths:
 *  - OAuth (Google) and PKCE magic links arrive with ?code=
 *  - token-hash style magic links arrive with ?token_hash=&type=
 * On success: new users (no profile yet) go to /welcome to pick a username,
 * returning users go home (or to ?next=).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"));

  const supabase = await createSupabaseServerClient();

  let authError: string | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authError = error?.message ?? null;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    authError = error?.message ?? null;
  } else {
    authError = "missing auth parameters";
  }

  if (authError) {
    return NextResponse.redirect(
      new URL(`/signin?error=${encodeURIComponent(authError)}`, url.origin),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let themePref: ThemeChoice | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, theme_pref")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.redirect(new URL("/welcome", url.origin));
    }
    themePref = (profile.theme_pref as ThemeChoice | null) ?? null;
  }

  // Seed the no-flash cookie from the account theme so a fresh device paints
  // correctly on the very next load (M-11).
  const res = NextResponse.redirect(new URL(next, url.origin));
  if (themePref) res.cookies.set(THEME_COOKIE, themePref, themeCookieOptions);
  return res;
}
