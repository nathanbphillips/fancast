# Design System (build-facing)

The Matchday Programme (founder 2026-09-12): a classic British football
matchday programme. Cream paper, letterpress ink, ONE deep red, Anton display
type over Newsreader serif, small-caps labels, hairline and double rules,
square corners. No shadows, no gradients, no emoji (text glyphs only:
● ○ ▲ ▼ ◎ ▸ ☎ ✓ ■ → ′ ·). Use the colours, never club crests/marks. LIGHT
(paper) is the default; dark is the same programme "printed in negative".
Handoff reference: the design_handoff_programme bundle (founder's archive).

## Tokens (CSS variables in app/globals.css; Tailwind reads them via @theme)

| Token | Light (paper) | Dark (negative) | Role |
|---|---|---|---|
| --bg-base / --bg-surface / --footer | #F7F1E2 | #1B1A15 | the page; panels are BORDER-BOXED on the same ground, never tinted cards |
| --bg-raised | #F2E9D5 | #2A251D | the visible hover/selected tint (handoff "paper-tint") |
| --bg2 (inset) | #FBF7EC | #242019 | quiet wells: coupons, the pitch (handoff "paper-raised") |
| --text-primary | #1B1A15 | #F7F1E2 | ink / cream |
| --text-secondary / --text-tertiary | ink at .75 / .55 | cream at .75 / .55 | one formula, re-resolves per theme |
| --line | ink at .3 | cream at .3 | every hairline rule |
| --red | #A8241A | **#D8593F** | CONTEXTUAL red: text, borders, underlines, kickers. Brightens in dark for contrast |
| --red-fill + --on-red | #A8241A / #F7F1E2 | same (never brightens) | red FILLS: live lamps, ON AIR, Sync now, selection, chips. Text on them is always --on-red |
| --red-hover | #8E1D14 | #8E1D14 | hover of red fills only |
| --inverted-bg / --inverted-fg | #1B1A15 / #F7F1E2 | #F7F1E2 / #1B1A15 | the PRIMARY button (ink on paper; exact inversion in dark) and ink hero blocks |
| --gold | #E8C400 | #A8241A | SPARSE, on ink/inverted fills only (countdown numerals, the hero "v"); never on the page. Dark swaps it to deep red (gold fails on cream) |
| --navy | #023474 | #6E9FE0 | away-team signal + unknown-club fallback. NOT brand |
| --green | #2E6B3C | #96B489 | positive / sync-confirmed states (printers' green) |
| --placeholder | #9A927E | same | input placeholders, italic |
| radius tokens | all 0 | all 0 | square corners; `rounded-full` survives for genuinely circular things (dots, avatars, player discs) |
| shadow tokens | none | none | elevation is retired; hierarchy comes from rules |

Club colours (line-up discs + stat bars) live in lib/teamColors.ts and are
never retinted; the #e4b800 yellow card and the Google logo SVG are also
off-limits. The red card rides --red-fill.

## Type and numbers

- **Anton 400** (`--font-anton`) is the display face, always via `.display`
  (uppercase, letter-spacing .01em, line-height .95): masthead, page titles,
  section heads, scorelines, fixture names. Pair with `.t-hero/.t-h2/.t-h3`.
- **Newsreader** (`--font-newsreader`) is everything else: body serif
  (`font-sans` - the utility name is load-bearing, the face is not), italic
  captions and standfirsts, and the `font-mono` utility, which now renders
  small caps with tabular lining figures (labels, buttons, meta, ALL ticking
  numerals - verified drift-free). Add `.fv-normal` beside font-mono on
  verbatim user data (emails, file names) so it never renders as caps.
- Weights cap at 600: the font-weight tokens map bold/extrabold/black to 600.
- `font-variant-numeric: tabular-nums` on clock, score, stats, counts (the
  font-mono utility bakes it in).

## Rules hierarchy (the programme's grid)

Page/masthead top rule `border-t-[3px] border-t-primary`; masthead bottom
`border-b border-b-primary`; section heads sit over a 3px DOUBLE rule
(`border-b-[3px] border-double border-primary`); row separators
`border-b border-line`; feature/boxed panels `border-2 border-primary`;
quiet panels `border border-line`; future/inert panels dashed
(`border-dashed border-line`); red emphasis boxes `border-2 border-red`.
The sign-in coupon doubles its frame: `border-2` plus a 1px outline at
5px offset.

## Buttons

- Primary: `.btn-grad-red` (legacy name, kept for its ~30 call sites) = ink
  fill, paper text, small caps, square; inverts to cream/ink in dark.
- Secondary: `border-2 border-primary` + font-mono tracked, hover text-red.
- Red tertiary: `border-2 border-red text-red`.
- On red/ink filled blocks: outline `border-2 border-on-red text-on-red` /
  `border-inverted-fg text-inverted-fg`.
- Small controls (sync steppers, sorts): `border border-line font-mono`;
  the Radio toggle is dashed.
- RSVP toggled = the STAMP: red border + red text + `-rotate-2`, label
  "✓ Going".
- Selected/filled toggles (poll pick, active view): `bg-inverted
  text-inverted-fg`.

## Layout

- Marketing pages carry the masthead strip (Vol · Season · Price 10p-struck
  £0, `components/marketing/MastheadStrip.tsx`) as decorative chrome.
- Desktop room: stats 1/3 left, merged chat stream 2/3 right; persistent
  bottom audio dock. Mobile: bottom tab bar (gantry voice: STANDS · POLLS ·
  CALL IN · NUMBERS, + FAQ / GANTRY / FACTS by role).
- Spacing on a 4px grid; corners square; panels ruled, not shadowed.

## The clock/state unit (signature component)

- Live play: period label + running clock, e.g. `1H 23:14`, `2H 78:40`.
- Otherwise the entire unit is replaced by PRE-GAME / HALFTIME / POST-GAME /
  FULL TIME. Never both, never a zeroed clock. font-mono (tabular smallcaps).

## Gantry voice (labels, founder decision 5)

Chat tab "From the stands" · stats "Numbers" · timeline "Timeline" · lineups
"Teams" · call-in "Call the gantry" · questions "Ask the gantry" · sync
"Get in step" / "In step · -N.Ns" / "◎ Sync now". Labels never imply
unbuilt features. NO EM DASHES in any user-facing string, ever ("-" or "·").

## States that must be designed-in-code

Waiting room (2px ink doors-open card) · live room per period · halftime /
postgame with widgets · technical difficulties card · Back-shortly card ·
radio mode (stats enlarged) · ON AIR (red-fill panel, dominant Leave the
air) · empty home between matches · processing/downloads panel · sync sheet
("Get in step", ticking reference clock) · anonymous-user input prompts.

## Motion and accessibility

Motion only on state changes (lamp pulse 1 -> .35, new-message entrance),
calm loops, full `prefers-reduced-motion` neutralization (global wildcard).
WCAG AA both themes: contextual red on paper ~6.4:1; #D8593F on ink ~4.5:1
(floor - never below 14px); tertiary restricted to large/incidental text;
focus ring = 2px contextual red. 44px touch targets; keyboard operability.

## Microcopy voice

The programme: knowledgeable fellow fan with a matchday-programme wink
("the subscription desk", "post us your email", "price £0"). Warm, brief,
never corporate, never implying we show the match. Brand strings come from
`lib/brand.ts`; the wordmark is the two-tone ARSE/RADIO lockup in Anton.
