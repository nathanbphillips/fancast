import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { Section } from "@/components/marketing/Section";
import { StepCard } from "@/components/marketing/StepCard";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { Faq } from "@/components/marketing/Faq";
import { CtaBand } from "@/components/marketing/CtaBand";
import { PrimaryCta, SecondaryCta } from "@/components/marketing/CtaButtons";

/**
 * About: the marketing deep-dive. Compliance — every line keeps "watch"
 * attached to the viewer's own stream, never to the platform; the platform only
 * ever "listens alongside". Explicit "we don't show the match" + an FAQ answer
 * are kept prominent; the unaffiliated disclaimer rides in the shared footer.
 */

export const metadata: Metadata = {
  title: "About",
  description: `What ${brand.name} is, how a matchday works, and why it's the matchday company you've been missing.`,
};

const FAQ = [
  {
    q: "Do you stream the match?",
    a: `No — and we never will. ${brand.name} doesn't show match video or play broadcast audio. You watch the game however you already legally do, and we ride alongside with fan commentary, chat and stats.`,
  },
  {
    q: "Is this official Arsenal?",
    a: `No. ${brand.name} is an unofficial, fan-made platform and isn't affiliated with or endorsed by Arsenal, the Premier League, or any broadcaster. The commentators are fans, not official club analysts.`,
  },
  {
    q: "Do I need to pay or sign up?",
    a: "No. Anyone can listen and read the chat and stats without an account. You only sign up — under a minute — when you want to chat, vote, ask a question or call in.",
  },
  {
    q: "How does the sync work?",
    a: "A reference match-clock ticks on screen. When your own feed shows that exact moment, you tap Now and the commentary lines up to your screen. Half-second steppers fine-tune it, and you can jump back to live whenever.",
  },
  {
    q: "Does it work on my iPhone?",
    a: `Yes. ${brand.name} runs in the browser including iOS Safari, installs to your home screen, and keeps playing audio on the lock screen like a radio.`,
  },
  {
    q: "Can I talk on air?",
    a: "Yes, if you want to. You can request the mic, and with the commentator's consent you go live to the room. It's recorded as part of the show — and if you'd rather just listen, you never have to.",
  },
  {
    q: "What about the recordings?",
    a: `Each broadcast is saved as downloadable segments. They belong to the commentator completely; ${brand.name} claims no rights and asks for nothing.`,
  },
  {
    q: "Is it only Arsenal?",
    a: "For now, yes — we're starting with Arsenal and doing it properly. More clubs will follow.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* INTRO */}
      <Section
        label="About FanCast"
        heading="The matchday company you've been missing"
        sub={
          <>
            Watching Arsenal alone is quiet. Watching in a group chat is chaos.{" "}
            {brand.name} is the bit in between: a live room where a fellow Gooner
            calls the game in your ear while everyone argues, celebrates and
            suffers together — all riding alongside the match you&apos;re already
            watching.
          </>
        }
      />

      {/* WHY */}
      <Section label="Why we built it" heading="Football's better with people">
        <div className="mt-4 max-w-2xl space-y-4 text-secondary">
          <p>
            But the people aren&apos;t always in the room. Mates are scattered,
            the group chat lags two minutes behind the action, and the official
            feeds are polished, neutral and a little bit lifeless.
          </p>
          <p>
            We wanted the feeling of the pub on a big match day: someone who knows
            the team calling it like they mean it, a crowd reacting in real time,
            and nobody pretending to be impartial. As our community guidelines put
            it — the pub for fans who don&apos;t have one.
          </p>
        </div>
      </Section>

      {/* HOW A MATCHDAY WORKS */}
      <Section
        label="How a matchday works"
        heading="You bring the match. We bring the room."
      >
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <StepCard n={1} title="You watch your way">
            {brand.name} never shows the game. You keep watching however you
            legally already do — your TV, your app, your subscription — and we
            ride alongside with audio, chat and stats.
          </StepCard>
          <StepCard n={2} title="You sync once">
            Streams run at different delays, so we make it easy to line things up:
            a big match-clock ticks, and when your feed shows that exact moment you
            tap Now. Half-second steppers fine-tune it; one tap jumps you to the
            live edge.
          </StepCard>
          <StepCard n={3} title="You settle in">
            Listen and read with no account at all. When you want to join in,
            signing up takes under a minute — then you&apos;re chatting, voting and
            asking questions.
          </StepCard>
          <StepCard n={4} title="It follows the match">
            The room reads team news, venue, referee and weather before kickoff,
            then switches itself to live stats the moment the whistle goes.
          </StepCard>
        </div>
      </Section>

      {/* WHAT'S IN THE ROOM */}
      <Section
        label="What's in the room"
        heading="Everything the matchday needs, in one place"
      >
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <FeatureCard title="Live fan commentary">
            A real supporter on the mic, broadcasting live with barely any delay —
            not a neutral analyst, someone who wants the same result you do. Nudge
            them between flat-out commentary and back-and-forth discussion with a
            simple slider.
          </FeatureCard>
          <FeatureCard title="A chat that's actually good">
            Reddit-style threaded replies, upvotes, and New / Top / Controversial
            sorting keep the best takes visible and the pile-ons buried. Shared
            links open as tidy inline cards instead of bare URLs.
          </FeatureCard>
          <FeatureCard title="Stats beside the action">
            Possession, shots, xG, momentum, lineups, key events and pre-game team
            news sit right next to the conversation, and the panel flips to live
            data automatically at kickoff.
          </FeatureCard>
          <FeatureCard title="Get involved">
            Ask the commentator a question privately, vote in the half-time poll,
            predict the score, rate the players at full time — or request the mic
            and, with the commentator&apos;s say-so, go on air to the whole room.
          </FeatureCard>
          <FeatureCard title="Take it with you">
            Every broadcast is recorded into clean segments — pre-game, each half,
            half-time, post-game — that you can download. These recordings belong
            to the commentator, full stop; {brand.name} claims no rights to them.
          </FeatureCard>
          <FeatureCard title="Radio mode">
            It runs in your browser, including iPhone, installs to your home screen,
            and keeps playing on the lock screen — so you can pocket your phone and
            just listen.
          </FeatureCard>
        </div>
      </Section>

      {/* HOST A ROOM */}
      <Section label="For commentators" heading="Fancy hosting a room?">
        <p className="mt-4 max-w-2xl text-secondary">
          Every match needs a voice. If you&apos;re the one your mates message at
          full time, there&apos;ll be a way to host your own room and bring the
          noise — with a way for listeners to tip you for it if they want to.
          We&apos;re starting small and Arsenal-first; if that&apos;s you, keep an
          eye out.
        </p>
      </Section>

      {/* FAN-FIRST PROMISE */}
      <Section label="Our promise" heading="Fan-first, on purpose">
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <FeatureCard title="We don't show the match">
            {brand.name} is audio, chat and stats only — never the broadcast. You
            bring your own lawful way of watching; we just keep you company.
          </FeatureCard>
          <FeatureCard title="We're unofficial, and proud of it">
            A fan-made platform, not affiliated with or endorsed by any club,
            league or broadcaster. Your commentator is a fan, not an official
            analyst.
          </FeatureCard>
          <FeatureCard title="Your recordings are yours">
            Commentators own their broadcasts outright. The platform takes no cut
            of the rights and no exclusivity.
          </FeatureCard>
          <FeatureCard title="You can just listen">
            No account, no paywall, no pressure. Sign up only if and when you want
            to join in.
          </FeatureCard>
        </div>
      </Section>

      {/* FAQ */}
      <Section label="Questions, answered" heading="The bits people ask">
        <Faq items={FAQ} />
      </Section>

      {/* CLOSING CTA */}
      <CtaBand
        heading="See you in the room"
        line="There's a match coming. Come watch it with people who care as much as you do."
        cta={
          <>
            <PrimaryCta href="/matches">See what&apos;s live</PrimaryCta>
            <SecondaryCta href="/">Back to home</SecondaryCta>
          </>
        }
      />
    </>
  );
}
