import Link from "next/link";
import type { DiscussionRoom } from "@/lib/db/matches";
import { goingLine } from "@/lib/strings/attendance";
import { Avatar } from "@/components/Avatar";
import { RsvpButton } from "@/components/matches/RsvpButton";

/**
 * "Rooms right now" — the anytime (discussion) rooms strip on /matches (founder
 * 2026-07-14). Secondary to the match schedule (matches stay dominant); shown
 * only when discussion rooms exist. Live rooms link straight in; upcoming ones
 * get an RSVP + real "going" count. Honest: real rooms only, no fabricated
 * numbers. Renders nothing when the list is empty.
 */

function timeOf(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

export function DiscussionStrip({
  rooms,
  signedIn,
}: {
  rooms: DiscussionRoom[];
  signedIn: boolean;
}) {
  if (rooms.length === 0) return null;

  return (
    <div className="mb-9">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red">
          <span className="h-2 w-2 animate-fc-blink rounded-full bg-red" />
          ROOMS RIGHT NOW
        </span>
        <span className="font-mono text-[12px] text-tertiary">
          fan discussions, on or off matchday
        </span>
      </div>
      <div className="grid gap-3.5 md:grid-cols-2">
        {rooms.map((r) => (
          <div
            key={r.id}
            className="relative overflow-hidden rounded-2xl border border-line bg-surface p-[22px]"
            style={{ borderLeft: "3px solid #ef0107" }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              {r.live ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] text-red uppercase">
                  <span className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-red" />
                  Live now
                </span>
              ) : (
                <span className="font-mono text-[10px] tracking-[0.06em] text-secondary uppercase">
                  {timeOf(r.scheduledKickoff)}
                </span>
              )}
            </div>
            <div className="display text-[20px] leading-[1.15]">{r.title}</div>
            <div className="mt-3 mb-4 flex items-center gap-2.5">
              <Avatar src={null} name={r.hostUsername} size={28} />
              <span className="min-w-0 truncate text-[12px] text-secondary">
                {r.blurb ? r.blurb : <>Hosted by @{r.hostUsername}</>}
              </span>
            </div>
            {r.live ? (
              <Link
                href={`/room/${r.slug}`}
                className="btn-grad-red inline-flex w-fit items-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold text-white"
              >
                <span className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-white" />
                Join the room →
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <RsvpButton
                  roomId={r.id}
                  slug={r.slug}
                  initialRsvped={r.viewerRsvped}
                  signedIn={signedIn}
                  size="sm"
                />
                {goingLine(r.rsvpCount) && (
                  <span className="font-mono text-[12px] text-tertiary tabular-nums">
                    {goingLine(r.rsvpCount)}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
