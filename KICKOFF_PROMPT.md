# Phase 1 Kickoff Prompt

Paste everything below the line into Claude Code in the repo root to begin the build.

---

Read CLAUDE.md, then docs/PHASES.md, docs/DESIGN.md, and skim docs/PRD.md and docs/ARCHITECTURE.md so you know where everything is specified. We are starting Phase 1 only.

Build Phase 1 exactly as listed in docs/PHASES.md:

1. Scaffold Next.js (App Router) + TypeScript strict + Tailwind. Set up the Vercel deploy pipeline (I've connected the repo).
2. Create `lib/brand.ts` exporting the product name, tagline, recording file-name template, and email sender name. All user-facing brand strings must import from it; the product will be renamed later.
3. Implement the design token system from docs/DESIGN.md as CSS variables with `dark` and `light` themes: system-preference default, header toggle, persisted choice, no flash on load. Wire Tailwind to the variables.
4. Build the layout shells: mobile-first stacked layout (match header with score + clock/state placeholder, audio strip, chat area, tabbed stats/links), expanding to the desktop three-column grid (stats 25% / chat 50% / links 25%) with the persistent bottom audio bar (listener variant, UI only, no audio yet).
5. Home page shell with placeholder fixture cards in their three visual states (scheduled / waiting / live) per docs/DESIGN.md.

Constraints for this phase: no auth, no database, no realtime, no audio. Static placeholder data only. Use semantic HTML, 44px touch targets, visible focus states, tabular numerals on all numbers, and AA contrast in both themes.

Definition of done (from docs/PHASES.md): deployed site renders both themes correctly and is responsive at 360px, 768px, and 1280px. When all Phase 1 boxes pass, check them off in docs/PHASES.md, update the "Current phase" line, commit, and stop for my review before Phase 2.

If anything in the docs is ambiguous, make the smallest reasonable choice and record it in the CLAUDE.md decision log with status "Assumed".
