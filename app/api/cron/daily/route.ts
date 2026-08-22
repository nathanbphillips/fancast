import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db/server";
import { matchPendingFixtures } from "@/lib/adminFixtures";
import { sweepNoShowRooms, syncFixtures } from "@/lib/fixtures";
import { autoCreateSubscriptionRooms } from "@/lib/seasonHosting";
import { drainDue } from "@/lib/notify/outbox";
import { recomputeAll } from "@/lib/fanScore";
import { purgeRadio } from "@/lib/egress";

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

  // Radio prefixes purge 48h after a room ends (2026-08-22): the segments are
  // now the RECORDING SOURCE, so End Broadcast no longer deletes them - the
  // marker-adjust recut needs them - but a public byte-identical copy of the
  // show must not live forever either. 48h covers every realistic recut.
  try {
    results.radioSweep = await sweepRadio(service);
  } catch (err) {
    results.radioSweep = { ok: false, reason: String(err) };
  }

  // 60-day retention (founder 2026-08-05). Recordings and diagnostics both grow
  // without bound otherwise: recordings are the expensive one (storage objects),
  // events the noisy one. Deleting the storage objects first means a failure
  // here never orphans files with no DB row pointing at them.
  try {
    results.retention = await pruneOldData(service);
  } catch (err) {
    results.retention = { ok: false, reason: String(err) };
  }

  console.log("daily cron:", JSON.stringify(results));
  return NextResponse.json(results);
}

const RETENTION_DAYS = 60;

/** Purge public radio segments 48h after a room ends - but NEVER while they
 *  are still the only source of an unprocessed recording. A failed or stuck
 *  recording keeps its segments until it reaches a good terminal state (or
 *  until the 60-day retention backstop), because deleting them would turn a
 *  retryable failure into permanent loss mislabeled "empty" (review
 *  2026-08-22 - the exact catastrophe this pipeline exists to prevent). */
async function sweepRadio(service: ReturnType<typeof createServiceClient>) {
  const to = new Date(Date.now() - 48 * 3600_000).toISOString();
  const from = new Date(Date.now() - 70 * 24 * 3600_000).toISOString();
  const backstop = new Date(Date.now() - RETENTION_DAYS * 24 * 3600_000).toISOString();
  const { data: rooms } = await service
    .from("rooms")
    .select("id, ended_at")
    .not("ended_at", "is", null)
    .gte("ended_at", from)
    .lte("ended_at", to)
    .limit(50);
  let purged = 0;
  for (const r of rooms ?? []) {
    const { data: rec } = await service
      .from("recordings")
      .select("status")
      .eq("room_id", r.id as string)
      .maybeSingle();
    const terminalGood = !rec || ["ready", "damaged", "empty"].includes(String(rec.status));
    const pastBackstop = String(r.ended_at) < backstop;
    if (!terminalGood && !pastBackstop) continue; // still someone's only source
    const { data: any1 } = await service.storage.from("radio").list(r.id as string, { limit: 1 });
    if (!any1?.length) continue;
    await purgeRadio(service, r.id as string);
    purged++;
  }
  return { ok: true, purged };
}

/** Delete recordings + telemetry older than the retention window. */
async function pruneOldData(service: ReturnType<typeof createServiceClient>) {
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // --- recordings: storage objects first, then the rows ---
  const { data: old } = await service
    .from("recordings")
    .select("id, room_id, full_mp3_path, zip_path, source_path")
    .lt("started_at", cutoff);
  let filesDeleted = 0;
  for (const rec of old ?? []) {
    const { data: segs } = await service
      .from("recording_segments")
      .select("storage_path")
      .eq("recording_id", rec.id as string);
    const paths = [
      rec.full_mp3_path,
      rec.zip_path,
      rec.source_path,
      ...(segs ?? []).map((s) => s.storage_path),
    ].filter(Boolean) as string[];
    if (paths.length > 0) {
      const { error } = await service.storage.from("recordings").remove(paths);
      if (!error) filesDeleted += paths.length;
    }
  }
  const oldIds = (old ?? []).map((r) => r.id as string);
  if (oldIds.length > 0) {
    // segments cascade via recording_id FK, but be explicit
    await service.from("recording_segments").delete().in("recording_id", oldIds);
    await service.from("recordings").delete().in("id", oldIds);
  }

  // --- telemetry ---
  const { count: eventsDeleted } = await service
    .from("events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  return {
    ok: true,
    cutoff,
    recordingsDeleted: oldIds.length,
    filesDeleted,
    eventsDeleted: eventsDeleted ?? 0,
  };
}
