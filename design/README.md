# Handoff: FanCast — Live Fan Commentary for Football

## 🧒 ELI5 (the one-paragraph version)
FanCast is an app where football fans watch a match on their own TV, then listen to a **real fan** commentating live in their ear instead of the official TV pundits. While they listen they can chat, vote in polls, rate the players, see live stats, and even "call in" to talk on air. This bundle contains **HTML mock-ups** of that app (a phone app + a website). They are pictures-that-move, made to show exactly how it should look and behave. Your job in Claude Code is to **rebuild these screens for real** inside the actual product codebase — not to copy the HTML.

---

## Overview
FanCast is a second-screen companion for live football. It does **not** stream the match — the user keeps watching however they already do (telly, app, subscription). FanCast rides alongside with **live fan audio**, a **synced-to-your-screen** control, a **chat room**, **live match stats**, **polls**, **player ratings**, and a **call-in** queue. Launch club is Arsenal; branded with an "away-end / broadcast booth" energy, dark UI, Arsenal-red accent.

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing the intended look and behavior. **They are not production code to lift directly.** The task is to **recreate these designs in the target codebase's existing environment** (React / React Native / SwiftUI / Kotlin / whatever the real app uses), following that codebase's established components, patterns, and libraries. If no codebase exists yet, pick the most appropriate framework (e.g. React + Tailwind for web, React Native / SwiftUI for mobile) and implement there.

The prototypes are built on a small in-house template runtime (`support.js`). **Ignore that runtime** — it's just what makes the HTML mocks interactive. Do not port `support.js`, the `<x-dc>` tags, `{{ }}` template holes, or the `sc-for` / `sc-if` elements. Read them only to understand structure and logic.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, copy, and interactions are all intentional and specified below. Recreate the UI pixel-accurately using the codebase's existing libraries. Exact hex values, font families, sizes, and radii are given in the Design Tokens section.

---

## The Files in This Bundle

| File | What it is | Use it for |
|---|---|---|
| `FanCast - Mobile.dc.html` | **The mobile app** (iOS + Android). The primary deliverable. Fully interactive prototype. | Building the native/mobile app |
| `FanCast - On Air.dc.html` | **The marketing website / responsive web app.** Landing + Matches + About, dark/light theme. | Building the web experience |
| `FanCast Redesign.dc.html` | **Design exploration** — two landing-page directions (`1a` broadcast, `1b` editorial). Context only. | Reference for visual direction; `1a` is the chosen direction |
| `ios-frame.jsx`, `android-frame.jsx` | Device bezels used to frame the mobile mock. **Not part of the product** — throwaway scaffolding. | Ignore for implementation |
| `support.js` | The prototype runtime. **Not part of the product.** | Ignore for implementation |

> To view a prototype: open the `.dc.html` file in a browser. The mobile file has iOS/Android and S/M/L size toggles at the top.

---

## PART 1 — MOBILE APP (`FanCast - Mobile.dc.html`)

The app has **4 top-level screens** reached from a bottom tab bar (LIVE · MATCHES · PROFILE) plus an immersive **Room**. It renders inside an iOS or Android device frame, and supports three device sizes (see Responsive Behavior).

### Screen: LIVE (Home)
- **Purpose:** entry point; surfaces the live room and what's coming up.
- **Layout:** sticky translucent header (logo left, "1 LIVE" pill right) → scrolling body.
- **Sections (top → bottom):**
  1. **Hero** — eyebrow chip ("LIVE FAN COMMENTARY · ARSENAL"), big Anton headline ("Turn the pundits off. Tune in to **real Arsenal fans**."), body copy, red CTA "See what's live →" (→ Room).
  2. **Live now card** — red-bordered card, "LIVE" pill + "1,204 listening", "Arsenal vs Burnley", "PREMIER LEAGUE · TEST · HOSTED BY NATHAN". Tap → Room.
  3. **Coming up** — list of upcoming fixtures (date block + match), "ALL FIXTURES →" → Matches.
  4. **How it works** — 3 numbered cards (icon + step title + description).
- **Header:** `padding: safe-top 18px 12px`, `background: rgb(bg / .8)`, `backdrop-filter: blur(8px)`, bottom border `rgb(line / .08)`.

### Screen: MATCHES
- **Purpose:** full fixture schedule.
- **Layout:** sticky header ("● FULL SCHEDULE · ARSENAL" eyebrow + "Matches" title) → body.
- **Components:** filter chips (`ALL` active = inverted fill, `LIVE`, `UPCOMING` = outline) → "LIVE NOW" section (one red-bordered live card, tap → Room) → "UPCOMING" list (date + match + "Remind" outline button per row).

### Screen: ROOM (the core experience)
Replaces the app tab bar with its own **segmented bar: CHAT · STATS · CALL IN**. Panels are **swipeable** left/right. At the top sits the **Transport** (sync control), which has two states:

- **Transport — expanded** (default): "Leave" (← back to Live), "LIVE · 1H 23:14", collapse chevron ▲. Then centered scoreboard "ARS 2 – 0 BUR". Host row (avatar with red ring, "nathan HOST", "+ priya · co-host", animated EQ bars). A **waveform** strip with a sweeping playhead. Sync controls row: `−0.5s` | **SYNC NOW** (inverted fill) | `+0.5s`. Helper text: "Tap SYNC when your telly hits the moment…".
- **Transport — collapsed:** single slim bar — back ‹, "LIVE" dot, "ARS 2 – 0 BUR", EQ bars, "SYNCED · tap to nudge ▼". Tapping toggles back to expanded.

**Panel: CHAT**
- Pull-to-refresh (drag down reveals "↻ RELEASE TO REFRESH"; releasing past threshold refreshes).
- "↻ N NEW" pill (gold) when new messages exist; tap clears.
- **Pinned live poll** card: question, options as tappable bars filling to their `pct` %, vote count + time left.
- **Messages:** avatar, name (+ HOST badge for hosts), timestamp, text, an upvote chip (▲ count) + "Reply", and optional indented threaded replies.
- **Composer footer:** row of 5 reaction emoji buttons (⚽ 🔥 👏 😱 🙌) that spawn **floating emoji** rising up the screen on tap; text input "Say something to the room…"; red send button.

**Panel: STATS**
- **Possession** split bar (ARS 61% / 39% BUR).
- **Match stats** rows (Shots, On target, Corners, xG) with home/away columns.
- **Momentum** — row of bars, red = home dominance.
- **Key events** — minute + description + team tag.
- **Rate the players** — per player: position, name, a 10-segment gold rating bar, average score (Anton).

**Panel: CALL IN**
- Mic icon, "Go on air" title, explainer.
- **Not in queue:** red "Request the mic" button.
- **In queue:** card — "YOU'RE IN THE QUEUE", big "#3" position (Anton), explainer, "Leave queue".
- **ON AIR NOW** list: nathan (HOST, speaking) + priya (co-host, muted).

### Screen: SIGN IN (Profile tab)
- Logo, "1,204 IN THE ROOM RIGHT NOW" pill, big headline "Pull up a seat.", subcopy.
- 3 value-prop rows (gold check squares): chat & reply / vote & rate / ask & call in.
- Email label + input, red "Continue with email →", "OR" divider, "Continue with Apple", "Continue with Google" buttons, legal fine print.

### Bottom tab bar (Live / Matches / Sign-in screens only)
Three items: **LIVE** (broadcast icon) · **MATCHES** (list icon) · **PROFILE** (person icon). Active = `--strong` (#F4F4F2), inactive = `rgb(fg / .4)`. `padding: 9px 8px 26px` (the 26px is home-indicator safe area), translucent blurred background, top border.

---

## PART 2 — WEBSITE / WEB APP (`FanCast - On Air.dc.html`)
Responsive marketing + web-app experience. **Dark theme by default with a working light-theme toggle** (both palettes in Design Tokens). Max content width ~1180px, centered.

- **Persistent nav (sticky):** logo (pulsing red dot + "FANCAST" in Anton), links "How it works / Matches / About", "1 LIVE" red pill, theme toggle (pill with gold knob that slides), "Sign in" (inverted-fill button).
- **Home:**
  1. **Hero** — 2-col grid. Left: eyebrow chip, 66px Anton headline ("Turn the pundits off. Tune in to **real Arsenal fans**."), subcopy, "See what's live →" (red) + "How it works" (gold outline) CTAs, meta row. Right: floating **"ON AIR" player card** (bobbing) — ON AIR pill + clock, scoreboard, host row, waveform w/ sweeping playhead, play button + sync controls. Background: red radial glows + faint masked grid.
  2. **How it works** — 3 cards, big number watermark, gold number chip, title, copy.
  3. **Live now + Coming up** — 2-col: featured live card (dotted texture, red glow, "Join the waiting room →") + "Coming up" fixture list.
  4. **Features** — "● WHY YOU'LL STAY", 6-cell grid (hairline dividers), each: number, title, description.
  5. **Final CTA** — centered, "The room's open. Come in.", red CTA, masked grid.
  6. **Footer** — logo, unofficial-fan-made disclaimer, Platform + Legal link columns.
- **Matches** and **About** are additional nav destinations (same visual system).

---

## Interactions & Behavior

### Mobile app
- **Tab bar** switches LIVE / MATCHES / PROFILE(Sign-in).
- **Any live card / "See what's live"** → enters Room.
- **Room segmented bar** + horizontal **swipe** switches CHAT / STATS / CALL IN (swipe threshold ~55px, must be more horizontal than vertical).
- **Transport collapse/expand** — tap chevron or collapsed bar toggles.
- **Chat pull-to-refresh** — only when scrolled to top; drag translates a header up to 64px; release > 44px triggers refresh (clears "N NEW").
- **Reaction emoji** — tap spawns a floating emoji (random x-offset, rotation, 1.5–2.1s rise), list capped at last 12.
- **Poll** options are tappable (vote).
- **Call-in** — "Request the mic" toggles into a queue state (position #3) and back.
- **Platform toggle** (iOS/Android) and **size toggle** (S/M/L) reconfigure the device frame.

### Website
- Nav links switch Home / Matches / About; "Sign in" → sign-in.
- **Theme toggle** flips dark ⇄ light (knob slides, label updates).
- CTAs route into the app/room flows.

### Animations (durations & easing)
| Name | Use | Spec |
|---|---|---|
| `fcpulse` | live dots | opacity+scale, 1.6–1.8s infinite |
| `fceq` | host/EQ bars | `scaleY(.35→1)` .9s infinite, staggered |
| `fcfloat` | reaction emoji | translateY 0→-150px + fade, ~1.5–2.1s ease-out |
| `fcsweep` | waveform playhead | left -6%→104%, 4.5s linear infinite |
| `fcbob` | web player card | translateY ±7px, 6s ease-in-out |
| `fcticker` | (redesign 1b) marquee | translateX 0→-50%, 26s linear |

Standard hovers on web: buttons brighten (`#F1232B` → `#ff3a41`), outlines increase border opacity.

## State Management (mobile)
Prototype state (recreate equivalently):
- `screen`: `'live' | 'matches' | 'room' | 'signin'`
- `roomTab`: `'chat' | 'stats' | 'callin'`
- `transport`: `'expanded' | 'collapsed'`
- `micQueue`: `null` | number (queue position)
- `floats`: array of active reaction emoji (id, emoji, left%, rotation, duration)
- `newCount`: number of unread messages
- `pull`: current pull-to-refresh offset in px
- `platform`: `'ios' | 'android'` (device-frame only)
- `size`: `'small' | 'std' | 'large'` (device-frame only)

Website state: `screen` (home/matches/about/signin) + `theme` (`dark`/`light`).

**Data:** all data is hard-coded mock (fixtures, chat, poll, stats, players, events). In production these come from live match feeds, a realtime chat/poll service, and audio streaming — wire to real sources.

## Responsive Behavior (the cross-device requirement)
The mobile app is verified across **both operating systems and three device sizes** — the frame is driven by width/height props:

**iOS** — Mini `375×812`, Pro `402×874` (default), Pro Max `430×932`.
**Android** — Compact `360×800`, Pixel `412×892` (default), Large `432×960`.

Requirements the layout must hold to at every size:
- Header and bottom tab bar are fixed; the middle scrolls. Never let fixed chrome push content off-screen.
- In the Room, the expanded transport + segmented bar are fixed; the panel between them scrolls independently — on the shortest screens the chat/stats/call-in area must still scroll cleanly, not clip.
- Min tap target 44px. Body text never below ~13px. Titles use `clamp`-style scaling only if needed; current fixed sizes are tuned to fit the narrowest (360px) width.
- Safe-area top padding: iOS `54px`, Android `34px` (status bar / island / punch-hole). Bottom tab bar reserves `26px` for the home indicator.

The website is fluid to ~1180px max width; below that, the 2-col hero / grids should stack to single column (implement standard responsive breakpoints).

---

## Design Tokens

### Colors — Mobile app & Website (DARK, primary)
```
--bg        #0F0F11   app / page background
--bg2       #121215   raised surfaces, inset fields
--bg3       #131316
--panel     #18181C   cards
--panel-lo  #161619   list rows / muted panels
--panel-hi  #1C1C21   gradient card top
--footer    #0C0C0D
text strong #F4F4F2   (--strong) primary text
text base   rgb(244 244 242 / a)   (--fg) body text at opacity .4–.84
hairline    rgb(255 255 255 / a)   (--line) borders at opacity .06–.16
inverted    bg #F4F4F2 / fg #0F0F11   (high-emphasis buttons, e.g. SYNC NOW)
--gold      #E8B54A   accent (labels, checks, ratings, secondary CTA outline)
RED         #F1232B   brand/live/primary CTA (Arsenal red). Hover #ff3a41
red glow    0 12px 30px -10px rgba(241,35,43,.6)
```

### Colors — Website LIGHT theme
```
--bg #F7F5F0  --bg2 #EFEDE6  --bg3 #EAE8E0  --panel #FFFFFF  --panel-lo #F3F1EA
--footer #EEECE4  text strong #191510  --fg 34 30 26  --line 34 30 26
inverted bg #191510 / fg #F7F5F0   --gold #9A7714   RED stays #F1232B
```

### Typography
```
Display / headlines / logo / scores : "Anton", weight 400, UPPERCASE, letter-spacing ~.03–.05em, line-height ~.9–1
Body / UI / buttons                  : "Hanken Grotesk", 400–800
Labels / eyebrows / meta / timestamps: "Space Mono", 400/700, letter-spacing .06–.16em, often UPPERCASE
```
Mobile type scale (px): hero H1 40 · screen title 34 · card H3 26 / 20 · body 15 / 14 / 13 · label/meta 9–11.
Web type scale (px): hero H1 66 · section H2 50–52 · card H3 20 · body 18 / 14 · label 11.
(The `FanCast Redesign.dc.html` `1b` exploration also uses Bebas Neue / Archivo / IBM Plex Mono — that direction was **not** chosen; ship the Anton / Hanken / Space Mono system from `1a`.)

### Radius / spacing / shadow
```
Radius: pills 20–30px & 9999 · cards 14–20px · buttons 10–12px · chips/badges 4–8px
Card shadow (web): 0 40px 90px -30px rgba(0,0,0,.9), 0 0 60px -20px rgba(241,35,43,.35)
Screen padding (mobile): 16–22px horizontal
Section padding (web): 56–78px vertical, 36–40px horizontal
```

### Icons
Simple line icons drawn as inline SVG (stroke 1.7, round caps): broadcast/live, list, person, chat bubble, bar-chart, microphone, TV, play, equalizer. Replace with the codebase's existing icon set (e.g. Lucide/SF Symbols/Material Symbols) matching these shapes.

## Assets
- **No image/photo assets** are used — avatars are CSS radial-gradient circles, "crowd" textures are CSS dot patterns, club crests are CSS stripe swatches. In production, swap these for real avatars, club crests, and (in the editorial `1b` direction) a crowd photo where the `[ PHOTO: away end … ]` placeholder is noted.
- **Fonts:** Google Fonts — Anton, Hanken Grotesk, Space Mono (+ Bebas Neue, Archivo, IBM Plex Mono only if reviving the `1b` exploration).
- **Legal note to preserve:** FanCast is presented as an *unofficial, fan-made platform, not affiliated with any club, league, or broadcaster.* Keep this disclaimer and avoid real club crests/broadcaster marks unless licensed.

## Suggested build order
1. Design tokens (colors, type, radii) as theme variables in the target system.
2. Shared primitives: pill/badge, card, live-dot, eyebrow label, primary/inverted/outline buttons.
3. Mobile: tab shell + LIVE, MATCHES, SIGN-IN, then the Room (transport → panels → segmented bar) with its interactions.
4. Website: nav + theme toggle, then Home sections, then Matches/About.
5. Wire real data + realtime services; re-verify across the device sizes listed above.
