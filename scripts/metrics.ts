/**
 * Listener metrics (Phase 9, FR-9.4). Run on demand or nightly:
 *   npm run metrics
 *
 * 1. Sweeps stale open segments (no heartbeat in 90s → closed at last_seen_at),
 *    so a tab-close that the unload beacon missed doesn't inflate durations.
 * 2. Prints per-room + overall: sessions, unique signed-in listeners, anonymous
 *    sessions, total listen-hours, peak concurrent, average session minutes.
 *
 * The raw SQL query pack (for the Supabase SQL editor) is in docs/METRICS.md.
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const STALE_MS = 90_000;

type Seg = {
  room_id: string;
  user_id: string | null;
  mode: string;
  started_at: string;
  ended_at: string | null;
  last_seen_at: string;
};

/** Max simultaneous open segments (sweep-line; starts before ends at a tie). */
function peakConcurrent(segs: Seg[]): number {
  const ev: [number, number][] = [];
  for (const s of segs) {
    const start = new Date(s.started_at).getTime();
    const end = new Date(s.ended_at ?? Date.now()).getTime();
    if (end <= start) continue;
    ev.push([start, 1], [end, -1]);
  }
  ev.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  let cur = 0,
    peak = 0;
  for (const [, d] of ev) {
    cur += d;
    peak = Math.max(peak, cur);
  }
  return peak;
}

function listenHours(segs: Seg[]): number {
  let ms = 0;
  for (const s of segs) {
    const start = new Date(s.started_at).getTime();
    const end = new Date(s.ended_at ?? Date.now()).getTime();
    if (end > start) ms += end - start;
  }
  return ms / 3_600_000;
}

async function main() {
  // 1. stale sweep — close open segments whose heartbeat lapsed, at last_seen_at
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  const { data: stale } = await svc
    .from("listener_segments")
    .select("id, last_seen_at")
    .is("ended_at", null)
    .lt("last_seen_at", cutoff);
  for (const s of stale ?? []) {
    await svc
      .from("listener_segments")
      .update({ ended_at: s.last_seen_at })
      .eq("id", s.id);
  }
  console.log(`swept ${stale?.length ?? 0} stale open segment(s)\n`);

  // 2. compute
  const { data: segs } = await svc
    .from("listener_segments")
    .select("room_id, user_id, mode, started_at, ended_at, last_seen_at")
    .order("started_at", { ascending: true });
  const all = (segs ?? []) as Seg[];
  if (all.length === 0) {
    console.log("no listener data yet.");
    return;
  }

  // labels: room -> "Home v Away (date)"
  const roomIds = [...new Set(all.map((s) => s.room_id))];
  const { data: rooms } = await svc
    .from("rooms")
    .select("id, fixture:fixtures(home_team, away_team, kickoff_utc)")
    .in("id", roomIds);
  const label = new Map<string, string>();
  for (const r of (rooms ?? []) as unknown as {
    id: string;
    fixture: { home_team: string; away_team: string; kickoff_utc: string } | null;
  }[]) {
    label.set(
      r.id,
      r.fixture
        ? `${r.fixture.home_team} v ${r.fixture.away_team} (${r.fixture.kickoff_utc?.slice(0, 10)})`
        : r.id.slice(0, 8),
    );
  }

  const byRoom = new Map<string, Seg[]>();
  for (const s of all) {
    const arr = byRoom.get(s.room_id) ?? [];
    arr.push(s);
    byRoom.set(s.room_id, arr);
  }

  console.log("=== Per room ===");
  for (const [roomId, rs] of byRoom) {
    const unique = new Set(rs.filter((s) => s.user_id).map((s) => s.user_id)).size;
    const anon = rs.filter((s) => !s.user_id).length;
    const radio = rs.filter((s) => s.mode === "radio").length;
    const hours = listenHours(rs);
    const avgMin = (hours * 60) / rs.length;
    console.log(`\n${label.get(roomId) ?? roomId}`);
    console.log(`  sessions ${rs.length} (radio ${radio}) · unique signed-in ${unique} · anon ${anon}`);
    console.log(`  peak concurrent ${peakConcurrent(rs)} · listen-hours ${hours.toFixed(2)} · avg ${avgMin.toFixed(1)} min`);
  }

  const uniqueAll = new Set(all.filter((s) => s.user_id).map((s) => s.user_id)).size;
  console.log(`\n=== Overall ===`);
  console.log(`  rooms ${byRoom.size} · sessions ${all.length} · unique signed-in listeners ${uniqueAll}`);
  console.log(`  total listen-hours ${listenHours(all).toFixed(2)}`);
}

main().catch((e) => {
  console.error("metrics failed:", e.message ?? e);
  process.exit(1);
});
