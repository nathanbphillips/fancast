/** Human-readable listening/elapsed time from seconds. Pure — safe on the
 *  client (kept out of the server-only adminInsights loader). */
export function formatDuration(secs: number): string {
  if (secs < 60) return "0m";
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
