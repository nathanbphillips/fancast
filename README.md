# FanCast Build Starter Kit

This folder is the complete handoff package for building FanCast with Claude Code.

## How to use it

1. Create your project repo (`fancast/` or similar) and copy the contents of this folder into it:
   - `CLAUDE.md` goes in the repo root
   - `docs/` goes in the repo root
   - `.env.example` goes in the repo root
   - `SETUP_CHECKLIST.md` and `KICKOFF_PROMPT.md` can live in the root or `docs/`
2. Work through `SETUP_CHECKLIST.md` (accounts and keys; only you can do this). Fill a local `.env.local` from `.env.example` as you go.
3. Open Claude Code in the repo and paste the contents of `KICKOFF_PROMPT.md` to start Phase 1.
4. Claude Code tracks progress by checking boxes in `docs/PHASES.md` as acceptance criteria pass. One phase at a time.

## What's in here

| File | Purpose |
|---|---|
| `CLAUDE.md` | Standing instructions Claude Code reads every session: rules, conventions, decisions |
| `docs/PRD.md` | All functional requirements with acceptance criteria |
| `docs/ARCHITECTURE.md` | Stack, data model, realtime channels, API routes, audio pipeline |
| `docs/DESIGN.md` | Design tokens (dark + light), components, clock rules, accessibility |
| `docs/PHASES.md` | The 10-phase build plan as a living checklist |
| `docs/LEGAL_PAGES.md` | Page content for /guidelines, /terms, /privacy, plus consent copy |
| `.env.example` | Every environment variable the app needs |
| `SETUP_CHECKLIST.md` | Human-only provisioning tasks (accounts, tiers, keys) |
| `KICKOFF_PROMPT.md` | The exact prompt to start Phase 1 in Claude Code |

The Word documents in the parent folder (Project Brief, PRD, Design Brief, Compliance Pack) remain the human-readable masters; these markdown files are the build-facing versions. If they ever disagree, the markdown in the repo wins for build purposes, and the discrepancy should be flagged.
