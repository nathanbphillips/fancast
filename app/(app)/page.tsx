import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { loadFixtures } from "@/lib/db/fixtures";
import { KickoffTime } from "@/components/KickoffTime";
import { NotifyForm } from "@/components/marketing/NotifyForm";
import { HeroProductShot } from "@/components/marketing/HeroProductShot";
import { SyncDiagram } from "@/components/marketing/SyncDiagram";
import { Countdown } from "@/components/marketing/Countdown";

/**
 * Home (Matchday redesign): centred hero + product-shot preview → honest stat
 * band → signature sync differentiator → bento → stickiness → Voices archetypes
 * → real schedule/RSVP → host + closing CTAs. Real fixtures drive every live/
 * upcoming state via loadFixtures; the design's fabricated counts (listeners,
 * messages, followers, streak) are dropped or replaced with archetypes per the
 * hybrid-honesty rule. Compliance: "watch" only ever = the viewer's own stream.
 */

export const revalidate = 60;

export const metadata: Metadata = {
  description:
    "The matchday room for Arsenal fans. Turn the pundits off and listen with real supporters, in sync with your own stream. Free to listen, no account needed.",
  alternates: { canonical: "/" },
};

const eyebrow =
  "inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red";

const VOICES = [
  {
    t: "The lifelong Gooner",
    d: "Lives and dies with every result. Never on the fence, never neutral.",
    grad: "linear-gradient(135deg,#ef0107,#7a0a12)",
  },
  {
    t: "The tactics head",
    d: "The xG and the press triggers, then forgets it all when we score a worldie.",
    grad: "linear-gradient(135deg,#1f6f4a,#0c3a26)",
  },
  {
    t: "The call-in host",
    d: "Runs the half-time poll and the call-in mic, so the whole room gets a say.",
    grad: "linear-gradient(135deg,#2a4a8a,#12224a)",
  },
];

export default async function HomePage() {
  const { live, upcoming } = await loadFixtures();
  const featured = live[0] ?? upcoming[0] ?? null;
  const featuredLive = featured ? featured.card.state !== "scheduled" : false;

  // hero CTA stays honest about state — deep-links into a live/next room when
  // one exists (rooms read free, no account), else points at the schedule
  const heroPrimary =
    featured && featuredLive
      ? {
          href: featured.card.roomHref ?? "/matches",
          label:
            featured.card.state === "live" ? "Listen now, free" : "Join the waiting room",
        }
      : featured?.card.roomHref
        ? { href: featured.card.roomHref, label: "Join the next room" }
        : { href: "/matches", label: "See the schedule" };

  // schedule section: live room leads if one is on, else the soonest upcoming
  const liveRoom = live[0] ?? null;
  const scheduleFeatured = liveRoom ?? upcoming[0] ?? null;
  const rows = (liveRoom ? upcoming.slice(0, 3) : upcoming.slice(1, 4)).filter(
    Boolean,
  );

  return (
    <>
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden px-5 pt-16 pb-10 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="animate-fc-glow absolute -top-44 left-1/2 h-[640px] w-[1000px] -translate-x-1/2"
            style={{
              background:
                "radial-gradient(58% 58% at 50% 38%, rgba(239,1,7,.22), transparent 72%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(rgb(var(--hair) / 0.05) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
              opacity: 0.5,
              maskImage: "radial-gradient(70% 60% at 50% 40%, black, transparent)",
              WebkitMaskImage:
                "radial-gradient(70% 60% at 50% 40%, black, transparent)",
            }}
          />
        </div>

        <div className="relative z-[2] mx-auto max-w-[840px] text-center">
          <span className="inline-flex animate-fc-rise items-center gap-2 rounded-full border border-line bg-surface/40 px-[15px] py-2 font-mono text-[12px] text-secondary">
            <span className="h-[7px] w-[7px] animate-fcpulse rounded-full bg-red" />
            The matchday room for Arsenal fans
          </span>
          <h1 className="display mt-6 t-hero text-primary">
            Every match feels better
            <br />
            in a{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(120deg,#ff2e28,#ef0107 55%,#b00206)",
              }}
            >
              full room
            </span>
            .
          </h1>
          <p className="mx-auto mt-[22px] max-w-[588px] text-[18px] leading-[1.62] text-secondary">
            Keep your own stream. {brand.name} adds a real Arsenal supporter in
            your ear, a chat worth reading and live stats, locked to your screen
            with a single tap. And when there&apos;s no game on, the room&apos;s
            still open to talk Arsenal any time.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={heroPrimary.href}
              className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-7 py-4 text-[15px] font-semibold text-white"
            >
              {heroPrimary.label} <span aria-hidden="true">→</span>
              <span aria-hidden="true" className="btn-shine" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 rounded-[13px] border border-line bg-surface/40 px-[26px] py-4 text-[15px] font-semibold text-primary transition-colors hover:bg-raised"
            >
              How it works
            </Link>
          </div>
          <p className="mt-[18px] font-mono text-[12px] text-tertiary">
            Free to listen · no account needed · installs to your home screen
          </p>
        </div>

        <HeroProductShot />
      </section>

      {/* ===================== STAT BAND ===================== */}
      <section className="border-y border-line px-5 py-9 sm:px-10">
        <div className="mx-auto grid max-w-[1010px] grid-cols-2 md:grid-cols-4">
          {[
            { n: "0", l: "pundits on the payroll", red: false },
            { n: "100%", l: "of recordings owned by hosts", red: true },
            { n: "<1min", l: "to sign up and join in", red: false },
            { n: "£0", l: "to listen, no account", red: false },
          ].map((s, i) => (
            <div
              key={s.l}
              className={`px-5 py-2 text-center ${i > 0 ? "md:border-l md:border-line" : ""}`}
            >
              <div
                className={`display text-[42px] ${s.red ? "text-red" : "text-primary"}`}
              >
                {s.n}
              </div>
              <div className="mt-1 text-[13px] text-secondary">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== SIGNATURE SYNC ===================== */}
      <section className="relative overflow-hidden px-5 py-[70px] sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/4 -right-24 h-[500px] w-[500px]"
          style={{
            background:
              "radial-gradient(circle, rgba(239,1,7,.1), transparent 66%)",
          }}
        />
        <div className="relative z-[2] mx-auto grid max-w-[1010px] items-center gap-12 lg:grid-cols-[.92fr_1.08fr]">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="h-px w-[22px] bg-red" />
              <span className={eyebrow}>THE BIT NOBODY ELSE DOES</span>
            </div>
            <h2 className="display t-h2">Your telly lags. We fix that in one tap.</h2>
            <p className="mt-4 max-w-[420px] text-[16px] leading-[1.62] text-secondary">
              Every stream runs on its own delay, so a shared watchalong is
              always out of step with your screen. {brand.name} is different: tap{" "}
              <b className="text-primary">Now</b> when your screen hits the moment
              on the clock, and the commentary snaps to your exact feed, then
              nudge it half a second either way, or jump back to live.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {[
                { n: "1", t: "Watch on whatever you already pay for", ok: false },
                { n: "2", t: "Tap Now when the clock matches your screen", ok: false },
                { n: "✓", t: "Locked — the room is in perfect sync with you", ok: true },
              ].map((s) => (
                <div key={s.t} className="flex items-center gap-3">
                  <span
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] font-mono text-[13px] font-bold"
                    style={{
                      background: s.ok
                        ? "rgba(52,209,122,.14)"
                        : "rgba(239,1,7,.14)",
                      color: s.ok ? "var(--green)" : "var(--red)",
                    }}
                  >
                    {s.n}
                  </span>
                  <span className="text-[14px] text-secondary">{s.t}</span>
                </div>
              ))}
            </div>
          </div>
          <SyncDiagram />
        </div>
      </section>

      {/* ===================== BENTO ===================== */}
      <section className="mx-auto max-w-[1010px] px-5 pb-[66px] sm:px-10">
        <div className="mb-8 text-center">
          <div className={`${eyebrow} mb-3 justify-center`}>NOT JUST A GROUP CALL</div>
          <h2 className="display t-h2">One second screen. Everything in it.</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:[grid-auto-rows:158px]">
          {/* chat — big */}
          <div className="col-span-2 flex flex-col rounded-2xl border border-line bg-raised p-6 transition-transform hover:-translate-y-[3px] md:row-span-2">
            <div className="t-title font-extrabold">A chat worth reading</div>
            <p className="mt-2 max-w-[330px] text-[14px] leading-[1.55] text-secondary">
              Threaded replies, up- and down-votes, sorted by New, Top or
              Controversial. Good takes rise; noise sinks.
            </p>
            <div className="mt-auto flex flex-col gap-2">
              {[
                { i: "N", g: "#2a4a8a", n: "Nathan", m: "Ødegaard, take a bow." },
                { i: "TT", g: "#1f6f4a", n: "TheTacticsHead", m: "Press trigger on the turn. Textbook." },
              ].map((c) => (
                <div
                  key={c.n}
                  className="flex items-center gap-2.5 rounded-[11px] border border-line bg-canvas p-2.5"
                >
                  <span
                    className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: c.g }}
                  >
                    {c.i}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold text-primary">{c.n}</span>
                    <span className="block truncate text-[12px] text-secondary">{c.m}</span>
                  </span>
                  <span aria-hidden="true" className="text-red">▲</span>
                </div>
              ))}
            </div>
          </div>
          {/* stats */}
          <div className="col-span-2 flex items-center gap-5 rounded-2xl border border-line bg-raised p-[22px] transition-transform hover:-translate-y-[3px]">
            <div className="flex-1">
              <div className="t-title font-extrabold">The stats that matter</div>
              <div className="mt-1 text-[13px] text-secondary">
                Possession, shots, xG &amp; momentum, live.
              </div>
            </div>
            <div className="text-right">
              <div className="display text-[30px] text-red tabular-nums">xG</div>
              <div className="font-mono text-[10px] text-tertiary">live from kickoff</div>
            </div>
          </div>
          {/* callin */}
          <div className="flex flex-col justify-center rounded-2xl border border-line bg-raised p-[22px] transition-transform hover:-translate-y-[3px]">
            <div className="t-title font-extrabold">Ask · vote · call in</div>
            <div className="mt-1.5 text-[12px] leading-[1.5] text-secondary">
              Request the mic and the host brings you on air.
            </div>
          </div>
          {/* radio */}
          <div className="flex flex-col justify-center gap-2.5 rounded-2xl border border-line bg-raised p-[22px] transition-transform hover:-translate-y-[3px]">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-line bg-canvas text-primary">
              ▸
            </span>
            <div>
              <div className="t-title font-extrabold">Radio mode</div>
              <div className="text-[12px] text-secondary">Plays on your lock screen.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== STICKINESS ===================== */}
      <section className="mx-auto max-w-[1010px] px-5 pb-10 sm:px-10">
        <div className="mb-8 text-center">
          <div className={`${eyebrow} mb-2.5 justify-center`}>WHY YOU&apos;LL COME BACK</div>
          <h2 className="display t-h2">The habit, not just the match</h2>
        </div>
        <div className="flex flex-col gap-4">
          {/* community */}
          <div className="grid items-center gap-6 rounded-[18px] border border-line bg-raised p-8 md:grid-cols-2">
            <div>
              <div className="t-h3 display">The room becomes your people</div>
              <p className="mt-2.5 text-[15px] leading-[1.6] text-secondary">
                The same faces every week, good takes rising to the top, in-jokes
                that carry from match to match. And it doesn&apos;t close at full
                time, pop in to talk transfers, react to the news, or just hang
                out. It stops being a broadcast and starts being your corner of
                the ground.
              </p>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { i: "N", g: "#2a4a8a", n: "Nathan", m: "Ødegaard, take a bow." },
                { i: "TT", g: "#1f6f4a", n: "TheTacticsHead", m: "Press trigger on the turn. Textbook." },
              ].map((c) => (
                <div key={c.n} className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas p-3">
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: c.g }}>{c.i}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-primary">{c.n}</span>
                    <span className="block truncate text-[13px] text-secondary">{c.m}</span>
                  </span>
                  <span aria-hidden="true" className="text-red">▲</span>
                </div>
              ))}
            </div>
          </div>
          {/* follow */}
          <div className="grid items-center gap-6 rounded-[18px] border border-line bg-raised p-8 md:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3 rounded-[14px] border border-line bg-canvas p-4 shadow-glow">
                <span className="h-[11px] w-[11px] shrink-0 animate-fcpulse rounded-full bg-red" />
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-primary">A room you follow is live</span>
                  <span className="block text-[12px] text-secondary">tap to jump in</span>
                </span>
                <span className="font-mono text-[11px] text-tertiary">now</span>
              </div>
              <div className="flex items-center gap-3 rounded-[14px] border border-line bg-canvas p-4">
                <span className="h-[11px] w-[11px] shrink-0 rounded-full bg-tertiary" />
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-primary">A new room was scheduled</span>
                  <span className="block text-[12px] text-secondary">for a match you care about</span>
                </span>
                <span className="font-mono text-[11px] text-tertiary">2h</span>
              </div>
            </div>
            <div>
              <div className="t-h3 display">Never miss the first whistle</div>
              <p className="mt-2.5 text-[15px] leading-[1.6] text-secondary">
                Follow the voices you like. We nudge you by push or email the
                second they schedule a room or go live, and you choose exactly
                which alerts reach you.
              </p>
              <Link
                href="/signin"
                className="btn-grad-red mt-4 inline-flex items-center rounded-[11px] px-[18px] py-[11px] text-[13px] font-semibold text-white"
              >
                Follow a commentator
              </Link>
            </div>
          </div>
          {/* recordings + fan score */}
          <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
            <div className="rounded-[18px] border border-line bg-raised p-7">
              <div className="t-h3 display">Miss it live? Keep every minute</div>
              <p className="mt-2 mb-4 text-[14px] leading-[1.6] text-secondary">
                Every broadcast is cut into downloadable clips, owned 100% by the
                host, ready for any podcast feed.
              </p>
              <div className="flex flex-col gap-2">
                {["Pre-match build-up", "First half"].map((seg) => (
                  <div key={seg} className="flex items-center gap-3 rounded-[10px] border border-line bg-canvas px-3.5 py-2.5">
                    <span className="flex-1 text-[13px] font-bold text-primary">{seg}</span>
                    <span aria-hidden="true" className="font-bold text-red">↓</span>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="flex flex-col rounded-[18px] border p-7"
              style={{
                background:
                  "linear-gradient(180deg, rgba(239,1,7,0.06), var(--bg-inset))",
                borderColor: "rgba(239,1,7,.24)",
              }}
            >
              <div className="mb-1.5 font-mono text-[11px] font-bold tracking-[0.08em] text-red">
                YOUR FAN SCORE
              </div>
              <div className="t-h3 display">Show up, and it shows</div>
              <p className="mt-2.5 text-[13px] leading-[1.55] text-secondary">
                Comments and good votes build a fan score for every match you
                turn up to — the start of badges and standing to come.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== VOICES ===================== */}
      <section className="mx-auto max-w-[1010px] px-5 pb-14 sm:px-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className={`${eyebrow} mb-2.5`}>THE VOICES</div>
            <h2 className="display t-h2">Real supporters. Never pundits.</h2>
          </div>
          <Link href="/about" className="text-[14px] font-semibold text-secondary hover:text-primary">
            Meet the voices →
          </Link>
        </div>
        <div className="grid gap-3.5 md:grid-cols-3">
          {VOICES.map((v) => (
            <div key={v.t} className="rounded-2xl border border-line bg-raised p-[22px] transition-transform hover:-translate-y-[3px]">
              <span className="mb-3.5 flex h-[50px] w-[50px] items-center justify-center rounded-full" style={{ background: v.grad }} />
              <div className="t-title font-extrabold">{v.t}</div>
              <p className="mt-[7px] mb-4 text-[13px] leading-[1.55] text-secondary">{v.d}</p>
              <Link
                href="/signin"
                className="inline-flex items-center rounded-[9px] border border-line px-4 py-2 text-[12px] font-semibold text-primary transition-colors hover:bg-canvas"
              >
                Follow
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== SCHEDULE / RSVP ===================== */}
      <section className="mx-auto max-w-[1010px] px-5 pb-14 sm:px-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className={`${eyebrow} mb-2.5`}>SAVE YOUR SEAT</div>
            <h2 className="display t-h2">Coming up</h2>
          </div>
          <Link href="/matches" className="rounded-[10px] border border-line px-[18px] py-[11px] text-[13px] font-semibold text-secondary hover:text-primary">
            Full schedule →
          </Link>
        </div>

        {scheduleFeatured ? (
          <>
            <div
              className="relative mb-3 flex flex-wrap items-center gap-6 overflow-hidden rounded-[18px] border p-7"
              style={{
                background:
                  "linear-gradient(110deg, rgba(239,1,7,.16), transparent 58%), var(--bg-surface)",
                borderColor: "rgba(239,1,7,.3)",
              }}
            >
              <div className="relative z-[2] min-w-[280px] flex-1">
                <div className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] text-red">
                  <span className="h-[7px] w-[7px] animate-fc-blink rounded-full bg-red" />
                  {liveRoom ? "LIVE NOW" : "NEXT UP"}
                </div>
                <div className="display text-[34px]">
                  {scheduleFeatured.card.home}{" "}
                  <span className="text-secondary">v</span>{" "}
                  {scheduleFeatured.card.away}
                </div>
                <div className="mt-1.5 text-[13px] text-secondary">
                  {scheduleFeatured.card.competition}
                  {scheduleFeatured.card.commentator
                    ? ` · with ${scheduleFeatured.card.commentator}`
                    : ""}
                </div>
              </div>
              <div className="relative z-[2] flex min-w-[240px] flex-col gap-3">
                {!liveRoom && (
                  <div className="rounded-xl border border-line bg-canvas p-3.5 text-center">
                    <div className="mb-1 font-mono text-[10px] tracking-[0.08em] text-tertiary">
                      KICKS OFF IN
                    </div>
                    <div className="display text-[30px] text-primary">
                      <Countdown iso={scheduleFeatured.card.kickoffUtc} />
                    </div>
                  </div>
                )}
                <Link
                  href={scheduleFeatured.card.roomHref ?? "/matches"}
                  className="btn-grad-red rounded-[11px] px-5 py-3.5 text-center text-[14px] font-semibold text-white"
                >
                  {liveRoom ? "Join live" : "Count me in"}
                </Link>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {rows.map((w) => (
                  <Link
                    key={w.card.id}
                    href={w.card.roomHref ?? "/matches"}
                    className="flex items-center gap-4 rounded-xl border border-line bg-raised px-[18px] py-[15px] transition-colors hover:border-red/40"
                  >
                    <span className="w-[130px] shrink-0 font-mono text-[12px] text-secondary">
                      <KickoffTime iso={w.card.kickoffUtc} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-primary">
                      {w.card.home} vs {w.card.away}
                    </span>
                    <span className="hidden font-mono text-[12px] text-tertiary sm:block">
                      {w.card.competition}
                    </span>
                    <span aria-hidden="true" className="text-lg text-secondary">›</span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-[18px] border border-line bg-raised p-8">
            <div className="t-title font-extrabold">No rooms scheduled yet</div>
            <p className="mt-2 mb-4 max-w-md text-[14px] text-secondary">
              Get an email the moment the first Arsenal rooms open, and be there
              for the first whistle.
            </p>
            <NotifyForm source="home_empty" className="max-w-sm" />
          </div>
        )}
      </section>

      {/* ===================== HOST CTA ===================== */}
      <section className="mx-auto max-w-[1010px] px-5 pb-14 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-5 rounded-[18px] border border-line bg-raised p-8">
          <div>
            <div className={`${eyebrow} mb-2.5`}>FOR COMMENTATORS</div>
            <div className="display t-h3">Rather run the show?</div>
            <p className="mt-2 max-w-[520px] text-[14px] text-secondary">
              Become a commentator in about a minute. No platform fee, tips are
              yours, and every recording is 100% yours to keep. One rule: audio
              only, always.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <Link href="/host" className="btn-grad-red rounded-[11px] px-6 py-3.5 text-center text-[14px] font-semibold text-white">
              Start a room →
            </Link>
            <Link href="/host/guide" className="rounded-[11px] border border-line px-6 py-3.5 text-center text-[14px] font-semibold text-primary hover:bg-canvas">
              Host handbook
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== CLOSING CTA ===================== */}
      <section className="relative overflow-hidden border-t border-line px-5 py-20 text-center sm:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 50%, rgba(239,1,7,.2), transparent 70%)",
          }}
        />
        <div className="relative z-[2]">
          <h2 className="display mx-auto t-hero">The room&apos;s open. Pull up a seat.</h2>
          <p className="mx-auto mt-[18px] max-w-[500px] text-[17px] leading-[1.6] text-secondary">
            Live on matchday, open the rest of the week. Free to listen, no
            account needed. Sign up in under a minute when you want to chat, vote
            or call in.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/matches"
              className="btn-grad-red inline-flex items-center gap-2 rounded-[13px] px-[30px] py-4 text-[15px] font-semibold text-white"
            >
              Find your next room <span aria-hidden="true">→</span>
              <span aria-hidden="true" className="btn-shine" />
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center rounded-[13px] border border-line bg-surface/40 px-[26px] py-4 text-[15px] font-semibold text-primary hover:bg-raised"
            >
              Get matchday alerts
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
