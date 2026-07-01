import Link from "next/link";
import { brand } from "@/lib/brand";
import { loadFixtures } from "@/lib/db/fixtures";
import { KickoffTime } from "@/components/KickoffTime";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { OnAirCard } from "@/components/marketing/OnAirCard";

/**
 * Home (Cloud Design "1a"): hero + bobbing ON AIR card → how it works → live +
 * coming-up teaser (real fixtures) → features → final CTA. Compliance: "watch"
 * only ever = the viewer's own stream; the disclaimer rides the shared footer.
 */

export const revalidate = 60;

const STEPS = [
  {
    n: "01",
    t: "Bring your own stream",
    d: "Watch the match the way you always do — your telly, your app, your subscription. FanCast doesn't show the game; it rides alongside it.",
  },
  {
    n: "02",
    t: "Press play and sync",
    d: "Tune in to a fan on the mic, then line the audio up to your screen — one tap when your telly hits the moment, and you're locked in.",
  },
  {
    n: "03",
    t: "Pull up a seat",
    d: "Listen free, no account needed. Sign up in under a minute to chat, vote, ask the commentator, or call in.",
  },
];

const FEATURES = [
  {
    n: "01",
    k: "A fan, not a pundit",
    d: "A Gooner on the mic who lives and dies with every result — on your side, never neutral.",
  },
  {
    n: "02",
    k: "Synced to your screen",
    d: "One tap lines the audio up to your feed, with half-second nudges and a jump back to live.",
  },
  {
    n: "03",
    k: "A chat worth reading",
    d: "Threaded replies, upvotes, and New / Top / Controversial sorting — good takes rise, noise sinks.",
  },
  {
    n: "04",
    k: "The stats that matter",
    d: "Possession, shots, xG, momentum, lineups and team news, live from kickoff.",
  },
  {
    n: "05",
    k: "Ask, vote, call in",
    d: "Question the commentator, settle the half-time poll, rate the players — or request the mic and go on air.",
  },
  {
    n: "06",
    k: "Yours to keep",
    d: "Every show is recorded into downloadable segments. The host owns it outright; we claim nothing.",
  },
];

export default async function HomePage() {
  const { live, upcoming } = await loadFixtures();
  const featured = live[0] ?? upcoming[0] ?? null;
  const featuredLive = featured ? featured.card.state !== "scheduled" : false;
  const comingUp = upcoming.slice(0, 4);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-32 right-[-12%] h-[520px] w-[520px] rounded-full opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(241,35,43,0.22), transparent 68%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgb(var(--hair)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--hair)) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage:
                "radial-gradient(ellipse 80% 60% at 50% 30%, black, transparent)",
            }}
          />
        </div>
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-12 px-5 py-16 sm:px-10 lg:grid-cols-[1.04fr_.96fr] lg:py-24">
          <div>
            <Eyebrow dot="live">Live fan commentary · Arsenal</Eyebrow>
            <h1 className="mt-5 font-display text-5xl leading-[0.98] sm:text-6xl">
              Turn the pundits off.{" "}
              <span
                className="text-red"
                style={{ textShadow: "0 0 32px rgba(241,35,43,0.5)" }}
              >
                Tune in to real Arsenal fans.
              </span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-secondary">
              Keep watching the match however you already do. {brand.name} rides
              alongside it — live fan audio, a proper away-end chat, and the stats
              that matter. No pundits. No fluff. Just football.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button href="/matches">See what&apos;s live →</Button>
              <Button href="#how" variant="outline">
                How it works
              </Button>
            </div>
            <p className="mt-7 font-mono text-[11px] tracking-wider text-secondary uppercase">
              Live every match · Fan-hosted · Bring your own stream
            </p>
          </div>
          <OnAirCard />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="mx-auto max-w-[1180px] px-5 py-16 sm:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 font-display text-4xl sm:text-5xl">
              Three taps to the room
            </h2>
          </div>
          <p className="max-w-[220px] font-mono text-[11px] tracking-wide text-secondary uppercase">
            You bring the match. We bring the room.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-line bg-surface p-6"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gold/15 font-mono text-sm font-bold text-gold">
                {s.n}
              </span>
              <h3 className="mt-4 font-display text-xl">{s.t}</h3>
              <p className="mt-2 text-sm text-secondary">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE + COMING UP */}
      <section className="mx-auto grid max-w-[1180px] gap-4 px-5 py-8 sm:px-10 lg:grid-cols-[1.15fr_1fr]">
        {featured ? (
          <div
            className="relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-2xl border border-red/30 bg-inset p-6"
            style={{
              backgroundImage:
                "radial-gradient(rgb(var(--hair) / 0.06) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
            }}
          >
            <div className="flex items-center gap-3">
              {featuredLive ? (
                <Pill variant="red" live>
                  Live now
                </Pill>
              ) : (
                <Eyebrow dot="gold">Next up</Eyebrow>
              )}
              <span className="font-mono text-[10px] tracking-wider text-secondary uppercase">
                {featured.card.competition}
              </span>
            </div>
            <div>
              <p className="font-mono text-[11px] text-secondary">
                {featuredLive ? (
                  featured.card.state === "waiting" ? (
                    "Show starts soon"
                  ) : (
                    "Live"
                  )
                ) : (
                  <KickoffTime iso={featured.card.kickoffUtc} />
                )}
                {featured.card.commentator
                  ? ` · hosted by ${featured.card.commentator}`
                  : ""}
              </p>
              <h3 className="mt-1 font-display text-4xl">
                {featured.card.home} vs {featured.card.away}
              </h3>
              {featuredLive && featured.card.roomHref && (
                <div className="mt-5">
                  <Button href={featured.card.roomHref} variant="inverted">
                    {featured.card.state === "live"
                      ? "Join live"
                      : "Join the waiting room"}{" "}
                    →
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-line bg-surface p-6 text-center text-sm text-secondary">
            No matches on the schedule yet — we&apos;ll be here when the next one
            kicks off.
          </div>
        )}

        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl">Coming up</h3>
            <Link
              href="/matches"
              className="font-mono text-[10.5px] font-bold tracking-wider text-gold uppercase hover:underline"
            >
              Full schedule →
            </Link>
          </div>
          <div className="mt-2">
            {comingUp.length === 0 ? (
              <p className="py-6 text-sm text-secondary">Nothing scheduled yet.</p>
            ) : (
              comingUp.map((w) => (
                <Link
                  key={w.card.id}
                  href={w.card.roomHref ?? "/matches"}
                  className="flex items-center gap-4 border-t border-line py-4 first:border-t-0 hover:opacity-80"
                >
                  <span className="w-16 shrink-0 font-mono text-[10px] tracking-wide text-secondary uppercase">
                    <KickoffTime iso={w.card.kickoffUtc} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {w.card.home} vs {w.card.away}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-secondary uppercase">
                      {w.card.competition}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-secondary">
                    ›
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-[1180px] px-5 py-16 sm:px-10">
        <Eyebrow>Why you&apos;ll stay</Eyebrow>
        <h2 className="mt-3 max-w-2xl font-display text-4xl sm:text-5xl">
          Built for the 90 minutes, and the bits around them
        </h2>
        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.n}
              className="bg-canvas p-6 transition-colors hover:bg-surface"
            >
              <span className="font-mono text-[11px] font-bold text-gold">
                {f.n}
              </span>
              <h3 className="mt-2 font-display text-lg">{f.k}</h3>
              <p className="mt-2 text-sm text-secondary">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--hair)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--hair)) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent)",
          }}
        />
        <div className="relative mx-auto max-w-[1180px] px-5 py-20 text-center sm:px-10">
          <h2 className="mx-auto max-w-2xl font-display text-5xl sm:text-6xl">
            The room&apos;s open. Come in.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-secondary">
            Free to listen, no account needed. Sign up when you want to talk — it
            takes under a minute.
          </p>
          <div className="mt-7 flex justify-center">
            <Button href="/matches">See what&apos;s live →</Button>
          </div>
          <p className="mt-7 font-mono text-[11px] tracking-wider text-secondary uppercase">
            Arsenal first · More clubs to come · Fancy hosting a room?
          </p>
        </div>
      </section>
    </>
  );
}
