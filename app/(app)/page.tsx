import Link from "next/link";
import { brand } from "@/lib/brand";
import { loadFixtures } from "@/lib/db/fixtures";
import { FixtureCard } from "@/components/FixtureCard";
import { OpenWaitingButton } from "@/components/OpenWaitingButton";
import { Section } from "@/components/marketing/Section";
import { StepCard } from "@/components/marketing/StepCard";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { CtaBand } from "@/components/marketing/CtaBand";
import { PrimaryCta, SecondaryCta } from "@/components/marketing/CtaButtons";
import { HeroArt } from "@/components/marketing/HeroArt";

/**
 * Home: a hybrid marketing landing — hero → how it works → a live + next-4
 * fixtures teaser → features → closing CTA. The full schedule lives at
 * /matches. Compliance: copy never implies we stream/show the match; "watch"
 * always attaches to the viewer's own stream (golden rule), and the unaffiliated
 * disclaimer rides in the shared footer.
 */

export const revalidate = 60;

export default async function HomePage() {
  const { live, upcoming } = await loadFixtures();

  return (
    <>
      {/* HERO */}
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-6 sm:pt-16">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="mb-3 flex items-center gap-2 font-display text-xs font-bold tracking-wider text-secondary uppercase">
              <span className="text-gold" aria-hidden="true">
                ●
              </span>
              Live fan commentary · Arsenal
            </p>
            <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
              A real Gooner in your ear, all match long.
            </h1>
            <p className="mt-4 max-w-xl text-secondary sm:text-lg">
              Keep watching the match however you already do. {brand.name} rides
              alongside it — live fan audio, a proper away-end chat, and the stats
              that matter. No pundits. No fluff. Just football.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryCta href="/matches">See what&apos;s live</PrimaryCta>
              <SecondaryCta href="#how">How it works</SecondaryCta>
            </div>
          </div>
          <div>
            <HeroArt className="mx-auto max-w-md lg:max-w-none" />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <Section id="how" label="How it works" heading="Three taps to the room">
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <StepCard n={1} title="Bring your own stream">
            Watch the match the way you always do — your telly, your app, your
            subscription. {brand.name} doesn&apos;t show the game; it sits beside
            it.
          </StepCard>
          <StepCard n={2} title="Press play and sync">
            Tap in for live fan commentary, then line it up to your screen — when
            your TV hits a moment, tap Now and the audio locks to your feed.
          </StepCard>
          <StepCard n={3} title="Pull up a seat">
            Listen and read along with no account. Sign up in under a minute when
            you want to chat, vote, ask the commentator, or call in.
          </StepCard>
        </div>
      </Section>

      {/* SCHEDULE TEASER */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        {live.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 font-display text-xs font-bold tracking-wider text-secondary uppercase">
              <span
                className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-red"
                aria-hidden="true"
              />
              Live now
            </h2>
            <div className="space-y-3">
              {live.map((w) => (
                <FixtureCard key={w.card.id} fixture={w.card} />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-xs font-bold tracking-wider text-secondary uppercase">
            <span aria-hidden="true">🏆</span>
            Coming up
          </h2>
          <Link
            href="/matches"
            className="text-sm font-semibold text-gold hover:underline"
          >
            View full schedule →
          </Link>
        </div>
        <div className="mt-3 space-y-3">
          {upcoming.length === 0 ? (
            <p className="rounded-xl border-[0.75px] border-line bg-surface p-4 text-sm text-secondary shadow-card">
              No matches on the schedule yet — we&apos;ll be here when the next
              one kicks off.
            </p>
          ) : (
            upcoming.slice(0, 4).map((w) => (
              <FixtureCard
                key={w.card.id}
                fixture={w.card}
                action={
                  w.canOpen ? (
                    <OpenWaitingButton fixtureId={w.card.id} />
                  ) : undefined
                }
              />
            ))
          )}
        </div>
      </section>

      {/* FEATURES */}
      <Section
        label="Why you'll stay"
        heading="Built for the 90 minutes, and the bits around them"
      >
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard title="A fan, not a pundit">
            A Gooner who lives and dies with every result — on your side, never
            neutral.
          </FeatureCard>
          <FeatureCard title="Synced to your screen">
            One tap lines the audio up to your feed, with half-second nudges and a
            jump back to live.
          </FeatureCard>
          <FeatureCard title="A chat worth reading">
            Threaded replies, upvotes, and sort by New, Top or Controversial —
            good takes rise, noise sinks.
          </FeatureCard>
          <FeatureCard title="The stats that matter">
            Possession, shots, xG, momentum, lineups and team news, live from
            kickoff.
          </FeatureCard>
          <FeatureCard title="Ask, vote, call in">
            Question the commentator, settle the half-time poll, rate the players —
            or request the mic and go on air.
          </FeatureCard>
          <FeatureCard title="Yours to keep">
            Every show is recorded into downloadable segments. The commentator owns
            it; we claim nothing.
          </FeatureCard>
        </div>
      </Section>

      {/* CLOSING CTA */}
      <CtaBand
        heading="The room's open. Come in."
        line="Free to listen, no account needed. Sign up when you want to talk — it takes under a minute."
        cta={<PrimaryCta href="/matches">See what&apos;s live</PrimaryCta>}
        note="Arsenal first. More clubs to come — and if you fancy hosting a room, there'll be room for you too."
      />
    </>
  );
}
