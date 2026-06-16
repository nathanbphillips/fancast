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
