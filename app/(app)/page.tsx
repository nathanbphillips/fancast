import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { brand } from "@/lib/brand";
import { loadFixtures } from "@/lib/db/fixtures";
import { KickoffTime } from "@/components/KickoffTime";
import { OnAirCard } from "@/components/marketing/OnAirCard";
import { NotifyForm } from "@/components/marketing/NotifyForm";
import { Faq } from "@/components/marketing/Faq";

/**
 * Home (Cloud Design "1a"): hero + bobbing ON AIR card → how it works → live +
 * coming-up teaser (real fixtures) → features → final CTA. Copy is verbatim from
 * the design (no em-dashes). Compliance: "watch" only ever = the viewer's own
 * stream; the unaffiliated disclaimer rides the shared footer.
 */

export const revalidate = 60;

// The home page is the most-shared URL, so give it its own description + canonical
// instead of inheriting the bare site default (front-end review item 23).
export const metadata: Metadata = {
  description:
    "The matchday room for Arsenal fans. Turn the pundits off and listen with real supporters, in sync with your own stream. Free to listen, no account needed.",
  alternates: { canonical: "/" },
};

// Step watermark icons (design: 72px, gold, opacity .55, top-right of each card).
const stepIcon = (paths: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className="h-[72px] w-[72px]"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {paths}
  </svg>
);

const STEPS = [
  {
    n: "01",
    t: "Bring your own stream",
    d: "Watch the match the way you always do: your telly, your app, your subscription. FanCast doesn't show the game; it sits beside it.",
    icon: stepIcon(
      <>
        <rect x="2.5" y="4" width="19" height="12" rx="2" />
        <line x1="8" y1="20" x2="16" y2="20" />
        <line x1="12" y1="16" x2="12" y2="20" />
      </>,
    ),
  },
  {
    n: "02",
    t: "Press play and sync",
    d: "Tap in for live fan audio, then line it up to your screen. When your TV hits a moment, tap Now and the audio locks to your feed.",
    icon: stepIcon(
      <>
        <circle cx="12" cy="12" r="9" />
        <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
      </>,
    ),
  },
  {
    n: "03",
    t: "Pull up a seat",
    d: "Jump in and listen along. Signing up takes under a minute and lets you chat, vote, ask the commentator, or call in.",
    icon: stepIcon(
      <>
        <line x1="6" y1="14" x2="6" y2="18" />
        <line x1="10" y1="9" x2="10" y2="18" />
        <line x1="14" y1="6" x2="14" y2="18" />
        <line x1="18" y1="11" x2="18" y2="18" />
      </>,
    ),
  },
];

const FEATURES = [
  {
    n: "01",
    k: "A fan, not a pundit",
    d: "A Gooner who lives and dies with every result, on your side, never neutral.",
  },
  {
    n: "02",
    k: "Synced to your screen",
    d: "One tap lines the audio to your feed, with half-second nudges and a jump back to live.",
  },
  {
    n: "03",
    k: "A chat worth reading",
    d: "Threaded replies, upvotes, and sort by New, Top or Controversial. Good takes rise, noise sinks.",
  },
  {
    n: "04",
    k: "The stats that matter",
    d: "Possession, shots, xG, momentum, lineups and team news, live from kickoff.",
  },
  {
    n: "05",
    k: "Ask, vote, call in",
    d: "Question the commentator, settle the half-time poll, rate the players, or request the mic.",
  },
  {
    n: "06",
    k: "Yours to keep",
    d: "Every show is recorded into downloadable segments. The host owns it; we claim nothing.",
  },
];

// The objections that block signup, answered where the decision is made (the
// full set lives on /about). Compliance-safe: never implies we show the match.
const HOME_FAQ = [
  {
    q: "Do I need to pay or sign up?",
    a: "No. Anyone can listen and read the chat and stats with no account. You only sign up, in under a minute, to chat, vote, ask a question, or call in.",
  },
  {
    q: "Do you show the match?",
    a: "No, and we never will. You watch the game however you already do; we ride alongside it with fan audio, chat, and stats, lined up to your screen.",
  },
  {
    q: "Is this official Arsenal?",
    a: "No. FanCast is an unofficial, fan-made platform and is not affiliated with or endorsed by Arsenal, the Premier League, or any broadcaster.",
  },
  {
    q: "Does it work on my iPhone?",
    a: "Yes. It runs in the browser including iOS Safari, installs to your home screen, and keeps playing audio on the lock screen like a radio.",
  },
];

export default async function HomePage() {
  const { live, upcoming } = await loadFixtures();
  const featured = live[0] ?? upcoming[0] ?? null;
  const featuredLive = featured ? featured.card.state !== "scheduled" : false;
  const comingUp = upcoming.slice(0, 3);

  const featuredRoomHref = featured?.card.roomHref ?? null;
  const featuredCtaHref = featuredRoomHref ?? "/matches";
  const featuredCtaLabel = featuredLive
    ? featured?.card.state === "live"
      ? "Join live"
      : "Join the waiting room"
    : featuredRoomHref
      ? "Join the waiting room"
      : "See the schedule";

  // Hero primary CTA stays honest about state: it never promises "live" when
  // nothing is, and when a room is on it deep-links straight in (rooms are
  // readable with no account, so this is the "listen free" wedge).
  const heroPrimary =
    featured && featuredLive
      ? {
          href: featuredRoomHref ?? "/matches",
          label:
            featured.card.state === "live"
              ? "Listen now, free"
              : "Join the waiting room",
        }
      : featuredRoomHref
        ? { href: featuredRoomHref, label: "Join the next room" }
        : { href: "/matches", label: "See the schedule" };

  return (
    <>
      {/* HERO */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 90% at 88% -15%, rgba(241,35,43,0.20), transparent 58%), radial-gradient(90% 70% at 8% 110%, rgba(241,35,43,0.08), transparent 60%), var(--bg-base)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--hair) / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--hair) / 0.04) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            maskImage:
              "radial-gradient(120% 100% at 70% 0%, black, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(120% 100% at 70% 0%, black, transparent 75%)",
          }}
        />
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-5 py-16 sm:px-10 lg:grid-cols-[1.04fr_.96fr] lg:py-[76px]">
          <div>
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-[7px] font-mono text-[11px] tracking-[0.14em] text-secondary uppercase">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-red"
                  style={{ boxShadow: "0 0 10px #f1232b" }}
                />
                Live fan commentary · Arsenal
              </span>
              <span className="inline-flex items-center rounded-full border border-gold/40 px-3 py-[7px] font-mono text-[11px] tracking-[0.14em] text-gold uppercase">
                Early access
              </span>
            </div>
            <h1 className="display text-[42px] leading-[0.98] tracking-[0.005em] text-primary sm:text-[66px]">
              Turn the pundits off. Tune in to real{" "}
              <span
                className="text-red"
                style={{ textShadow: "0 0 34px rgba(241,35,43,0.45)" }}
              >
                Arsenal
              </span>{" "}
              fans.
            </h1>
            <p className="mt-5 max-w-[468px] text-[18px] leading-[1.55] text-secondary">
              Press play on live fan audio and listen while you watch the match
              your own way. A real supporter in your ear, a chat worth reading,
              and the stats that matter, all in sync with your screen. No
              pundits. No fluff. Just football.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href={heroPrimary.href}
                className="inline-flex items-center gap-2 rounded-[11px] bg-red px-6 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-red-hover"
                style={{ boxShadow: "0 12px 34px -8px rgba(241,35,43,0.6)" }}
              >
                {heroPrimary.label} <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center rounded-[11px] border border-gold/45 px-[22px] py-[15px] text-[15px] font-bold text-gold transition-colors hover:border-gold"
              >
                How it works
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-secondary">
              Free to listen. No account needed to hear the room.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-4 font-mono text-[11px] tracking-[0.06em] text-secondary uppercase">
              <span>Arsenal first</span>
              <span aria-hidden="true" className="text-line">
                /
              </span>
              <span>More clubs coming</span>
              <span aria-hidden="true" className="text-line">
                /
              </span>
              <span className="text-primary/85">Independent &amp; unaffiliated</span>
            </div>
          </div>
          <OnAirCard />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-t border-line">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-gold"
                />
                How it works
              </p>
              <h2 className="display text-4xl leading-[0.95] sm:text-[52px]">
                Three taps to the room
              </h2>
            </div>
            <p className="max-w-[200px] text-right font-mono text-[11px] tracking-[0.05em] text-secondary">
              Jump in and listen along.
              <br />
              Signing up takes under a minute.
            </p>
          </div>
          <div className="mt-9 grid gap-[18px] md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="relative overflow-hidden rounded-2xl border border-line bg-surface px-6 pt-6 pb-7 shadow-card"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-4 right-4 text-gold opacity-55"
                >
                  {s.icon}
                </span>
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-gold font-mono text-sm font-bold text-[#141210]">
                  {s.n}
                </span>
                <h3 className="mt-[54px] text-xl font-extrabold tracking-[-0.01em]">
                  {s.t}
                </h3>
                <p className="mt-2.5 text-sm leading-[1.55] text-secondary">
                  {s.d}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/how-it-works"
              className="text-sm font-bold text-gold hover:underline"
            >
              Read the full guide →
            </Link>
            <Link
              href="/host"
              className="text-sm font-semibold text-secondary hover:text-primary"
            >
              Want to commentate? →
            </Link>
          </div>
        </div>
      </section>

      {/* LIVE + COMING UP */}
      <section className="mx-auto grid max-w-[1180px] items-stretch gap-[18px] px-5 pt-3.5 pb-16 sm:px-10 lg:grid-cols-[1.15fr_1fr]">
        {/* featured */}
        <div className="relative min-h-[300px] overflow-hidden rounded-[18px] border border-red/30 bg-inset">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(rgb(var(--hair) / 0.10) 1px, transparent 1.4px)",
              backgroundSize: "9px 9px",
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 120% at 100% 100%, rgba(241,35,43,0.32), transparent 55%)",
            }}
          />
          <div className="relative flex min-h-[300px] flex-col justify-between p-6">
            <div className="flex items-center justify-between">
              {featured && featuredLive ? (
                <span className="inline-flex items-center gap-[7px] rounded-full bg-red px-[11px] py-1.5 font-mono text-[11px] tracking-[0.12em] text-white uppercase">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-white"
                  />
                  Live now
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-gold uppercase">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-gold"
                  />
                  {featured ? "Next up" : "The room's open"}
                </span>
              )}
              {featured && (
                <span className="font-mono text-[11px] text-secondary uppercase">
                  {featured.card.competition}
                </span>
              )}
            </div>
            <div>
              {featured ? (
                <>
                  <p className="mb-2 font-mono text-[11px] text-secondary">
                    {featuredLive ? (
                      featured.card.state === "waiting" ? (
                        "Show starts soon"
                      ) : (
                        "Live now"
                      )
                    ) : (
                      <KickoffTime iso={featured.card.kickoffUtc} />
                    )}
                    {featured.card.commentator
                      ? ` · hosted by ${featured.card.commentator}`
                      : ""}
                  </p>
                  <h3 className="display mb-5 text-[42px] leading-[0.96]">
                    {featured.card.home} vs {featured.card.away}
                  </h3>
                  <Link
                    href={featuredCtaHref}
                    className="inline-flex items-center gap-2.5 rounded-[10px] bg-inverted px-5 py-3 text-sm font-bold text-inverted-fg transition-opacity hover:opacity-90"
                  >
                    {featuredCtaLabel} <span aria-hidden="true">→</span>
                  </Link>
                </>
              ) : (
                <>
                  <h3 className="display mb-3 text-[34px] leading-[0.96]">
                    No match live
                    <br />
                    right now
                  </h3>
                  <p className="mb-4 max-w-sm text-sm text-secondary">
                    Get an email when the first Arsenal rooms open, and be there
                    for the first whistle.
                  </p>
                  <NotifyForm source="home_empty" className="max-w-sm" />
                  <Link
                    href="/matches"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:text-primary"
                  >
                    Or see the schedule <span aria-hidden="true">→</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* coming up */}
        <div className="flex flex-col rounded-[18px] border border-line bg-surface px-[22px] pt-[22px] pb-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="display text-[22px] tracking-[0.03em]">
              Coming up
            </span>
            <Link
              href="/matches"
              className="font-mono text-[10.5px] tracking-[0.06em] text-gold uppercase hover:underline"
            >
              Full schedule →
            </Link>
          </div>
          {comingUp.length === 0 ? (
            <p className="py-6 text-sm text-secondary">
              Nothing scheduled yet. Check back soon.
            </p>
          ) : (
            comingUp.map((w) => (
              <Link
                key={w.card.id}
                href={w.card.roomHref ?? "/matches"}
                className="flex items-center gap-3.5 border-t border-line px-1 py-[15px] first:border-t-0 hover:opacity-80"
              >
                <span className="w-[62px] shrink-0 font-mono text-[10px] leading-[1.4] tracking-[0.05em] text-secondary uppercase">
                  <KickoffTime iso={w.card.kickoffUtc} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold tracking-[-0.01em]">
                    {w.card.home} vs {w.card.away}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-secondary">
                    {w.card.competition}
                  </span>
                </span>
                <span aria-hidden="true" className="text-lg text-secondary">
                  ›
                </span>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* FEATURES */}
      <section
        className="border-t border-line"
        style={{
          background:
            "radial-gradient(100% 80% at 50% 0%, rgba(241,35,43,0.06), transparent 60%)",
        }}
      >
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-10">
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
            Why you&apos;ll stay
          </p>
          <h2 className="display max-w-[700px] text-4xl leading-[0.95] sm:text-[52px]">
            Built for the 90 minutes, and the bits around them
          </h2>
          <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.n}
                className="bg-canvas px-6 pt-[26px] pb-7 transition-colors hover:bg-surface"
              >
                <p className="mb-3.5 font-mono text-[11px] text-gold">{f.n}</p>
                <h3 className="text-[19px] font-extrabold tracking-[-0.01em]">
                  {f.k}
                </h3>
                <p className="mt-2 text-[13.5px] leading-[1.55] text-secondary">
                  {f.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECOND SCREEN / DIFFERENTIATION */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-10">
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
            Not just a group call
          </p>
          <h2 className="display max-w-[720px] text-4xl leading-[0.95] sm:text-[52px]">
            One second screen. Everything in it.
          </h2>
          <p className="mt-4 max-w-[620px] text-[15px] leading-[1.6] text-secondary">
            A Spaces call is just audio. A watchalong is one shared stream on
            someone else&apos;s delay. The group chat scrolls past you.{" "}
            {brand.name} is all of it in one place, lined up to your screen: the
            audio, the chat, and the stats together.
          </p>
          <div className="mt-9 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {[
              {
                k: "Synced to you",
                d: "Fan audio locks to your own stream's delay with one tap, then nudges half a second either way. A single shared stream can't line up to your screen.",
              },
              {
                k: "Audio, chat and stats in one",
                d: "Live commentary, a chat worth reading, polls, and real match stats share one screen. No juggling a call in one app and a feed in another.",
              },
              {
                k: "Yours to keep",
                d: "Every show is recorded into downloadable segments the host owns outright. A live call just disappears when it ends.",
              },
            ].map((c) => (
              <div
                key={c.k}
                className="bg-canvas px-6 pt-[26px] pb-7 transition-colors hover:bg-surface"
              >
                <h3 className="text-[19px] font-extrabold tracking-[-0.01em]">
                  {c.k}
                </h3>
                <p className="mt-2 text-[13.5px] leading-[1.55] text-secondary">
                  {c.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ — the objections that block signup, answered at the decision point */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[760px] px-5 py-16 sm:px-10">
          <p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
            Good to know
          </p>
          <h2 className="display text-4xl leading-[0.95] sm:text-[46px]">
            The quick questions
          </h2>
          <Faq items={HOME_FAQ} />
          <p className="mt-5 text-sm text-secondary">
            More in the{" "}
            <Link href="/about" className="font-semibold text-gold hover:underline">
              full FAQ
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section
        className="relative overflow-hidden border-t border-line"
        style={{
          background:
            "radial-gradient(90% 130% at 50% 120%, rgba(241,35,43,0.3), transparent 60%), var(--bg-base)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--hair) / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--hair) / 0.04) 1px, transparent 1px)",
            backgroundSize: "54px 54px",
            maskImage:
              "radial-gradient(80% 80% at 50% 100%, black, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(80% 80% at 50% 100%, black, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-[1180px] px-5 py-20 text-center sm:px-10">
          <h2 className="display mx-auto text-5xl leading-[0.92] sm:text-[68px]">
            The room&apos;s open.
            <br />
            Come in.
          </h2>
          <p className="mx-auto mt-[18px] max-w-[480px] text-[17px] text-secondary">
            Get in the room and listen along. Signing up takes under a minute
            when you want to join in.
          </p>
          <div className="mt-7 flex justify-center">
            <Link
              href="/matches"
              className="inline-flex items-center gap-2.5 rounded-xl bg-red px-[30px] py-[17px] text-base font-bold text-white transition-colors hover:bg-red-hover"
              style={{ boxShadow: "0 16px 40px -10px rgba(241,35,43,0.7)" }}
            >
              Find your next room <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="mt-6 font-mono text-[11px] tracking-[0.05em] text-secondary uppercase">
            Arsenal first · More clubs to come ·{" "}
            <Link href="/host" className="text-gold hover:underline">
              Fancy hosting a room?
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
