import { z } from "zod";
import type { FixtureStats, LineupPlayer, MatchInfo, SideLineup } from "@/lib/stats";

/**
 * Commentator overrides for the Info + Line-ups panels (Phase 11). The
 * commentator can correct or fill in venue / referee / weather / team-news and
 * fix lineup entries (name, number, on-pitch / bench / out) or add a missing
 * player. Stored per room in `room_stat_overrides`, pushed live on the control
 * channel, and merged onto the Sportmonks-derived data client-side. Pure merge
 * (no server-only) so it runs in the room and is unit-testable.
 */

export type PlayerStatus = "pitch" | "bench" | "out";

export type StatOverrides = {
  info?: {
    venue?: string;
    referee?: string;
    weather?: string;
    teamNews?: {
      home?: { name: string; reason: string }[];
      away?: { name: string; reason: string }[];
    };
  };
  // keyed by Sportmonks playerId (as string)
  players?: Record<string, { name?: string; jersey?: number | null; status?: PlayerStatus }>;
  // players missing from the Sportmonks lineup, added by the commentator
  added?: {
    id: number; // synthetic (negative) id
    side: "home" | "away";
    name: string;
    jersey?: number | null;
    status: "pitch" | "bench";
  }[];
};

const newsRow = z.object({
  name: z.string().trim().min(1).max(60),
  reason: z.string().trim().max(60),
});

export const statOverridesSchema = z.object({
  info: z
    .object({
      venue: z.string().trim().max(120).optional(),
      referee: z.string().trim().max(80).optional(),
      weather: z.string().trim().max(80).optional(),
      teamNews: z
        .object({
          home: z.array(newsRow).max(20).optional(),
          away: z.array(newsRow).max(20).optional(),
        })
        .optional(),
    })
    .optional(),
  players: z
    .record(
      z.string(),
      z.object({
        name: z.string().trim().min(1).max(60).optional(),
        jersey: z.number().int().min(0).max(99).nullable().optional(),
        status: z.enum(["pitch", "bench", "out"]).optional(),
      }),
    )
    // cap the key count (both full squads fit) so a writer can't store a huge blob
    .refine((r) => Object.keys(r).length <= 60, "too many player overrides")
    .optional(),
  added: z
    .array(
      z.object({
        // synthetic, always negative — keeps added ids from colliding with a real
        // Sportmonks playerId (which would dup React keys + double-count ratings)
        id: z.number().int().negative(),
        side: z.enum(["home", "away"]),
        name: z.string().trim().min(1).max(60),
        jersey: z.number().int().min(0).max(99).nullable().optional(),
        status: z.enum(["pitch", "bench"]),
      }),
    )
    .max(40)
    .optional(),
});

const EMPTY_INFO: MatchInfo = {
  venue: null,
  referees: [],
  weather: null,
  teamNews: { home: [], away: [] },
};

function mergeInfo(info: MatchInfo | null, ov: NonNullable<StatOverrides["info"]>): MatchInfo {
  const base: MatchInfo = info ?? EMPTY_INFO;
  const next: MatchInfo = {
    venue: base.venue,
    referees: base.referees,
    weather: base.weather,
    teamNews: { home: base.teamNews.home, away: base.teamNews.away },
  };
  if (ov.venue != null && ov.venue !== "") {
    next.venue = { name: ov.venue, city: null, capacity: null };
  }
  if (ov.referee != null && ov.referee !== "") {
    const head = { role: next.referees[0]?.role ?? "Referee", name: ov.referee };
    next.referees = [head, ...next.referees.slice(1)];
  }
  if (ov.weather != null && ov.weather !== "") {
    next.weather = next.weather
      ? { ...next.weather, description: ov.weather }
      : { description: ov.weather, temp: null, windMph: null, humidity: null, note: null };
  }
  // apply on key-presence: a side is present only when the commentator actually
  // edited it (the editor omits untouched sides), so an untouched Info save can't
  // blank live news, while an explicitly-emptied list ([]) clears a wrong entry.
  if (ov.teamNews?.home !== undefined) next.teamNews.home = ov.teamNews.home;
  if (ov.teamNews?.away !== undefined) next.teamNews.away = ov.teamNews.away;
  return next;
}

function mergeSide(
  side: SideLineup | null,
  sideKey: "home" | "away",
  teamName: string,
  players: NonNullable<StatOverrides["players"]>,
  added: NonNullable<StatOverrides["added"]>,
): SideLineup | null {
  const addedHere = added.filter((a) => a.side === sideKey);
  if (!side && addedHere.length === 0) return null;

  const base: SideLineup =
    side ?? { side: sideKey, teamName, formation: null, starters: [], bench: [] };

  // every current player with a working status (starter → pitch, bench → bench)
  type Working = { p: LineupPlayer; status: PlayerStatus };
  const working: Working[] = [
    ...base.starters.map((p) => ({ p, status: "pitch" as PlayerStatus })),
    ...base.bench.map((p) => ({ p, status: "bench" as PlayerStatus })),
  ];

  for (const w of working) {
    const o = players[String(w.p.playerId)];
    if (!o) continue;
    if (o.name != null) w.p = { ...w.p, name: o.name };
    if (o.jersey !== undefined) w.p = { ...w.p, jersey: o.jersey };
    // a status override is a pre-match correction (late start, scratched starter).
    // Once Sportmonks has touched this player with a live sub (subbedOffAt /
    // cameOnFor), the live feed wins so a real substitution is never masked.
    // Name/jersey corrections still apply either way.
    if (o.status && w.p.subbedOffAt == null && w.p.cameOnFor == null) w.status = o.status;
  }

  for (const a of addedHere) {
    working.push({
      p: {
        playerId: a.id,
        name: a.name,
        jersey: a.jersey ?? null,
        line: null,
        slot: null,
        positionId: null,
        starting: a.status === "pitch",
      },
      status: a.status,
    });
  }

  const starters = working.filter((w) => w.status === "pitch").map((w) => w.p);
  const bench = working.filter((w) => w.status === "bench").map((w) => w.p);
  // "out" players are dropped from the displayed lineup entirely
  return { ...base, teamName: base.teamName || teamName, starters, bench };
}

/** Merge commentator overrides onto a normalized FixtureStats. Pure. */
export function applyStatOverrides(stats: FixtureStats, ov: StatOverrides | null): FixtureStats {
  if (!ov || (!ov.info && !ov.players && !ov.added)) return stats;
  const players = ov.players ?? {};
  const added = ov.added ?? [];
  const hasLineupOverride = Object.keys(players).length > 0 || added.length > 0;

  return {
    ...stats,
    info: ov.info ? mergeInfo(stats.info, ov.info) : stats.info,
    lineups: hasLineupOverride
      ? {
          home: mergeSide(stats.lineups.home, "home", stats.home.name, players, added),
          away: mergeSide(stats.lineups.away, "away", stats.away.name, players, added),
        }
      : stats.lineups,
  };
}
