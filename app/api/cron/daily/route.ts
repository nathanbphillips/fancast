import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db/server";
import { matchPendingFixtures } from "@/lib/adminFixtures";
import { sweepNoShowRooms, syncFixtures } from "@/lib/fixtures";
import { autoCreateSubscriptionRooms } from "@/lib/seasonHosting";

// league-wide sync + matching can take a moment
export const maxDuration = 300;

/**
 * THE daily platform cron (founder ruling 2026-07-03: everything fits Vercel
 * Hobby's once-daily crons). One entry point fans out:
 *   1. league-wide fixture sync (FR-19.5) incl. moved/postponed room handling
 *   2. admin-game auto-matching (the old /api/admin/match-fixtures cron)
 *   3. no-show room expiry (FR-19.7)
 * Later phases append here: subscription auto-creation (FR-20.2), notification
 * retry sweep (FR-21.4), profile-stats recompute (FR-24.5). Authenticated with
 * Bearer CRON_SECRET like the previous cron; the manual admin triggers stay.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const service = createServiceClient();
  const results: Record<string, unknown> = {};

  try {
    results.fixtureSync = await syncFixtures(service);
  } catch (err) {
    results.fixtureSync = { ok: false, reason: String(err) };
  }
  // FR-20.2: after the sync, active subscriptions pick up newly-appearing
  // fixtures (rescheduled dates already followed inside syncFixtures)
  try {
    results.subscriptionRooms = await autoCreateSubscriptionRooms(service);
  } catch (err) {
    results.subscriptionRooms = { ok: false, reason: String(err) };
  }
  try {
    results.adminMatch = await matchPendingFixtures(service);
  } catch (err) {
    results.adminMatch = { ok: false, reason: String(err) };
  }
  try {
    results.noShowSweep = await sweepNoShowRooms(service);
  } catch (err) {
    results.noShowSweep = { ok: false, reason: String(err) };
  }

  console.log("daily cron:", JSON.stringify(results));
  return NextResponse.json(results);
}
