# Legal and Policy Page Content

Source of truth for in-app legal/policy content. Render as static pages: `/guidelines`, `/terms`, `/privacy`. Consent strings are used inline in product flows. [BRACKETED] items are founder placeholders; build with placeholders visible in dev, but they must be filled before the first public session. Not legal advice; lawyer review before charging at scale.

---

## /guidelines — Community Guidelines

**The short version:** FanCast is the pub for fans who don't have one. Talk like you're in a pub you'd want to stay in: passionate, funny, blunt about football, decent to people.

**The rules:**

- **Football arguments yes, personal attacks no.** Call a performance a disgrace; don't call a person one. Abuse, harassment, hate speech, slurs, or threats directed at anyone — players, refs, other fans — get messages hidden and accounts removed.
- **No links to unauthorized streams.** One strike. Links to pirated streams are removed and repeat sharing ends your account. This rule protects the platform's existence; it is not negotiable.
- **Rival fans are guests, not targets.** Opposition supporters are welcome. Wind-ups are football; pile-ons are not. The vote buttons exist so you can disagree without flooding the chat.
- **Flags are for conduct, votes are for opinion.** Downvote takes you disagree with. Flag only content that breaks these rules. Coordinated false flagging is itself a violation.
- **On air, the room hears you.** Calling in is live broadcasting, recorded as part of the show. The commentator can end any call at any time.
- **No spam, scams, or self-promo flooding.** Sharing your relevant blog or pod: fine. Posting it every five minutes: not.
- **Zero tolerance:** no doxxing, no content sexualizing minors, no incitement, nothing illegal. Immediate removal, reported where required.

**Enforcement:** community flags hide messages automatically; commentators can hide instantly; moderators can remove messages, end calls, and ban accounts and devices. Appeals: [CONTACT EMAIL]. Session recordings and moderation logs keep decisions reviewable.

---

## /terms — Terms of Service

1. **Who we are.** [PLATFORM NAME] is operated by [ENTITY NAME, JURISDICTION]. By creating an account or using the Platform you agree to these Terms and the Community Guidelines.
2. **Eligibility.** You must be at least 13 (16 where local law requires). Accounts are personal and non-transferable.
3. **What the Platform is, and is not.** The Platform hosts live audio commentary by fans, with chat, link sharing, and match data. It does not transmit or provide access to televised match video or audio, and does not authorize sharing access to unauthorized streams. Users supply their own lawful means of watching. The Platform is unofficial and not affiliated with any club, league, or rights holder.
4. **Your content.** You grant a non-exclusive license to host and display chat, links, questions, and widget entries within the service. **Broadcast audio is different: commentators (and on-air guests as part of the show) retain all rights to broadcast recordings. The Platform claims no ownership and takes no license beyond what is technically necessary to record, process, and deliver the files to the commentator.**
5. **Going on air.** Requesting to talk constitutes consent to your voice being broadcast live and recorded as part of the session recording, which the commentator may publish (for example as a podcast). If you do not consent, do not request to talk.
6. **Tips and recurring support.** Processed by Stripe. Voluntary, non-refundable except where law requires; support for commentary, not purchases. Recurring support cancellable anytime via the customer portal. The Platform retains a [X]% service fee, displayed at the point of payment.
7. **Acceptable use.** The Community Guidelines are part of these Terms. We may remove content, end calls, suspend or terminate accounts, and preserve/disclose records where law requires.
8. **Copyright complaints.** DMCA notices to our designated agent: [DMCA AGENT EMAIL / ADDRESS]. Repeat infringers are terminated.
9. **Disclaimers and liability.** Provided as-is during a test phase; live audio, data feeds, and recordings may fail. Liability limited to amounts paid to the Platform in the prior 12 months, to the maximum extent permitted by law.
10. **Changes, governing law.** Updates with in-app notice. Governing law and venue: [JURISDICTION].

---

## /privacy — Privacy Policy

**What we collect:** account (email, username, preferences); activity (messages, links, votes, flags, questions, talk requests, widget entries, follows, session join/leave times and listening mode, used for retention analytics); broadcast audio if you go on air; payment references via Stripe (never card numbers); technical data (IP, device/browser type, a device identifier for abuse prevention).

**Why (legal bases):** running the service (contract); room safety and ban enforcement (legitimate interest); going-live emails you opted into by following (consent, one-click withdrawal); legal obligations. We do not sell personal data and run no third-party advertising or tracking.

**Processors:** Supabase (database, auth, storage), LiveKit (audio), Ably (realtime), Vercel (hosting), Stripe (payments), Resend (email), API-Football (match data; receives no personal data). Data may be processed in the US under standard contractual clauses.

**Retention:** room content [12 months]; session recordings and segments 90 days unless pinned by the commentator; moderation logs [24 months]; account data until deletion. Deleting your account removes your profile and identifiers; your voice within a commentator's published recordings is part of their broadcast work (Terms §5).

**Your rights:** access, correction, export, deletion, objection: [CONTACT EMAIL], response within 30 days. EU/UK users may complain to their supervisory authority. Users must be 13+ (16+ where applicable); underage accounts deleted on discovery.

---

## In-product consent strings

**Request to Talk, first use (required checkbox):**
> You're asking to go on air. If the commentator accepts, your voice is broadcast live to everyone in the room and becomes part of the show's recording, which the commentator owns and may publish (for example, as a podcast episode). You can leave the air at any time with the Leave Air button.
> [ ] I understand and agree.

**Request to Talk, subsequent uses (above topic field):**
> Live to the room. Recorded as part of the show.

**Downloads panel rights notice:**
> These recordings are yours. The platform claims no rights and requires nothing. If you'd like to credit the show, you can copy: "Recorded live on [PLATFORM NAME] during [MATCH]."

**Footer disclaimer:**
> [PLATFORM NAME] is an unofficial, fan-made platform and is not affiliated with or endorsed by any club, league, or broadcaster.
