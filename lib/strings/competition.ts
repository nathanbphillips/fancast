/**
 * One competition line everywhere a fixture names its round (founder
 * 2026-09-13): league rounds are plain numbers from Sportmonks, so a numeric
 * round reads "Premier League Matchday #4"; a named cup round keeps its own
 * name ("FA Cup · Third Round"); no round, just the competition.
 */
export function competitionLine(
  competition: string,
  round?: string | null,
): string {
  if (!round) return competition;
  return /^\d+$/.test(round)
    ? `${competition} Matchday #${round}`
    : `${competition} · ${round}`;
}
