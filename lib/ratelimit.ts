import type { NextRequest } from "next/server";

/**
 * In-memory per-key rate limiter (Phase 10 security closeout).
 *
 * IMPORTANT: on serverless (Vercel) the process memory is per-instance, so this
 * bounds abuse per warm lambda, NOT globally — a soft mitigation that blunts a
 * naive flood of the open, unauthenticated endpoints (which otherwise have no
 * per-user DB-window limit the way chat/flag/talk do). For a hard global limit,
 * move the bucket store to Upstash/Redis. Authenticated write paths keep their
 * existing per-user limits and don't need this.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Returns true if the call is allowed, false if the key is over its limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // opportunistic prune so the map can't grow unbounded across distinct keys
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
