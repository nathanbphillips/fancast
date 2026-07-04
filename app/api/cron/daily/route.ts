import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db/server";
import { matchPendingFixtures } from "@/lib/adminFixtures";
import { sweepNoShowRooms, syncFixtures } from "@/lib/fixtures";
import { autoCreateSubscriptionRooms } from "@/lib/seasonHosting";
import { drainDue } from "@/lib/notify/outbox";
import { recomputeAll } from "@/lib/fanScore";

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
    // the daily cron is the single serialized sync: it alone emits room_change
    // notifications (the opportunistic page sync stays notify-off to avoid
    // concurrent double-notify)
    results.fixtureSync = await syncFixtures(service, { notify: true });
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
  // FR-21.4: drain any due notifications (the daily backstop under the
  // opportunistic route drains). Larger batch since this is the guaranteed run.
  try {
    results.notificationDrain = await drainDue(service, 200);
  } catch (err) {
    results.notificationDrain = { ok: false, reason: String(err) };
  }
  // FR-24.5: nightly full fan-score recompute (self-heal drift + weighting)
  try {
    results.fanScoreRecompute = await recomputeAll(service);
  } catch (err) {
    results.fanScoreRecompute = { ok: false, reason: String(err) };
  }

  console.log("daily cron:", JSON.stringify(results));
  return NextResponse.json(results);
}
