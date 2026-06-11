# Setup Checklist (human-only tasks)

Claude Code cannot create accounts or accept terms of service. Complete these yourself; each item says when it's needed, so you can stay ahead of the build without doing everything on day one. Fill `.env.local` from `.env.example` as you go, and mirror values in the Vercel dashboard.

## Before Phase 1
- [ ] GitHub repo created; copy this starter kit's contents in
- [ ] Vercel account; connect the repo (Hobby tier is fine until Phase 9)
- [ ] Domain (optional now, needed before public test): buy, point at Vercel

## Before Phase 2
- [ ] Supabase project (free tier): grab URL, anon key, service role key
- [ ] Enable email (magic link) auth; add one OAuth provider (Google recommended)
- [ ] API-Football subscription: **Pro tier, $19/mo** (free tier cannot cover a match day). Grab key. Note Arsenal team ID and current Premier League season/league IDs in `lib/config.ts` once the build reaches fixtures
- [ ] First signup = you; put your user ID in ADMIN_USER_IDS and grant yourself the commentator role

## Before Phase 3
- [ ] Ably account (free tier): create app, grab API key

## Before Phase 5
- [ ] LiveKit Cloud account: **Ship tier, $50/mo, before any real listeners** (free tier hard-caps at 5,000 participant-minutes; one full 50-listener session ≈ 7,500 and will cut off mid-match). Grab URL, API key, secret
- [ ] Decent USB headset/mic for commentating; wired headphones (mic discipline: your TV must never be audible)

## Before Phase 8
- [ ] Supabase Storage: create `recordings` bucket (private); generate S3-compatible access keys (Settings → Storage) for LiveKit egress

## Before Phase 9
- [ ] Stripe account (activate live mode later; test mode is enough to build): publishable + secret keys, webhook secret after Claude Code creates the endpoint
- [ ] Create three monthly Prices ($3/$5/$10) in Stripe; paste price IDs into env
- [ ] **Decide the platform fee percentage on tips** (default in spec: 10%) and tell Claude Code
- [ ] Resend account: API key; verify your sending domain; set EMAIL_FROM
- [ ] Vercel **Pro** upgrade (Hobby prohibits commercial use; tipping makes you commercial)

## Before the first public session (Phase 10)
- [ ] Fill every [BRACKETED] placeholder in docs/LEGAL_PAGES.md: entity name, jurisdiction, contact email, fee %
- [ ] Register a DMCA agent with the US Copyright Office (~$6) and put the agent contact in the terms
- [ ] Final name decision if renaming (one edit in `lib/brand.ts` + domain + email sender)
- [ ] Dry-run session with 2-3 friends before the Bluesky announcement

## Ongoing
- [ ] Keep an eye on LiveKit minutes (dashboard) the first two real sessions; confirm the Ship tier allowance covers your actual listener counts
