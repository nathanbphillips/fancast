/**
 * Room slugs (FR-19.3): immutable, human-readable, unique.
 * `slugify("{home} vs {away} {dd-mmm-yyyy} {creator}")` with the matchday in
 * Europe/London (the date fans know the game by, regardless of viewer
 * timezone). Mirrored by the SQL backfill in migration 0027.
 */

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The matchday as fans know it: dd-mmm-yyyy in Europe/London. */
export function londonMatchday(kickoffUtc: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(kickoffUtc));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`.toLowerCase();
}

/** Base room slug (before any collision suffix) — match rooms. */
export function roomSlugBase(
  home: string,
  away: string,
  kickoffUtc: string | Date,
  creatorUsername: string,
): string {
  return slugify(
    `${home} vs ${away} ${londonMatchday(kickoffUtc)} ${creatorUsername}`,
  );
}

/** Base room slug for a discussion room: {title}-{dd-mmm-yyyy}-{creator}
 *  (migration 0038). Same slugify/date shape, so routing stays format-agnostic. */
export function roomSlugBaseDiscussion(
  title: string,
  startUtc: string | Date,
  creatorUsername: string,
): string {
  return slugify(`${title} ${londonMatchday(startUtc)} ${creatorUsername}`);
}

/** True when the room-page param is a UUID (old /room/{id} link) rather than
 *  a slug; uuids 301 to the canonical slug URL. */
export function looksLikeUuid(param: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    param,
  );
}
