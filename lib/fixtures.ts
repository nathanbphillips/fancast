import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import { acceptedHosts } from "@/lib/roomHosts";
import { flushRows } from "@/lib/notify/outbox";
import { enqueueRoomChange } from "@/lib/notify/producers";

/**
 * Pulls the season's Arsenal fixtures from Sportmonks (v3 football) and
 * upserts them into public.fixtures. On the first successful sync, purges
 * placeholder seed rows (id < 0). Server-only; called from /api/fixtures/sync.
 */

export type FixtureRow = {
  id: number;
  competition: string;
  home_team_id: number | null;
  away_team_id: number | null;
  kickoff_utc: string;
};

/**
 * Map a placeholder seed fixture (negative id) to its real provider
 * counterpart — but ONLY on an unambiguous single match by competition + both
 * team ids + the same UTC calendar day. Returns null otherwise: a missed
 * remap (seed kept) is the safe failure, whereas a wrong remap would point a
 * live room's broadcast at the wrong match, so we never guess. Pure +
 * exported for unit tests (M-9, audit).
 */
export function matchSeedToReal(
  seed: FixtureRow,
  real: FixtureRow[],
): number | null {
  const day = (s: string) => s.slice(0, 10); // UTC calendar day
  const hits = real.filter(
    (r) =>
      r.id > 0 &&
      r.competition === seed.competition &&
      r.home_team_id != null &&
      r.home_team_id === seed.home_team_id &&
      r.away_team_id != null &&
      r.away_team_id === seed.away_team_id &&
      day(r.kickoff_utc) === day(seed.kickoff_utc),
  );
  return hits.length === 1 ? hits[0].id : null;
}

/** Subset of the Sportmonks v3 fixture shape we consume (with the includes
 *  participants;scores;state;league;round). Parsed defensively. */
type SmNamed = { name?: string | null };
export type SmParticipant = {
  id: number;
  name?: string | null;
  meta?: { location?: "home" | "away" | string };
};
export type SmScore = {
  description?: string | null;
  score?: { goals?: number | null; participant?: "home" | "away" | string };
};
export type SmFixture = {
  id: number;
  league_id: number;
  round_id?: number | null;
  starting_at?: string | null; // "YYYY-MM-DD HH:MM:SS" in UTC
  participants?: SmParticipant[];
  scores?: SmScore[];
  state?: { state?: string; short_name?: string | null; name?: string | null };
  league?: SmNamed;
  round?: SmNamed;
};

/** Sportmonks gives "YYYY-MM-DD HH:MM:SS" in UTC; normalize to ISO. */
function smStartingAtToIso(s?: string | null): string {
  if (!s) return new Date(0).toISOString();
  const base = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(base.endsWith("Z") ? base : `${base}Z`);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

/** Map one Sportmonks v3 fixture to a `fixtures` table row. Pure + exported
 *  for unit tests; tolerates missing includes (TBD teams, null scores). */
export function mapSportmonksFixture(f: SmFixture, seasonYear: number) {
  const home = f.participants?.find((p) => p.meta?.location === "home");
  const away = f.participants?.find((p) => p.meta?.location === "away");
  const current = (f.scores ?? []).filter((s) => s.description === "CURRENT");
  const goalsFor = (loc: "home" | "away") =>
    current.find((s) => s.score?.participant === loc)?.score?.goals ?? null;
  return {
    id: f.id,
    sportmonks_fixture_id: f.id,
    source: "sportmonks",
    league_id: f.league_id,
    season: seasonYear,
    competition: f.league?.name ?? "Football",
    round: f.round?.name ?? "",
    home_team: home?.name ?? "TBD",
    away_team: away?.name ?? "TBD",
    home_team_id: home?.id ?? null,
    away_team_id: away?.id ?? null,
    kickoff_utc: smStartingAtToIso(f.starting_at),
    status: f.state?.short_name ?? f.state?.state ?? "NS",
    home_score: goalsFor("home"),
    away_score: goalsFor("away"),
    updated_at: new Date().toISOString(),
  };
}

/** Statuses that mean "no longer happening on this date" (Sportmonks short
 *  codes vary; match defensively). */
function isPostponedStatus(status: string): boolean {
  return /^(POSTP|PST|CANC|CANCL|ABAN|SUSP)/i.test(status);
}

export async function syncFixtures(service: SupabaseClient) {
  const token = process.env.SPORTMONKS_API_TOKEN;
  if (!token) {
    return { ok: false as const, reason: "SPORTMONKS_API_TOKEN not configured" };
  }
  const base =
    process.env.SPORTMONKS_BASE ?? "https://api.sportmonks.com/v3/football";

  // FR-19.5 (2026-07-03): league-wide EPL, last week (fresh results) through
  // today + 120 days (the picker horizon). The league filter replaces the old
  // Arsenal-only team path. Sportmonks caps a `between` range at 100 days, so
  // the window is fetched in <=95-day chunks.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const windowStart = Date.now() - 7 * DAY_MS;
  const windowEnd = Date.now() + 120 * DAY_MS;
  const include = "participants;scores;state;league;round";

  const fixtures: SmFixture[] = [];
  for (
    let chunkStart = windowStart;
    chunkStart < windowEnd;
    chunkStart += 95 * DAY_MS
  ) {
    const chunkEnd = Math.min(chunkStart + 95 * DAY_MS, windowEnd);
    for (let page = 1; page <= 20; page++) {
      const url =
        `${base}/fixtures/between/${day(chunkStart)}/${day(chunkEnd)}` +
        `?include=${include}&filters=fixtureLeagues:${config.premierLeagueId}` +
        `&per_page=50&page=${page}`;
      // token via the Authorization header keeps it out of URLs/logs
      const res = await fetch(url, {
        headers: { Authorization: token },
        cache: "no-store",
      });
      if (!res.ok) {
        return {
          ok: false as const,
          reason: `Sportmonks responded ${res.status}`,
        };
      }
      const payload = (await res.json()) as {
        data?: SmFixture[];
        pagination?: { has_more?: boolean };
      };
      fixtures.push(...(payload.data ?? []));
      if (!payload.pagination?.has_more) break;
    }
  }
  if (fixtures.length === 0) {
    return { ok: false as const, reason: "Sportmonks returned no fixtures" };
  }

  const rows = fixtures.map((f) => mapSportmonksFixture(f, config.season));

  // FR-19.6: before the upsert lands, diff kickoffs against what we had so
  // rooms scheduled on a moved fixture shift with it (scheduled_kickoff AND
  // broadcast_start move by the same delta) and a postponed fixture flags its
  // rooms instead of stranding them.
  const { data: existing } = await service
    .from("fixtures")
    .select("id, kickoff_utc, status")
    .in("id", rows.map((r) => r.id));
  const before = new Map(
    (existing ?? []).map((f) => [
      f.id as number,
      { kickoff: f.kickoff_utc as string, status: f.status as string },
    ]),
  );

  const { error } = await service.from("fixtures").upsert(rows);
  if (error) {
    return { ok: false as const, reason: error.message };
  }

  let movedRooms = 0;
  let postponedRooms = 0;
  // rooms whose hosts should get a room_change notification (FR-19.6 / FR-21)
  const changes: { roomId: string; slug: string; matchLabel: string; change: string }[] = [];
  for (const row of rows) {
    const prev = before.get(row.id);
    if (!prev) continue;
    const matchLabel = `${row.home_team} vs ${row.away_team}`;

    const nowPostponed = isPostponedStatus(row.status);
    const wasPostponed = isPostponedStatus(prev.status);
    if (nowPostponed !== wasPostponed) {
      const { data: flagged } = await service
        .from("rooms")
        .update({ postponed: nowPostponed })
        .eq("fixture_id", row.id)
        .eq("state", "scheduled")
        .select("id, slug");
      if (nowPostponed) {
        postponedRooms += flagged?.length ?? 0;
        for (const r of flagged ?? []) {
          changes.push({
            roomId: r.id as string,
            slug: r.slug as string,
            matchLabel,
            change: "postponed",
          });
        }
      }
    }

    const deltaMs =
      new Date(row.kickoff_utc).getTime() - new Date(prev.kickoff).getTime();
    if (deltaMs === 0) continue;
    const { data: rooms } = await service
      .from("rooms")
      .select("id, slug, scheduled_kickoff, broadcast_start")
      .eq("fixture_id", row.id)
      .eq("state", "scheduled");
    for (const room of rooms ?? []) {
      const shift = (iso: string | null) =>
        iso ? new Date(new Date(iso).getTime() + deltaMs).toISOString() : null;
      const newBroadcast = shift(room.broadcast_start as string | null);
      await service
        .from("rooms")
        .update({
          scheduled_kickoff: shift(room.scheduled_kickoff as string),
          broadcast_start: newBroadcast,
          // a rescheduled fixture is no longer "postponed with no date"
          ...(nowPostponed ? {} : { postponed: false }),
        })
        .eq("id", room.id);
      // any pending reminders for this room move with it (FR-21.4)
      if (newBroadcast) {
        await service
          .from("notifications_outbox")
          .update({
            due_at: new Date(
              new Date(newBroadcast).getTime() - 15 * 60 * 1000,
            ).toISOString(),
          })
          .eq("room_id", room.id)
          .eq("type", "pre_start_reminder")
          .is("sent_at", null);
      }
      changes.push({
        roomId: room.id as string,
        slug: room.slug as string,
        matchLabel,
        change: "moved",
      });
      movedRooms++;
    }
  }

  // notify each affected room's hosts (FR-19.6); recipients expand to RSVP
  // holders in PRD-05. Inline flush is fine in this background job.
  for (const c of changes) {
    const hosts = await acceptedHosts(service, c.roomId);
    const ids = await enqueueRoomChange(service, {
      roomId: c.roomId,
      recipientIds: hosts.map((h) => h.user_id),
      payload: { matchLabel: c.matchLabel, roomSlug: c.slug, change: c.change },
    });
    await flushRows(service, ids);
  }

  // real data is in — clean up the dev seeds (id < 0). A room may have been
  // opened against a seed before this first sync; the FK is ON DELETE NO ACTION
  // (migration 0014), so a blind delete would error and — when the result is
  // swallowed — leave seeds lingering forever (M-9, audit). Remap any
  // referencing room to its real fixture first, then delete only the seeds
  // nothing references, and surface a delete failure instead of faking success.
  const { data: seeds } = await service
    .from("fixtures")
    .select("id, competition, home_team_id, away_team_id, kickoff_utc")
    .lt("id", 0);
  const { data: referenced } = await service
    .from("rooms")
    .select("fixture_id")
    .lt("fixture_id", 0);
  const refIds = new Set((referenced ?? []).map((r) => r.fixture_id as number));
  const unremapped: number[] = [];
  for (const seed of (seeds ?? []) as FixtureRow[]) {
    if (!refIds.has(seed.id)) continue;
    const realId = matchSeedToReal(seed, rows as unknown as FixtureRow[]);
    if (realId == null) {
      unremapped.push(seed.id); // ambiguous/no match — keep the seed + its room
      continue;
    }
    const { error: remapErr } = await service
      .from("rooms")
      .update({ fixture_id: realId })
      .eq("fixture_id", seed.id);
    if (remapErr) unremapped.push(seed.id);
  }

  let del = service.from("fixtures").delete().lt("id", 0);
  if (unremapped.length) {
    del = del.not("id", "in", `(${unremapped.join(",")})`);
  }
  const { error: delErr } = await del;
  if (delErr) {
    return { ok: false as const, reason: `seed purge failed: ${delErr.message}` };
  }

  return {
    ok: true as const,
    count: rows.length,
    unremapped,
    movedRooms,
    postponedRooms,
  };
}

/**
 * No-show expiry (FR-19.7): a scheduled room never opened by kickoff + 2h is
 * auto-canceled (listings already hide it from kickoff + 15 min; this makes
 * the state truthful). Runs from the daily cron; cheap enough to also ride
 * opportunistic syncs.
 */
export async function sweepNoShowRooms(service: SupabaseClient) {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await service
    .from("rooms")
    .update({ state: "canceled" })
    .eq("state", "scheduled")
    .lt("scheduled_kickoff", cutoff)
    .select("id");
  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const, canceled: data?.length ?? 0 };
}
