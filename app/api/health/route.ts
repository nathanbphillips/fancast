import { NextResponse } from "next/server";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

/**
 * Admin-only deployment health probe. Reports whether each required env var is
 * PRESENT in this deployment — booleans only, never the values — so an operator
 * (and scripts/prod-smoke.ts) can confirm Vercel is fully configured before a
 * live session, including the S3 + server LiveKit vars that a read-only token
 * check can't exercise. Admin-gated so it isn't a public stack-enumeration.
 *
 * `env` is the contract scripts/prod-smoke.ts iterates and FAILS on, so nothing
 * gets added to it that a working deployment can legitimately lack. Anything
 * whose absence is a degraded-but-alive state goes in `optional` instead, and
 * `deploy` identifies WHICH build answered — scripts/preflight.ts compares that
 * commit against origin/main to catch "the fix isn't actually deployed yet".
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
  "SPORTMONKS_API_TOKEN",
  "ADMIN_USER_IDS",
  "NEXT_PUBLIC_APP_URL",
] as const;

/**
 * Absent = a feature is off or degraded, not that the deployment is broken.
 * Kept OUT of `env` so prod-smoke does not start failing, but several of these
 * are worse than "off" and scripts/preflight.ts escalates them:
 *   CRON_SECRET          - the daily cron hard-401s without it, so fixtures
 *                          silently stop syncing (match-day blocker)
 *   NOTIFY_TOKEN_SECRET  - falls back to the service key, then to the literal
 *                          "insecure-dev-secret", making unsubscribe tokens
 *                          forgeable rather than merely absent
 *   DEV_DOCS_PASSWORD    - middleware has a hardcoded fallback, so /dev-docs is
 *                          protected by a known literal when this is unset
 * Stripe is deliberately not listed: no code reads it yet, so requiring it
 * would be permanent false red.
 */
const OPTIONAL = [
  "CRON_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "SPORTMONKS_BASE",
  "NOTIFY_TOKEN_SECRET",
  "DEV_DOCS_PASSWORD",
] as const;

/**
 * URL-valued env, reported as HOST ONLY. A wrong host is the single most
 * common post-cutover failure (email links, OG cards and push all point at the
 * old domain) and the value is not a secret, unlike the keys above.
 */
const URL_HOSTS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "LIVEKIT_URL",
  "NEXT_PUBLIC_LIVEKIT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

function hostOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    // not a URL at all — that is itself worth seeing, without echoing a secret
    return "(not a valid URL)";
  }
}

/**
 * Opt-in, admin-only: does THIS DEPLOYMENT's Sportmonks token work?
 *
 * Presence of the env var says nothing about validity, and our own /api/stats
 * cannot answer it either: getFixtureStats serves last-good from memory forever
 * on error, so a warm lambda returns a healthy-looking payload long after the
 * token was revoked. Checking from a laptop only proves the LAPTOP's token.
 * Costs one metered call, so it runs only when explicitly asked for.
 */
async function sportmonksProbe(sportmonksFixtureId: number) {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) return { ok: false, reason: "SPORTMONKS_API_TOKEN is not set in this deployment" };
  const base = process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";
  try {
    // raw token, no "Bearer " prefix, matching every caller in lib/
    const res = await fetch(`${base}/fixtures/${sportmonksFixtureId}?include=league`, {
      headers: { Authorization: token },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        reason:
          res.status === 401
            ? "the deployment's token is wrong or revoked"
            : res.status === 403
              ? "the deployment's plan does not cover this competition"
              : `upstream returned ${res.status}`,
      };
    }
    const body = (await res.json()) as { data?: { league?: { name?: string } } };
    return { ok: true, status: 200, league: body.data?.league?.name ?? null };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
}

export async function GET(request: Request) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!isAdmin(user?.id, profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  if (params.get("probe") === "sportmonks") {
    const id = Number(params.get("fixture"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ probe: "sportmonks", ok: false, reason: "bad fixture id" }, { status: 400 });
    }
    return NextResponse.json({ probe: "sportmonks", ...(await sportmonksProbe(id)) });
  }

  const env: Record<string, boolean> = {};
  for (const key of REQUIRED) env[key] = Boolean(process.env[key]);
  const optional: Record<string, boolean> = {};
  for (const key of OPTIONAL) optional[key] = Boolean(process.env[key]);
  const hosts: Record<string, string | null> = {};
  for (const key of URL_HOSTS) hosts[key] = hostOf(process.env[key]);

  return NextResponse.json({
    ok: true,
    env,
    optional,
    hosts,
    deploy: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? "local",
      region: process.env.VERCEL_REGION ?? null,
      node: process.version,
    },
  });
}
