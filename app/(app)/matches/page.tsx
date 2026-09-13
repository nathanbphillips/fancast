import type { Metadata } from "next";
import Link from "next/link";
import {
  loadMatchesSchedule,
  loadLiveRoomPreview,
  loadDiscussionRooms,
  type ScheduleFixture,
  type ScheduleRoom,
} from "@/lib/db/matches";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { goingLine } from "@/lib/strings/attendance";
import { DEMO_ROOM_HREF } from "@/lib/config";
import { Avatar } from "@/components/Avatar";
import { Waveform } from "@/components/ui/Waveform";
import { FeaturedRoom } from "@/components/matches/FeaturedRoom";
import { DiscussionStrip } from "@/components/matches/DiscussionStrip";
import { ScheduleBoard } from "@/components/matches/ScheduleBoard";
import { RsvpButton } from "@/components/matches/RsvpButton";
import { NotifyForm } from "@/components/marketing/NotifyForm";
import { LocalTime } from "@/components/KickoffTime";

/**
 * Matches (Matches.dc.html): header + filter pills, a featured hero (the live
 * room if one is on, else the soonest scheduled room), an "Up next · Arsenal"
 * strip, the full date-grouped schedule as flat rows, and the Notify + Host
 * bands. Founder rule "real data, gated": the live hero's scoreline, listener
 * count and xG/possession/shots come from REAL data (`loadLiveRoomPreview`) and
 * degrade to a countdown + real RSVP count when nothing's live — never a
 * fabricated number. A DB failure throws to the (app) error boundary.
 * Viewer-specific (RSVP), so dynamic per request.
 */

export const metadata: Metadata = { title: "Matches" };

const hostsOf = (r: ScheduleRoom) =>
  r.hostUsernames.length > 0 ? r.hostUsernames : [r.hostUsername];

export default async function MatchesPage() {
  const [groups, { user, profile }, discussionRooms] = await Promise.all([
    loadMatchesSchedule(),
    getCurrentUserAndProfile(),
    loadDiscussionRooms(),
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

  // real extras for the LIVE hero only (listener count + live stats); the
  // scheduled hero degrades to a countdown + RSVP with no fabricated activity
  const preview =
    hero?.live && hero.room
      ? await loadLiveRoomPreview(hero.room.id, hero.f.sportmonksFixtureId)
      : null;

  // listener count is host-only (founder 2026-09-12): shown on the hero only
  // to that room's own hosts (or an admin); everyone else sees no audience size
  const showListeners =
    !!hero &&
    !!profile &&
    (profile.role === "admin" ||
      (!!profile.username && hostsOf(hero.room).includes(profile.username)));

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
      <section className="border-b-[3px] border-double border-primary bg-canvas">
        <div className="mx-auto max-w-[1120px] px-5 pt-14 pb-8 sm:px-10">
          <p className="mb-3 font-mono text-[12px] tracking-[0.1em] text-red">
            FULL SCHEDULE · ARSENAL
          </p>
          <h1 className="display t-hero">What&apos;s on</h1>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.5] text-secondary italic">
            Every Arsenal fixture with a room, plus the whole league board. Join
            the live show when the host opens the doors. Free to listen, no
            account needed.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-10">
        {/* FEATURED HERO — real live data, gated (degrades to next-up) */}
        {hero ? (
          <FeaturedRoom
            fixture={hero.f}
            room={hero.room}
            dateLabel={hero.dateLabel}
            live={hero.live}
            preview={preview}
            signedIn={signedIn}
            showListeners={showListeners}
          />
        ) : (
          /* honest empty state: no live/scheduled room in-window yet. Keeps the
             page intentional (never blank) without inventing any activity. */
          <div className="mb-9">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-tertiary">
                <span className="h-2 w-2 rounded-full bg-tertiary/50" />
                NOTHING LIVE RIGHT NOW
              </span>
            </div>
            <div className="border border-line bg-canvas p-7">
              <div className="grid items-center gap-7 lg:grid-cols-[1.05fr_1fr]">
                <div>
                  <h2 className="display t-h3">No rooms are open yet.</h2>
                  <p className="mt-3 max-w-[440px] text-[14px] leading-[1.55] text-secondary italic">
                    Rooms open on matchday, usually about fifteen minutes before
                    kick-off. Browse the full schedule below, or get pinged the
                    moment one opens.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href="#notify"
                      className="btn-grad-red inline-flex items-center px-5 py-3 text-[13px] font-semibold"
                    >
                      Get matchday alerts →
                    </Link>
                    <Link
                      href={DEMO_ROOM_HREF}
                      className="inline-flex items-center border-2 border-primary px-5 py-3 font-mono text-[13px] font-semibold tracking-[0.08em] text-primary transition-colors hover:text-red"
                    >
                      See the demo room →
                    </Link>
                  </div>
                </div>
                <div className="hidden border border-line bg-inset p-4 lg:block">
                  <div className="mb-3 inline-flex items-center gap-1.5 font-mono text-[10px] text-tertiary">
                    <span className="h-1.5 w-1.5 rounded-full bg-tertiary/50" />
                    IN THE ROOM
                  </div>
                  <Waveform bars={40} height={36} />
                  <p className="mt-3 font-mono text-[11px] leading-[1.5] text-tertiary">
                    When a host opens the doors you get live fan audio, a chat
                    worth reading and match stats, all in sync with your screen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* UP NEXT · ARSENAL */}
        {upNext.length > 0 && (
          <div className="mb-9">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="font-mono text-[12px] tracking-[0.1em] text-red">
                UP NEXT · ARSENAL
              </span>
              <span className="text-[12px] text-tertiary italic">
                rooms scheduled, save your seat
              </span>
            </div>
            <div className="grid gap-3.5 md:grid-cols-2">
              {upNext.map(({ f, dateLabel, room }) => (
                <div
                  key={f.id}
                  className="relative border border-line border-l-[3px] border-l-red bg-canvas p-[22px]"
                >
                  <div className="mb-3 font-mono text-[10px] tracking-[0.06em] text-secondary uppercase">
                    {dateLabel} · <LocalTime iso={f.kickoffUtc} />
                  </div>
                  <div className="display text-[22px]">
                    {f.home} <span className="font-mono text-[14px] text-red normal-case">v</span> {f.away}
                  </div>
                  <div className="mt-3 mb-4 flex items-center gap-2.5">
                    <Avatar src={null} name={hostsOf(room)[0]} size={28} />
                    <span className="text-[12px] text-secondary italic">
                      Room scheduled ·{" "}
                      {hostsOf(room).map((h, i) => (
                        <span key={h}>
                          {i > 0 && " · "}@{h}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <RsvpButton
                      roomId={room.id}
                      slug={room.slug}
                      initialRsvped={room.viewerRsvped}
                      signedIn={signedIn}
                    />
                    {goingLine(room.rsvpCount) && (
                      <span className="font-mono text-[12px] text-tertiary tabular-nums">
                        {goingLine(room.rsvpCount)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ROOMS RIGHT NOW — anytime discussion rooms (secondary to matches) */}
        <DiscussionStrip rooms={discussionRooms} signedIn={signedIn} />

        {/* FULL SCHEDULE (filter pills + flat rows) */}
        <div id="schedule" className="scroll-mt-20">
          <ScheduleBoard groups={groups} signedIn={signedIn} />
        </div>

        {/* NOTIFY + HOST bands */}
        <div id="notify" className="mt-10 grid gap-3.5 md:grid-cols-[1.3fr_1fr]">
          <div className="border-2 border-primary bg-canvas p-[26px]">
            <div className="mb-2.5 font-mono text-[11px] tracking-[0.1em] text-red">
              DON&apos;T WANT TO KEEP CHECKING BACK?
            </div>
            <h2 className="display mb-3.5 t-h3">Get pinged when rooms open.</h2>
            <NotifyForm source="matches" className="max-w-md" />
            <p className="mt-2.5 text-[11px] text-tertiary italic">
              One email when rooms open. No spam, unsubscribe any time.
            </p>
          </div>
          <div className="flex flex-col justify-center border border-line bg-canvas p-[26px]">
            <div className="mb-2.5 font-mono text-[11px] tracking-[0.1em] text-red">
              WANT TO HOST A ROOM?
            </div>
            <div className="display t-h3">Fancy calling the match?</div>
            <p className="mt-1.5 mb-4 text-[13px] leading-[1.5] text-secondary">
              Know the club and can hold a mic? There&apos;ll be a seat at the
              front for you too.
            </p>
            <Link
              href="/host"
              className="btn-grad-red inline-flex w-fit items-center px-5 py-3 text-[13px] font-semibold"
            >
              Start your first room →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
