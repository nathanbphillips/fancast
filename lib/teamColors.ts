/**
 * Club colours for the line-up discs (founder 2026-09-06) and the stat bars
 * (founder 2026-09-12): Arsenal are ALWAYS red, home or away. The opponent
 * wears their own club colour, except when that colour is in the same family
 * as the other side's (a red-shirted visitor like Liverpool or United next to
 * Arsenal red), in which case they drop to their secondary colour. Plain
 * coloured fills only, no crests or kit imagery (copy-compliance: nothing
 * club-official is implied).
 *
 * Keys are matched against the fixture team names Sportmonks stores
 * (normalised to lowercase); unknown teams (custom rooms, cup sides we have
 * not mapped) fall back to the app's navy.
 */
export type DiscColor = { bg: string; fg: string };
type Family =
  | "red"
  | "claret"
  | "blue"
  | "sky"
  | "white"
  | "black"
  | "green"
  | "amber";
type ClubEntry = { main: DiscColor; alt: DiscColor; family: Family; altFamily: Family };

const WHITE: DiscColor = { bg: "#f5f5f5", fg: "#1a1a1a" };
const BLACK: DiscColor = { bg: "#141417", fg: "#ffffff" };

/** substring key (lowercase) -> colours; first match wins */
const CLUBS: Array<[string, ClubEntry]> = [
  ["arsenal", { main: { bg: "#EF0107", fg: "#ffffff" }, alt: WHITE, family: "red", altFamily: "white" }],
  ["liverpool", { main: { bg: "#C8102E", fg: "#ffffff" }, alt: { bg: "#00B2A9", fg: "#0c0c0e" }, family: "red", altFamily: "green" }],
  ["manchester united", { main: { bg: "#DA291C", fg: "#ffffff" }, alt: { bg: "#1a1a1a", fg: "#FBE122" }, family: "red", altFamily: "black" }],
  ["nottingham forest", { main: { bg: "#DD0000", fg: "#ffffff" }, alt: WHITE, family: "red", altFamily: "white" }],
  ["bournemouth", { main: { bg: "#DA291C", fg: "#ffffff" }, alt: BLACK, family: "red", altFamily: "black" }],
  ["brentford", { main: { bg: "#E30613", fg: "#ffffff" }, alt: BLACK, family: "red", altFamily: "black" }],
  ["sunderland", { main: { bg: "#EB172B", fg: "#ffffff" }, alt: WHITE, family: "red", altFamily: "white" }],
  ["crystal palace", { main: { bg: "#1B458F", fg: "#ffffff" }, alt: { bg: "#C4122E", fg: "#ffffff" }, family: "blue", altFamily: "red" }],
  ["aston villa", { main: { bg: "#670E36", fg: "#ffffff" }, alt: { bg: "#95BFE5", fg: "#0c0c0e" }, family: "claret", altFamily: "sky" }],
  ["burnley", { main: { bg: "#6C1D45", fg: "#ffffff" }, alt: { bg: "#99D6EA", fg: "#0c0c0e" }, family: "claret", altFamily: "sky" }],
  ["west ham", { main: { bg: "#7A263A", fg: "#ffffff" }, alt: { bg: "#9BD3F5", fg: "#0c0c0e" }, family: "claret", altFamily: "sky" }],
  ["chelsea", { main: { bg: "#034694", fg: "#ffffff" }, alt: WHITE, family: "blue", altFamily: "white" }],
  ["everton", { main: { bg: "#003399", fg: "#ffffff" }, alt: WHITE, family: "blue", altFamily: "white" }],
  ["brighton", { main: { bg: "#0057B8", fg: "#ffffff" }, alt: { bg: "#FDB913", fg: "#1a1a1a" }, family: "blue", altFamily: "amber" }],
  ["ipswich", { main: { bg: "#3A64A3", fg: "#ffffff" }, alt: WHITE, family: "blue", altFamily: "white" }],
  ["manchester city", { main: { bg: "#6CABDD", fg: "#0c0c0e" }, alt: { bg: "#1C2C5B", fg: "#ffffff" }, family: "sky", altFamily: "blue" }],
  ["coventry", { main: { bg: "#00A0DD", fg: "#0c0c0e" }, alt: BLACK, family: "sky", altFamily: "black" }],
  ["tottenham", { main: { bg: "#f5f5f5", fg: "#132257" }, alt: { bg: "#132257", fg: "#ffffff" }, family: "white", altFamily: "blue" }],
  ["fulham", { main: WHITE, alt: BLACK, family: "white", altFamily: "black" }],
  ["leeds", { main: WHITE, alt: { bg: "#FFCD00", fg: "#1a1a1a" }, family: "white", altFamily: "amber" }],
  ["newcastle", { main: { bg: "#241F20", fg: "#ffffff" }, alt: WHITE, family: "black", altFamily: "white" }],
  ["hull", { main: { bg: "#F5971D", fg: "#1a1a1a" }, alt: BLACK, family: "amber", altFamily: "black" }],
  ["wolves", { main: { bg: "#FDB913", fg: "#1a1a1a" }, alt: BLACK, family: "amber", altFamily: "black" }],
  ["wolverhampton", { main: { bg: "#FDB913", fg: "#1a1a1a" }, alt: BLACK, family: "amber", altFamily: "black" }],
  ["real betis", { main: { bg: "#00954C", fg: "#ffffff" }, alt: WHITE, family: "green", altFamily: "white" }],
];

const DEFAULT_ENTRY: ClubEntry = {
  main: { bg: "#023474", fg: "#ffffff" }, // the app's navy
  alt: WHITE,
  family: "blue",
  altFamily: "white",
};

function lookup(teamName: string | null | undefined): ClubEntry {
  const n = (teamName ?? "").toLowerCase();
  for (const [key, entry] of CLUBS) {
    if (n.includes(key)) return entry;
  }
  return DEFAULT_ENTRY;
}

const isArsenal = (name: string | null | undefined) =>
  (name ?? "").toLowerCase().includes("arsenal");

/** Disc colours for a line-up: Arsenal always red; a same-family opponent
 *  (or, Arsenal absent, the away side in a same-family matchup) drops to
 *  their secondary colour. */
export function lineupDiscColors(
  homeName: string | null | undefined,
  awayName: string | null | undefined,
): { home: DiscColor; away: DiscColor } {
  const h = lookup(homeName);
  const a = lookup(awayName);
  let home = h.main;
  let homeFamily = h.family;
  let away = a.main;
  let awayFamily = a.family;
  if (homeFamily === awayFamily) {
    if (isArsenal(awayName)) {
      home = h.alt;
      homeFamily = h.altFamily;
    } else {
      away = a.alt;
      awayFamily = a.altFamily;
    }
  }
  // a one-entry map quirk (e.g. claret alt sky vs a sky primary) could still
  // collide after the swap; the neutral default breaks the tie
  if (homeFamily === awayFamily) {
    if (isArsenal(awayName)) home = home === WHITE ? BLACK : WHITE;
    else away = away === WHITE ? BLACK : WHITE;
  }
  return { home, away };
}

/** Inline style for a club-coloured stat-bar segment, momentum bar, or side
 *  dot: the club colour plus a hairline ring, because a white kit (Spurs,
 *  Fulham) vanishes on the light theme's surfaces and a black one (Newcastle)
 *  on the dark theme's without it. The lineup discs carry their own stronger
 *  ring in PitchLineup - the Programme's paper pitch needs it too. */
export function barFillStyle(c: DiscColor): { backgroundColor: string; boxShadow: string } {
  return { backgroundColor: c.bg, boxShadow: "inset 0 0 0 1px rgb(var(--hair) / 0.25)" };
}
