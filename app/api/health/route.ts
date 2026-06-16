import { NextResponse } from "next/server";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

/**
 * Admin-only deployment health probe. Reports whether each required env var is
 * PRESENT in this deployment — booleans only, never the values — so an operator
 * (and scripts/prod-smoke.ts) can confirm Vercel is fully configured before a
 * live session, including the S3 + server LiveKit vars that a read-only token
 * check can't exercise. Admin-gated so it isn't a public stack-enumeration.
 */
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_S3_ENDPOINT",
  "SUPABASE_S3_REGION",
  "SUPABASE_S3_ACCESS_KEY",
  "SUPABASE_S3_SECRET_KEY",
  "ABLY_API_KEY",
  "LIVEKIT_URL",
  "NEXT_PUBLIC_LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "APIFOOTBALL_KEY",
  "ADMIN_USER_IDS",
  "NEXT_PUBLIC_APP_URL",
] as const;

export async function GET() {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!isAdmin(user?.id, profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const env: Record<string, boolean> = {};
  for (const key of REQUIRED) env[key] = Boolean(process.env[key]);
  return NextResponse.json({ ok: true, env });
}
