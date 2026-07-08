/**
 * Attendance copy (FR-22.3). LOAD-BEARING RULE: the object of "attend" is
 * ALWAYS the room, never the match. "Attend this match" / "attend the match"
 * must never render. Every attendance string in the app comes from here; no
 * component composes this copy ad hoc. Unit-tested in scripts/attendance-test.ts.
 */

/** Join names naturally: "Sarah", "Sarah and Dave". */
function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} friends`;
}

/**
 * The scheduled-room attendance line.
 * @param count       total RSVPs on the room
 * @param friendNames the viewer's accepted friends among those RSVPs (may be [])
 * @returns the line, or null when there is nothing to show (0 RSVPs, no friends)
 */
export function attendanceLine(
  count: number,
  friendNames: string[] = [],
): string | null {
  if (count <= 0) return null;

  const k = Math.min(friendNames.length, count);
  const friends = friendNames.slice(0, k);

  // "All friends and nobody else": everyone bar the viewer is a friend, and the
  // group is small enough to name (N == k + 1, N <= 3). Reads personally.
  if (k >= 1 && count === k + 1 && count <= 3) {
    const verb = friends.length === 1 ? "is" : "are";
    return `${joinNames(friends)} ${verb} planning to attend`;
  }

  const base =
    count === 1 ? "1 person planning to attend" : `${count} people planning to attend`;

  if (k >= 1) {
    return `${base}, including ${joinNames(friends)}`;
  }
  return base;
}

/** The live-room presence line (from `waiting` onward). */
export function listeningLine(count: number): string {
  return `${count} listening now`;
}

/**
 * Terse RSVP count for compact card slots (the /matches up-next cards):
 * "1,240 going". "going" attaches to the ROOM, never the match. Returns null
 * when there is nothing to show (0 RSVPs) so callers can omit the line.
 */
export function goingLine(count: number): string | null {
  if (count <= 0) return null;
  return `${count.toLocaleString("en-GB")} going`;
}
