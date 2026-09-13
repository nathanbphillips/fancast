import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { loadFixtures, type HomeFixture } from "@/lib/db/fixtures";
import { KickoffTime, LocalTime } from "@/components/KickoffTime";
import { NotifyForm } from "@/components/marketing/NotifyForm";
import { Countdown } from "@/components/marketing/Countdown";
import { MastheadStrip } from "@/components/marketing/MastheadStrip";
import { TheWire } from "@/components/marketing/TheWire";

/**
 * The front page (Programme redesign, founder 2026-09-13: the mock's layout
 * and content, not a restyle of the old marketing home). Masthead strip ->
 * cover (wordmark, tagline, issue index) -> the hero slot (State A: a red ON
 * AIR block linking into the live room; State B: the ink next-broadcast block
 * with a gold countdown) -> two columns: THE WEEK'S FIXTURES (real fixtures,
 * real rooms) and FROM THE WIRE (the real Bluesky feed). Every number is real
 * or omitted; listener counts are host-only and never shown here. Compliance:
 * we never show the match; "watch" only ever means the reader's own stream.
 */

export const revalidate = 60;

export const metadata: Metadata = {
  description:
    "The matchday programme for Arsenal fans. Real supporters in your ear, never pundits, in sync with your own stream. Free to listen, no account needed.",
  alternates: { canonical: "/" },
};

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });
}

function FixtureRow({ f }: { f: HomeFixture }) {
  const card = f.card;
  const hasRoom = !!card.roomHref;
  return (
    <div className="grid grid-cols-[74px_1fr] items-start gap-x-4 gap-y-2 border-b border-line py-4">
      <div className="display text-[25px] leading-[1.1]">
        <LocalTime iso={card.kickoffUtc} />
      </div>
      <div>
        <div className="display text-[clamp(20px,2.2vw,26px)] leading-none">
          {card.home} <span className="text-red">v</span> {card.away}
        </div>
        <div className="mt-1.5 text-[14.5px] text-secondary italic">
          {card.competition}
          {hasRoom
            ? ` - room scheduled${card.commentator ? ` with @${card.commentator}` : ""}`
            : " - no room yet"}
        </div>
        {hasRoom && (
          <Link
            href={card.roomHref!}
            className="mt-2.5 inline-block border border-primary px-4 py-2 font-mono text-[13px] font-semibold tracking-[0.1em] text-primary transition-colors hover:text-red"
          >
            {card.state === "scheduled" ? "Count me in →" : "Join the room →"}
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const { live, upcoming } = await loadFixtures();
  const liveFixture = live[0] ?? null;
  // State B features the next BROADCAST (a fixture with a scheduled room and
  // a future kickoff); with no room anywhere, the next future fixture stands
  // in, honestly labelled. In-play fixtures without a live room never lead.
  const now = Date.now();
  const future = upcoming.filter(
    (f) => new Date(f.card.kickoffUtc).getTime() > now,
  );
  const nextBroadcast = future.find((f) => f.card.roomHref) ?? null;
  const nextFixture = nextBroadcast ?? future[0] ?? null;
  // the featured fixture leaves the column so hero and list never duplicate
  const listFixtures = upcoming.filter(
    (f) => f.card.id !== (liveFixture ? -1 : (nextFixture?.card.id ?? -1)),
  );

  // day dividers: label the first fixture of each London day
  let lastDay = "";

  return (
    <div className="mx-auto max-w-[1260px] px-5 pt-6 pb-14 sm:px-10">
      <MastheadStrip />

      {/* COVER */}
      <div className="border-b border-primary py-7 text-center">
        <div className="display text-[clamp(64px,10vw,108px)] leading-[0.9] tracking-[0.01em]">
          <span className="text-red">{brand.logoParts.accent}</span>
          <span className="text-primary">{brand.logoParts.base}</span>
        </div>
        <p className="mt-3.5 text-[19px] text-secondary italic">
          The matchday programme - real supporters in your ear, never pundits.
        </p>
      </div>

      {/* HERO SLOT */}
      {liveFixture ? (
        /* State A: on air - the whole block walks into the room */
        <Link
          href={liveFixture.card.roomHref ?? "/matches"}
          className="mt-6 block bg-red-fill p-7 text-on-red transition-opacity hover:opacity-95 sm:px-9"
        >
          <div className="flex flex-wrap justify-between gap-3.5 font-mono text-[13px] tracking-[0.16em]">
            <span className="flex items-center gap-2.5">
              <span className="h-[9px] w-[9px] animate-fcpulse rounded-full bg-on-red" />
              On air now - live from the gantry
            </span>
            {liveFixture.card.commentator && (
              <span className="whitespace-nowrap">
                @{liveFixture.card.commentator} commentating
              </span>
            )}
          </div>
          <div className="mt-3.5 flex flex-wrap items-end justify-between gap-4">
            <div className="display text-[clamp(38px,5.5vw,62px)] leading-[0.95]">
              {liveFixture.card.home} <span className="opacity-70">v</span>{" "}
              {liveFixture.card.away}
            </div>
            <span className="border-2 border-on-red px-6 py-3 font-mono text-[15px] tracking-[0.14em] whitespace-nowrap">
              Listen in →
            </span>
          </div>
          <p className="mt-2.5 text-[16px] italic opacity-85">
            {liveFixture.card.competition} · free to listen, no account needed
          </p>
        </Link>
      ) : nextFixture ? (
        /* State B: the red next-broadcast block (founder 2026-09-13) */
        <div className="mt-6 bg-red-fill p-7 text-on-red sm:px-9">
          <div className="flex flex-wrap justify-between gap-3.5 font-mono text-[13px] tracking-[0.16em]">
            <span>
              {nextBroadcast ? "Next broadcast" : "Next fixture"} -{" "}
              <KickoffTime iso={nextFixture.card.kickoffUtc} />
            </span>
            <span className="font-mono text-gold-bright tabular-nums whitespace-nowrap">
              Kicks off in <Countdown iso={nextFixture.card.kickoffUtc} />
            </span>
          </div>
          <div className="mt-3.5 flex flex-wrap items-end justify-between gap-4">
            <div className="display text-[clamp(34px,5vw,56px)] leading-[0.95]">
              {nextFixture.card.home} <span className="text-gold-bright">v</span>{" "}
              {nextFixture.card.away}
            </div>
            <Link
              href={nextFixture.card.roomHref ?? "/matches"}
              className="border-2 border-on-red px-6 py-3 font-mono text-[15px] font-semibold tracking-[0.12em] whitespace-nowrap transition-opacity hover:opacity-85"
            >
              {nextFixture.card.roomHref ? "Count me in →" : "See the schedule →"}
            </Link>
          </div>
          <p className="mt-2.5 text-[16px] italic opacity-80">
            {nextFixture.card.competition}
            {nextFixture.card.roomHref
              ? nextFixture.card.commentator
                ? ` · room scheduled with @${nextFixture.card.commentator}`
                : " · room scheduled"
              : " · no room scheduled yet"}
          </p>
        </div>
      ) : (
        /* no fixtures in the window: an honest quiet cover */
        <div className="mt-6 bg-inverted p-7 text-inverted-fg sm:px-9">
          <div className="font-mono text-[13px] tracking-[0.16em]">
            Between fixtures
          </div>
          <div className="display mt-3 text-[clamp(30px,4.5vw,48px)] leading-[0.95]">
            The next issue is at the printers.
          </div>
          <p className="mt-2.5 max-w-[560px] text-[16px] italic opacity-80">
            Get an email the moment the next rooms open, and be there for the
            first whistle.
          </p>
          <div className="mt-4 max-w-md">
            <NotifyForm source="home_empty" />
          </div>
        </div>
      )}

      {/* TWO COLUMNS: fixtures | the wire */}
      <div className="mt-9 grid items-start gap-y-10 md:grid-cols-2 md:gap-0">
        <div className="md:border-r md:border-line md:pr-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2.5 border-b-[3px] border-double border-primary pb-2.5">
            <span className="display text-[26px]">The week&apos;s fixtures</span>
            <Link
              href="/matches"
              className="border-b border-red font-mono text-[13px] tracking-[0.08em] whitespace-nowrap text-primary hover:text-red"
            >
              Full schedule →
            </Link>
          </div>
          {listFixtures.length > 0 ? (
            listFixtures.map((f) => {
              const day = dayLabel(f.card.kickoffUtc);
              const showDay = day !== lastDay;
              lastDay = day;
              return (
                <div key={f.card.id}>
                  {showDay && (
                    <p className="mt-5 font-mono text-[13px] tracking-[0.14em] text-red">
                      - {day} -
                    </p>
                  )}
                  <FixtureRow f={f} />
                </div>
              );
            })
          ) : (
            <div className="mt-5">
              <p className="text-[15px] leading-[1.6] text-secondary italic">
                No upcoming fixtures on the books yet. The schedule fills in as
                soon as the next round is confirmed.
              </p>
              <div className="mt-4 max-w-sm">
                <NotifyForm source="home_fixtures_empty" />
              </div>
            </div>
          )}
        </div>

        <div className="md:pl-7">
          <TheWire />
        </div>
      </div>
    </div>
  );
}
