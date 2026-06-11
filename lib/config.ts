/**
 * App-level constants. API-Football ids per SETUP_CHECKLIST.md.
 */
export const config = {
  /** API-Football team id for Arsenal */
  arsenalTeamId: 42,
  /** API-Football league id for the Premier League */
  premierLeagueId: 39,
  /** Season start year (2026 = the 2026-27 season) */
  season: 2026,
  /** 3-20 chars, letters/digits/underscore (FR-2.1) */
  usernamePattern: /^[A-Za-z0-9_]{3,20}$/,
  /** Days a username is locked after a change (FR-2.1) */
  usernameChangeLockDays: 30,
} as const;
