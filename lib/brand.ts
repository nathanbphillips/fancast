/**
 * Single source of truth for all user-facing brand strings.
 * If the product is renamed again: change values here (plus domain + email
 * sender address in env) and nothing else.
 *
 * Golden rule 7: never hardcode the brand name in components.
 *
 * Naming (founder 2026-07-08): the brand is "Arseradio" in standard case
 * everywhere — there is NO short/casual form (`shortName` === `name`). The
 * only special treatment is the LOGO, which is the two-tone uppercase lockup
 * `logoParts` (ARSE in red, RADIO in the foreground colour).
 */

export const brand = {
  /** Canonical product name — used everywhere (there is no short form). */
  name: "Arseradio",
  /** No separate short form; kept === name for the few call sites that
   *  reference a "short" name (error copy, crawler User-Agent). */
  shortName: "Arseradio",
  /** Plain-text wordmark for aria-labels / fallbacks. The visible nav + OG
   *  logo render `logoParts` two-tone instead. */
  wordmark: "Arseradio",
  /** Two-tone uppercase logo lockup: ARSE in red, RADIO in the foreground. */
  logoParts: { accent: "ARSE", base: "RADIO" },
  /** Primary domain (no protocol). Absolute URLs still come from env; this is
   *  for display copy (e.g. the product-shot address bar). */
  domain: "arseradio.com",
  /** Short tagline for the home page and meta description. Category stance
   *  ("the matchday room", "turn the pundits off") over a plain feature line;
   *  compliance-safe ("your own stream", never implies we show the match). */
  tagline:
    "The matchday room for Arsenal fans. Turn the pundits off and listen with real supporters, in sync with your own stream. No fluff, just football.",
  /** Sender display name for transactional email (address comes from EMAIL_FROM env). */
  emailSenderName: "Arseradio",
} as const;

/**
 * Recording file-name template (PRD FR-13.5), e.g.
 * "Arseradio - Arsenal vs Chelsea - 2026-08-15 - 03 Halftime Show.mp3"
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
