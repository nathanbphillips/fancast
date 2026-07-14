import type { RoomKind } from "@/lib/db/types";

/**
 * Room identity + stats helpers for the anytime-rooms model (migration 0038).
 * A match room's name/stats come from its fixture; a discussion room owns its
 * `title` and only OPTIONALLY links a fixture for stats. Everything that used to
 * read `${fixture.home_team} vs ${fixture.away_team}` should go through
 * `roomTitle`, and everything that drives the stats/info/history panels should
 * use `statsFixtureId` instead of the raw `fixture_id`.
 */

/** The room's display name: a discussion room's own title, else the matchup. */
export function roomTitle(room: {
  title: string | null;
  fixture?: { home_team: string; away_team: string } | null;
}): string {
  if (room.title) return room.title;
  const f = room.fixture;
  if (f?.home_team && f?.away_team) return `${f.home_team} vs ${f.away_team}`;
  return "Room";
}

/**
 * Which fixture (if any) drives the stats/info/history panels:
 * - match room  → its own fixture_id
 * - discussion  → the optional linked_fixture_id (may be null → no stats)
 */
export function statsFixtureId(room: {
  kind: RoomKind;
  fixture_id: number | null;
  linked_fixture_id: number | null;
}): number | null {
  return room.kind === "discussion" ? room.linked_fixture_id : room.fixture_id;
}
