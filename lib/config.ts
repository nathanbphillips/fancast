/**
 * App-level constants. Sportmonks (v3 football) ids — confirm against the live
 * account with `npm run sportmonks:check` before the first real sync.
 */
export const config = {
  /** Sportmonks team id for Arsenal (search-confirmed: 19) */
  arsenalTeamId: 19,
  /** Sportmonks league id for the English Premier League (verify: 8) */
  premierLeagueId: 8,
  /** Season start year (2026 = the 2026-27 season) */
  season: 2026,
  /** 3-20 chars, letters/digits/underscore (FR-2.1) */
  usernamePattern: /^[A-Za-z0-9_]{3,20}$/,
  /** Days a username is locked after a change (FR-2.1) */
  usernameChangeLockDays: 30,
} as const;

/**
 * Public read-only DEMO rooms, matched by immutable slug. In a demo room the
 * chat text entry is disabled (guests can read but not post), the sign-in wall
 * and "show starts soon" waiting banner are dropped so nothing obscures the
 * view, and polls open to guests (local-only voting). Set up directly in the DB
 * (not via a seed), so identified here by slug.
 */
export const DEMO_ROOM_SLUGS: string[] = [
  "arsenal-vs-burnley-test-01-jul-2026-nathan",
];

/** Whether a room (by slug) is a public read-only demo. */
export function isDemoRoomSlug(slug: string | null | undefined): boolean {
  return slug != null && DEMO_ROOM_SLUGS.includes(slug);
}
