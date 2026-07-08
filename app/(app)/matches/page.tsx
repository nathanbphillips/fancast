import type { Metadata } from "next";
import Link from "next/link";
import { loadMatchesSchedule, type ScheduleFixture, type ScheduleRoom } from "@/lib/db/matches";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { Avatar } from "@/components/Avatar";
import { Waveform } from "@/components/ui/Waveform";
import { Countdown } from "@/components/marketing/Countdown";
import { ScheduleBoard } from "@/components/matches/ScheduleBoard";
import { RsvpButton } from "@/components/matches/RsvpButton";
import { NotifyForm } from "@/components/marketing/NotifyForm";

/**
 * Matches (Matchday design): header + filter pills, a featured hero (the live
 * room if one is on, else the soonest scheduled room, real data only), an
 * "Up next · Arsenal" strip, the full date-grouped schedule as flat rows, and
 * the Notify + Host bands. Hybrid honesty: real fixtures/rooms/RSVP state;
 * NO fabricated listening/going counts or live scores. A DB failure throws to
 * the (app) error boundary. Viewer-specific (RSVP), so dynamic per request.
 */

export const metadata: Metadata = { title: "Matches" };

const hostsOf = (r: ScheduleRoom) =>
  r.hostUsernames.length > 0 ? r.hostUsernames : [r.hostUsername];

export default async function MatchesPage() {
  const [groups, { user }] = await Promise.all([
    loadMatchesSchedule(),
    getCurrentUserAndProfile(),
  ]);
  const signedIn = !!user;

  // flatten with date labels for the hero + up-next picks
  const flat = groups.flatMap((g) =>
    g.fixtures.map((f) => ({ f, dateLabel: g.label })),
  );

  // hero: first live room, else the soonest scheduled room (real data only)
  let hero: { f: ScheduleFixture; dateLabel: string; room: ScheduleRoom; live: boolean } | null =
    null;
  for (const { f, dateLabel } of flat) {
    const lr = f.rooms.find((r) => r.state !== "scheduled");
    if (lr) {
      hero = { f, dateLabel, room: lr, live: true };
      break;
    }
  }
  if (!hero) {
    for (const { f, dateLabel } of flat) {
      const sr = f.rooms.find((r) => r.state === "scheduled");
      if (sr) {
        hero = { f, dateLabel, room: sr, live: false };
        break;
      }
    }
  }

  // up next · Arsenal: Arsenal fixtures with a scheduled room, excluding the hero
  const upNext = flat
    .filter(
      ({ f }) =>
        (f.home === "Arsenal" || f.away === "Arsenal") &&
        f.rooms.some((r) => r.state === "scheduled") &&
        f.id !== hero?.f.id,
    )
    .slice(0, 2)
    .map(({ f, dateLabel }) => ({
      f,
      dateLabel,
      room: f.rooms.find((r) => r.state === "scheduled")!,
    }));

  return (
    <>
      {/* HEADER */}
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(110% 100% at 85% -20%, rgba(239,1,7,0.14), transparent 56%), var(--bg-base)",
        }}
      >
        <div className="relative mx-auto max-w-[1120px] px-5 pt-14 pb-8 sm:px-10">
          <p className="mb-3 font-mono text-[12px] tracking-[0.06em] text-red">
            FULL SCHEDULE · ARSENAL
          </p>
          <h1 className="display t-hero">What&apos;s on</h1>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.5] text-secondary">
            Every Arsenal fixture with a room, plus the whole league board. Join
            the live show when the host opens the doors. Free to listen, no
            account needed.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-10">
        {/* FEATURED HERO */}
        {hero && (
          <div className="mb-9">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red">
                <span
                  className={`h-2 w-2 rounded-full bg-red ${hero.live ? "animate-fcpulse" : "animate-fc-blink"}`}
                />
                {hero.live ? "LIVE NOW" : "NEXT UP"}
              </span>
              <span className="font-mono text-[12px] text-tertiary">
                {hero.live ? "doors are up" : hero.dateLabel}
              </span>
            </div>
            <Link
              href={`/room/${hero.room.slug}`}
              className="relative block overflow-hidden rounded-[20px] border p-7 transition-transform hover:-translate-y-[3px]"
              style={{
                background:
                  "linear-gradient(120deg, rgba(239,1,7,.18), transparent 55%), var(--bg-surface)",
                borderColor: "rgba(239,1,7,.32)",
                boxShadow: "0 30px 60px -40px rgba(239,1,7,.5)",
              }}
            >
              <div className="relative z-[2] grid items-center gap-7 lg:grid-cols-[1.05fr_1fr]">
                <div>
                  <div className="mb-3 font-mono text-[11px] tracking-[0.06em] text-red">
                    {hero.f.competition ?? "Premier League"}
                  </div>
                  <div className="display text-[34px] leading-[1.02]">
                    {hero.f.home} <span className="text-secondary">v</span>{" "}
                    {hero.f.away}
                  </div>
                  <div className="mt-3.5 mb-5 flex items-center gap-2.5">
                    <Avatar src={null} name={hostsOf(hero.room)[0]} size={32} />
                    <div className="text-[12.5px] text-secondary">
                      {hero.room.blurb ? (
                        <span className="text-primary">{hero.room.blurb}</span>
                      ) : (
                        <span>
                          Hosted by{" "}
                          {hostsOf(hero.room).map((h, i) => (
                            <span key={h}>
                              {i > 0 && " · "}@{h}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  {hero.live ? (
                    <span className="btn-grad-red inline-flex items-center gap-2 rounded-[11px] px-[22px] py-3 text-[14px] font-semibold text-white">
                      <span className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-white" />
                      Join the room →
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-4">
                      <span className="btn-grad-red inline-flex items-center gap-2 rounded-[11px] px-[22px] py-3 text-[14px] font-semibold text-white">
                        Join the waiting room →
                      </span>
                      <span className="font-mono text-[12px] text-tertiary tabular-nums">
                        <Countdown iso={hero.f.kickoffUtc} /> to kickoff
                      </span>
                    </span>
                  )}
                </div>
                {/* decorative mini preview — no fabricated data */}
                <div className="hidden rounded-2xl border border-line bg-canvas p-4 lg:block">
                  <div className="mb-3 inline-flex items-center gap-1.5 font-mono text-[10px] text-red">
                    <span className="h-1.5 w-1.5 animate-fc-blink rounded-full bg-red" />
                    IN THE ROOM
                  </div>
                  <Waveform bars={40} height={40} />
                  <p className="mt-3 font-mono text-[11px] leading-[1.5] text-tertiary">
                    Live fan audio, a chat worth reading and match stats, all in
                    sync with your screen.
                  </p>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* UP NEXT · ARSENAL */}
        {upNext.length > 0 && (
          <div className="mb-9">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="font-mono text-[12px] tracking-[0.06em] text-red">
                UP NEXT · ARSENAL
              </span>
              <span className="font-mono text-[12px] text-tertiary">
                rooms scheduled, save your seat
              </span>
            </div>
            <div className="grid gap-3.5 md:grid-cols-2">
              {upNext.map(({ f, dateLabel, room }) => (
                <div
                  key={f.id}
                  className="relative overflow-hidden rounded-2xl border border-line bg-surface p-[22px]"
                  style={{ borderLeft: "3px solid #ef0107" }}
                >
                  <div className="mb-3 font-mono text-[10px] tracking-[0.06em] text-secondary uppercase">
                    {dateLabel} · {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }).format(new Date(f.kickoffUtc))}
                  </div>
                  <div className="display text-[22px]">
                    {f.home} <span className="text-secondary">v</span> {f.away}
                  </div>
                  <div className="mt-3 mb-4 flex items-center gap-2.5">
                    <Avatar src={null} name={hostsOf(room)[0]} size={28} />
                    <span className="text-[12px] text-secondary">
                      Room scheduled ·{" "}
                      {hostsOf(room).map((h, i) => (
                        <span key={h}>
                          {i > 0 && " · "}@{h}
                        </span>
                      ))}
                    </span>
                  </div>
                  <RsvpButton
                    roomId={room.id}
                    slug={room.slug}
                    initialRsvped={room.viewerRsvped}
                    signedIn={signedIn}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FULL SCHEDULE (filter pills + flat rows) */}
        <ScheduleBoard groups={groups} signedIn={signedIn} />

        {/* NOTIFY + HOST bands */}
        <div id="notify" className="mt-10 grid gap-3.5 md:grid-cols-[1.3fr_1fr]">
          <div
            className="relative overflow-hidden rounded-[18px] border p-[26px]"
            style={{
              background:
                "linear-gradient(120deg, rgba(239,1,7,.14), transparent 55%), var(--bg-surface)",
              borderColor: "rgba(239,1,7,.28)",
            }}
          >
            <div className="mb-2.5 font-mono text-[11px] tracking-[0.06em] text-red">
              DON&apos;T WANT TO KEEP CHECKING BACK?
            </div>
            <h2 className="display mb-3.5 t-h3">Get pinged when rooms open.</h2>
            <NotifyForm source="matches" className="max-w-md" />
            <p className="mt-2.5 text-[11px] text-tertiary">
              One email when rooms open. No spam, unsubscribe any time.
            </p>
          </div>
          <div className="flex flex-col justify-center rounded-[18px] border border-line bg-raised p-[26px]">
            <div className="mb-2.5 font-mono text-[11px] tracking-[0.06em] text-red">
              WANT TO HOST A ROOM?
            </div>
            <div className="display t-h3">Fancy calling the match?</div>
            <p className="mt-1.5 mb-4 text-[13px] leading-[1.5] text-secondary">
              Know the club and can hold a mic? There&apos;ll be a seat at the
              front for you too.
            </p>
            <Link
              href="/host"
              className="btn-grad-red inline-flex w-fit items-center rounded-[11px] px-5 py-3 text-[13px] font-semibold text-white"
            >
              Start your first room →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
