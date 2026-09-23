import type { ReactNode } from "react";
import Link from "next/link";
import type { ScheduleFixture, ScheduleRoom, LivePreview } from "@/lib/db/matches";
import { Countdown } from "@/components/marketing/Countdown";
import { RsvpButton } from "@/components/matches/RsvpButton";
import { listeningLine, goingLine } from "@/lib/strings/attendance";
import { competitionLine } from "@/lib/strings/competition";

/**
 * The /matches featured hero. Since founder 2026-09-22 it MIRRORS the front
 * page's red hero blocks exactly (the "IN THE ROOM" preview panel with its
 * waveform and stat tiles is gone): live = the On-air block that walks into
 * the room; scheduled = the Next-broadcast block with the gold countdown and
 * a REAL RSVP control. Every number is real or omitted; the listener count
 * is host-only (founder 2026-09-12).
 */

const hostsOf = (r: ScheduleRoom) =>
  r.hostUsernames.length > 0 ? r.hostUsernames : [r.hostUsername];

/** Full-card link when the room is enterable (live, or the waiting room is
 *  joinable); otherwise a plain container so the RSVP button isn't an illegal
 *  nested link. Deep-red block in both states (founder 2026-09-13). */
function CardShell({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  const base =
    "relative block overflow-hidden bg-red-fill p-7 text-on-red sm:px-9";
  return href ? (
    <Link href={href} className={`${base} transition-opacity hover:opacity-95`}>
      {children}
    </Link>
  ) : (
    <div className={base}>{children}</div>
  );
}

export function FeaturedRoom({
  fixture,
  room,
  dateLabel,
  live,
  preview,
  signedIn,
  showListeners = false,
}: {
  fixture: ScheduleFixture;
  room: ScheduleRoom;
  dateLabel: string;
  live: boolean;
  /** real listener count; only meaningful when `live` */
  preview: LivePreview | null;
  signedIn: boolean;
  /** listener count is host-only (founder 2026-09-12); the page passes true
   *  only when the viewer hosts this room (or is an admin) */
  showListeners?: boolean;
}) {
  const comp = competitionLine(
    fixture.competition ?? "Premier League",
    fixture.round,
  );
  const listeners = preview?.listeners ?? 0;
  const hosts = hostsOf(room);

  // a scheduled room's CTA flips from RSVP to "Join the waiting room" 30 min
  // before the show's start; live rooms are always joinable
  const joinable =
    live ||
    Date.now() >= new Date(room.broadcastStart).getTime() - 30 * 60 * 1000;

  return (
    <div className="mb-9">
      {/* eyebrow */}
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="inline-flex items-center gap-2 font-mono text-[13px] tracking-[0.1em] text-red">
          <span
            className={`h-2 w-2 rounded-full bg-red-fill ${live ? "animate-fcpulse" : "animate-fc-blink"}`}
          />
          {live ? "LIVE NOW" : "NEXT UP"}
        </span>
        <span className="text-[13px] text-tertiary italic">
          {live ? "doors are up" : dateLabel}
        </span>
      </div>

      <CardShell href={joinable ? `/room/${room.slug}` : null}>
        {live ? (
          <>
            <div className="flex flex-wrap justify-between gap-3.5 font-mono text-[14.5px] tracking-[0.16em]">
              <span className="flex items-center gap-2.5">
                <span className="h-[9px] w-[9px] animate-fcpulse rounded-full bg-on-red" />
                On air now - live from the host
              </span>
              <span className="whitespace-nowrap">
                @{hosts.join(" & @")} commentating
              </span>
            </div>
            <div className="mt-3.5 flex flex-wrap items-end justify-between gap-4">
              <div className="display text-[clamp(34px,5vw,56px)] leading-[0.95]">
                {fixture.home} <span className="opacity-70">v</span>{" "}
                {fixture.away}
              </div>
              <span className="border-2 border-on-red px-6 py-3 font-mono text-[15px] tracking-[0.14em] whitespace-nowrap">
                Listen in →
              </span>
            </div>
            <p className="mt-2.5 text-[17px] italic opacity-85">
              {comp} · free to listen, no account needed
              {showListeners && listeners > 0 && (
                <span className="tabular-nums"> · {listeningLine(listeners)}</span>
              )}
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap justify-between gap-3.5 font-mono text-[14.5px] tracking-[0.16em]">
              <span>Next broadcast - {dateLabel}</span>
              <span className="text-gold-bright tabular-nums whitespace-nowrap">
                Kicks off in <Countdown iso={fixture.kickoffUtc} />
              </span>
            </div>
            <div className="mt-3.5 flex flex-wrap items-end justify-between gap-4">
              <div className="display text-[clamp(30px,4.6vw,52px)] leading-[0.95]">
                {fixture.home} <span className="text-gold-bright">v</span>{" "}
                {fixture.away}
              </div>
              {joinable ? (
                <span className="border-2 border-on-red px-6 py-3 font-mono text-[15px] font-semibold tracking-[0.12em] whitespace-nowrap">
                  Join the waiting room →
                </span>
              ) : (
                <RsvpButton
                  roomId={room.id}
                  slug={room.slug}
                  initialRsvped={room.viewerRsvped}
                  signedIn={signedIn}
                  variant="onInk"
                  label="RSVP for notifications"
                />
              )}
            </div>
            <p className="mt-2.5 text-[17px] italic opacity-80">
              {comp}
              {room.blurb
                ? ` · ${room.blurb}`
                : ` · room scheduled with @${hosts.join(" & @")}`}
            </p>
          </>
        )}
      </CardShell>

      {/* real RSVP count under a scheduled hero */}
      {!live && goingLine(room.rsvpCount) && (
        <div className="mt-3">
          <span className="font-mono text-[13px] text-tertiary tabular-nums">
            {goingLine(room.rsvpCount)}
          </span>
        </div>
      )}
    </div>
  );
}
