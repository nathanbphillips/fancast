import type { Metadata } from "next";
import Link from "next/link";
import { loadMatchesSchedule } from "@/lib/db/matches";
import { getCurrentUserAndProfile } from "@/lib/db/server";
import { KickoffTime } from "@/components/KickoffTime";
import { Avatar } from "@/components/Avatar";
import { Waveform } from "@/components/ui/Waveform";
import { MatchesSchedule } from "@/components/matches/MatchesSchedule";
import { NotifyForm } from "@/components/marketing/NotifyForm";

/**
 * Matches (Matchday redesign): the full date-grouped schedule with multi-room
 * fixtures + RSVP (FR-22.4). Viewer-specific (their RSVP state), so dynamic per
 * request. A live room, if one is on, leads with a prominent honest hero (real
 * fixture + host + Join; no fabricated listener/stat counts we don't hold on
 * this page). Filter pills from the mock are deferred (founder: until room
 * volume demands them). A DB failure throws to the (app) error boundary.
 */

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage() {
  const [groups, { user }] = await Promise.all([
    loadMatchesSchedule(),
    getCurrentUserAndProfile(),
  ]);

  // find the first live room to lead with (real data only)
  let liveHero: {
    home: string;
    away: string;
    competition: string | null;
    slug: string;
    hosts: string[];
    blurb: string | null;
  } | null = null;
  for (const g of groups) {
    for (const f of g.fixtures) {
      const room = f.rooms.find((r) => r.state !== "scheduled");
      if (room) {
        liveHero = {
          home: f.home,
          away: f.away,
          competition: f.competition,
          slug: room.slug,
          hosts:
            room.hostUsernames.length > 0
              ? room.hostUsernames
              : [room.hostUsername],
          blurb: room.blurb,
        };
        break;
      }
    }
    if (liveHero) break;
  }

  return (
    <>
      {/* HEADER */}
      <section
        className="relative overflow-hidden border-b border-line"
        style={{
          background:
            "radial-gradient(110% 100% at 85% -20%, rgba(239,1,7,0.16), transparent 56%), var(--bg-base)",
        }}
      >
        <div className="relative mx-auto max-w-[1120px] px-5 pt-14 pb-8 sm:px-10">
          <p className="mb-3 flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red">
            FULL SCHEDULE · ARSENAL
          </p>
          <h1 className="display t-hero">What&apos;s on</h1>
          <p className="mt-4 max-w-[520px] text-[17px] leading-[1.5] text-secondary">
            Every Arsenal fixture with a room. Join the live show when the host
            opens the doors. Free to listen, no account needed.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-10">
        {/* LIVE NOW hero (only when a room is actually live) */}
        {liveHero && (
          <div className="mb-9">
            <div className="mb-3.5 flex items-center gap-2.5">
              <span className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[0.06em] text-red">
                <span className="h-2 w-2 animate-fcpulse rounded-full bg-red" />
                LIVE NOW
              </span>
              <span className="font-mono text-[12px] text-tertiary">
                doors are up
              </span>
            </div>
            <Link
              href={`/room/${liveHero.slug}`}
              className="relative block overflow-hidden rounded-[20px] border p-7 transition-transform hover:-translate-y-[3px]"
              style={{
                background:
                  "linear-gradient(120deg, rgba(239,1,7,.18), transparent 52%), var(--bg-surface)",
                borderColor: "rgba(239,1,7,.34)",
                boxShadow: "0 30px 60px -40px rgba(239,1,7,.5)",
              }}
            >
              <div className="relative z-[2] grid items-center gap-7 lg:grid-cols-[1.05fr_1fr]">
                <div>
                  <div className="mb-3 font-mono text-[11px] tracking-[0.06em] text-red">
                    {liveHero.competition ?? "Live room"}
                  </div>
                  <div className="display text-[34px] leading-[1]">
                    {liveHero.home}{" "}
                    <span className="text-secondary">v</span> {liveHero.away}
                  </div>
                  <div className="mt-3.5 mb-5 flex items-center gap-2.5">
                    <Avatar src={null} name={liveHero.hosts[0]} size={32} />
                    <div className="text-[12.5px] text-secondary">
                      {liveHero.blurb ? (
                        <span className="text-primary">{liveHero.blurb}</span>
                      ) : (
                        <span>
                          Hosted by{" "}
                          {liveHero.hosts.map((h, i) => (
                            <span key={h}>
                              {i > 0 && " · "}@{h}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="btn-grad-red inline-flex items-center gap-2 rounded-[11px] px-[22px] py-3 text-[14px] font-semibold text-white">
                    <span className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-white" />
                    Join the room
                  </span>
                </div>
                {/* decorative live waveform (not real amplitude) */}
                <div className="hidden rounded-2xl border border-line bg-canvas p-4 lg:block">
                  <div className="mb-3 inline-flex items-center gap-1.5 font-mono text-[10px] text-red">
                    <span className="h-1.5 w-1.5 animate-fc-blink rounded-full bg-red" />
                    IN THE ROOM
                  </div>
                  <Waveform bars={40} height={40} />
                  <p className="mt-3 font-mono text-[11px] text-tertiary">
                    Live fan audio · chat · stats, in sync with your screen
                  </p>
                </div>
              </div>
            </Link>
          </div>
        )}

        <MatchesSchedule groups={groups} signedIn={!!user} />

        {/* NOTIFY BAND — turn "no room yet" into a real action + launch list */}
        <div className="mt-9 rounded-2xl border border-line bg-raised px-[26px] py-6">
          <p className="t-title font-extrabold">
            Don&apos;t want to keep checking back?
          </p>
          <p className="mt-1 mb-4 max-w-lg text-[13.5px] text-secondary">
            Rooms are just starting to open. Get an email when there&apos;s one
            for a match you want to watch with the room.
          </p>
          <NotifyForm source="matches" className="max-w-md" />
        </div>

        {/* HOST CTA BAND */}
        <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-raised px-[26px] py-6 sm:flex-row sm:items-center">
          <div>
            <p className="t-title font-extrabold">Want to host a room?</p>
            <p className="mt-1 text-[13.5px] text-secondary">
              Arsenal first. More clubs to come. If you fancy calling the match,
              there&apos;ll be room for you too.
            </p>
          </div>
          <Link
            href="/host"
            className="btn-grad-red shrink-0 rounded-[11px] px-6 py-3.5 text-center text-[14px] font-semibold text-white"
          >
            Start your first room →
          </Link>
        </div>
      </div>
    </>
  );
}
