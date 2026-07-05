import type { Metadata } from "next";
import { loadMatchesSchedule } from "@/lib/db/matches";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { Button } from "@/components/ui/Button";
import { MatchesSchedule } from "@/components/matches/MatchesSchedule";
import { NotifyForm } from "@/components/marketing/NotifyForm";

/**
 * Matches: the full date-grouped schedule with multi-room fixtures + RSVP
 * (FR-22.4). Viewer-specific (their RSVP state), so it is dynamic per request.
 * A DB failure throws to the (app) error boundary, not an empty schedule.
 */

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage() {
  const [groups, { user }] = await Promise.all([
    loadMatchesSchedule(),
    getCurrentUserAndProfile(),
  ]);

  return (
    <>
      {/* HEADER */}
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(110% 100% at 85% -20%, rgba(241,35,43,0.16), transparent 56%), var(--bg-base)",
        }}
      >
        <div className="relative mx-auto max-w-[1180px] px-5 pt-14 pb-8 sm:px-10">
          <p className="mb-3.5 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold-bright" />
            Full schedule · Arsenal
          </p>
          <h1 className="display t-hero">Matches</h1>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.5] text-secondary">
            Every Arsenal fixture with a room. Join the live show when the host
            opens the doors. Free to listen, no account needed.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1180px] px-5 py-10 sm:px-10">
        <MatchesSchedule groups={groups} signedIn={!!user} />

        {/* NOTIFY BAND — turn "no room yet" into a real action + launch list */}
        <div className="mt-9 rounded-2xl border border-line bg-surface px-[26px] py-6">
          <p className="text-lg font-extrabold tracking-[-0.01em]">
            Don&apos;t want to keep checking back?
          </p>
          <p className="mt-1 mb-4 max-w-lg text-[13.5px] text-secondary">
            Rooms are just starting to open. Get an email when there&apos;s one
            for a match you want to watch with the room.
          </p>
          <NotifyForm source="matches" className="max-w-md" />
        </div>

        {/* HOST CTA BAND */}
        <div className="mt-9 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface px-[26px] py-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-lg font-extrabold tracking-[-0.01em]">
              Want to host a room?
            </p>
            <p className="mt-1 text-[13.5px] text-secondary">
              Arsenal first. More clubs to come. If you fancy calling the match,
              there&apos;ll be room for you too.
            </p>
          </div>
          <Button href="/host" variant="red">
            Start your first room →
          </Button>
        </div>
      </div>
    </>
  );
}
