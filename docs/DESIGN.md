# Design System (build-facing)

Arsenal-derived palette, minimalist, dark and light themes both first-class. Use the colors, never club crests/marks. Full designer brief lives in the parent folder; this file is what the build implements now (designer refines later).

## Tokens (CSS variables; Tailwind references these)

| Token | Dark | Light |
|---|---|---|
| --bg-base | #0D0F14 | #FAFAF8 |
| --bg-surface | #15181F | #FFFFFF |
| --bg-raised | #1C2029 | #F1F0EC |
| --text-primary | #F2F3F5 | #16181D |
| --text-secondary | #9BA1AC | #5E6573 |
| --line | #262B35 | #E4E2DC |
| --red | #EF0107 | #B80005 |
| --gold | #C9A864 | #9C824A |
| --navy | #6E9FE0 | #023474 |
| --green | #27C46D | #1A9E56 |

Usage rules: red only for primary actions, LIVE/ON AIR, and downvote-adjacent danger; gold for highlights, commentator identity, supporter badge, selected states (never large fills); green for upvotes/positive/sync-confirmed. Verify AA contrast for every pairing; adjust values rather than breaking contrast.

Theme behavior: default = system preference; header toggle + account setting persists (profiles.theme_pref + localStorage for anonymous). No flash on load (inline script sets class before paint).

## Type and numbers

Inter (or system fallback stack) throughout. Chat 14-15px, meta 12-13px. Score and clock are the largest elements on the page. `font-variant-numeric: tabular-nums` on clock, score, stats, all counts. Weights: regular/semibold for almost everything; bold reserved for score, clock, section headers.

## Layout

- Desktop: stats 25% (~320-360px) | chat 50% | links 25%; persistent bottom audio bar (listener ~50px, commentator ~70-80px command strip).
- Mobile (build first): match header (score + clock/state) → compact audio strip → chat dominating → stats/links via swipe/tabs → input + Ask Question + Request to Talk + slider in bottom third. Header collapses on scroll to a slim score-clock-live strip that never disappears.
- Spacing on a 4px grid; radius 8-12px; cards = `--bg-surface` with 0.75px `--line` border, optional 4px accent left edge.

## The clock/state unit (signature component)

- Live play: period label + running clock, e.g. `1H 23:14`, `2H 78:40`, `ET 104:12`.
- Otherwise: the entire unit is replaced by PRE-GAME / HALFTIME / POST-GAME / FULL TIME.
- Never both. Never a zeroed clock. Largest type after the score; tabular numerals.

## Chat message anatomy

`[vote arrows + net count] [username] [body]` with timestamp on hover/long-press. Arrows always visible on every message. Commentator variant: 3px gold/red left border, gold username, COMMENTATOR badge; on-air guest: lighter variant while holding the mic. Hidden-by-flags: collapsed placeholder row. Own message: subtle background shift.

## States that must be designed-in-code (Phase order)

Waiting room (countdown + read-only chat) · live room per period · halftime/postgame with widgets featured · technical difficulties card (calm, audio-bar area, room visibly alive) · radio mode (stats enlarged, sync hidden) · ON AIR transformed bar (red border/glow, dominant Leave Air) · empty home between matches (next-match countdown) · processing/downloads panel · tip sheet · sync sheet (large ticking reference clock, "tap Now") · anonymous-user input prompts.

## Motion and accessibility

Motion only on state changes (LIVE pulse, ON AIR glow, new-message entrance, theme switch), all <200ms, full `prefers-reduced-motion` path. WCAG AA both themes; 44px touch targets; visible focus states; semantic headings; keyboard operability for chat and all controls.

## Microcopy voice

Knowledgeable fellow fan: warm, brief, never corporate. "The commentator will be right back." "Show starts soon." "Sync to my TV." Brand strings come from `lib/brand.ts` (rename pending).
