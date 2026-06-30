/**
 * Single source of truth for all user-facing brand strings.
 * The product will be renamed: change values here (plus domain + email
 * sender address in env) and nothing else.
 *
 * Golden rule 7: never hardcode the brand name in components.
 */

export const brand = {
  /** Product name as shown everywhere in the UI. */
  name: "FanCast",
  /** Short tagline for the home page and meta description. */
  tagline:
    "Live fan commentary for Arsenal matches. Watch your stream, listen with us. No fluff, just football.",
  /** Sender display name for transactional email (address comes from EMAIL_FROM env). */
  emailSenderName: "FanCast",
} as const;

/**
 * Recording file-name template (PRD FR-13.5), e.g.
 * "FanCast - Arsenal vs Chelsea - 2026-08-15 - 03 Halftime Show.mp3"
 *
 * @param fixture   e.g. "Arsenal vs Chelsea"
 * @param date      kickoff date, formatted YYYY-MM-DD
 * @param index     1-based segment position, zero-padded to 2 digits; omit for the full broadcast
 * @param segment   segment label, e.g. "Halftime Show"; omit for the full broadcast
 */
export function recordingFileName(
  fixture: string,
  date: string,
  index?: number,
  segment?: string,
): string {
  const parts = [brand.name, fixture, date];
  if (index !== undefined && segment) {
    parts.push(`${String(index).padStart(2, "0")} ${segment}`);
  }
  return `${parts.join(" - ")}.mp3`;
}
