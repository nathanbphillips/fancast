/**
 * Short display names for tight surfaces (founder 2026-09-23: "Manchester
 * City becomes Man City"). Curated map for the league plus likely cup sides,
 * keyed by substring like lib/teamColors.ts; anything unknown falls back to
 * dropping the trailing filler words ("United" and friends stay - only the
 * long-winded prefixes shrink) and finally to a hard trim.
 */

const SHORT: [match: string, short: string][] = [
  ["Manchester City", "Man City"],
  ["Manchester United", "Man Utd"],
  ["Newcastle United", "Newcastle"],
  ["Brighton", "Brighton"],
  ["Nottingham Forest", "Nott'm Forest"],
  ["Tottenham", "Spurs"],
  ["West Ham", "West Ham"],
  ["Wolverhampton", "Wolves"],
  ["Sheffield United", "Sheff Utd"],
  ["Sheffield Wednesday", "Sheff Wed"],
  ["AFC Bournemouth", "Bournemouth"],
  ["Crystal Palace", "Palace"],
  ["Leeds United", "Leeds"],
  ["Leicester City", "Leicester"],
  ["Ipswich Town", "Ipswich"],
  ["Hull City", "Hull"],
  ["Coventry City", "Coventry"],
  ["Borussia Dortmund", "Dortmund"],
  ["Bayern", "Bayern"],
  ["Paris Saint-Germain", "PSG"],
  ["Real Madrid", "Real Madrid"],
  ["Atletico", "Atletico"],
  ["Athletic Club", "Athletic"],
  ["LOSC Lille", "Lille"],
  ["Slavia Praha", "Slavia"],
];

export function shortTeamName(name: string): string {
  if (!name) return name;
  // parenthetical suffixes (dev/demo tags) never belong in a display name
  const base = name.replace(/\s*\(.*\)$/, "").trim();
  for (const [match, short] of SHORT) {
    if (base.toLowerCase().includes(match.toLowerCase())) return short;
  }
  if (base.length <= 14) return base;
  // generic fallback: drop trailing filler ("... Albion", "... Hotspur",
  // "... Town", "... City" when the rest still names the club)
  const trimmed = base
    .replace(/\s+&.*$/, "")
    .replace(/\s+(Albion|Hotspur|Wanderers|Athletic|Town|City|County|FC)$/i, "");
  if (trimmed.length > 3 && trimmed.length <= 16) return trimmed;
  return base.slice(0, 14).trimEnd();
}
