import type { Metadata } from "next";
import { FeaturedRoom } from "@/components/matches/FeaturedRoom";
import type { ScheduleFixture, ScheduleRoom } from "@/lib/db/matches";

/**
 * Design-preview for the /matches featured hero (founder review, 2026-07-08).
 * Renders the live + next-up heroes with representative data so the rich card
 * (scoreline, IN THE ROOM stat tiles, the sample Nathan chat line) can be
 * reviewed in a browser without waiting for a genuinely-live room. NOT linked
 * anywhere and noindexed; the real /matches renders these from live data.
 */
export const metadata: Metadata = {
  title: "Matches preview",
  robots: { index: false, follow: false },
};

const fixture: ScheduleFixture = {
  id: 1,
  sportmonksFixtureId: null,
  home: "Arsenal",
  away: "Coventry City",
  competition: "Premier League",
  round: "MD1",
  kickoffUtc: "2026-08-21T18:00:00.000Z",
  status: "1H",
  homeScore: 2,
  awayScore: 0,
  rooms: [],
};

const room: ScheduleRoom = {
  id: "preview-room",
  slug: "arsenal-vs-coventry-21-aug-2026-danny",
  state: "live_1h",
  hostUsername: "danny",
  hostUsernames: ["danny"],
  blurb: "with Danny · never neutral",
  rsvpCount: 0,
  viewerRsvped: false,
  postponed: false,
  friendNames: [],
};

export default function MatchesHeroPreview() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-10">
      <p className="mb-6 font-mono text-[12px] text-tertiary">
        DESIGN PREVIEW — not the live page. The real /matches renders these
        states from live room data.
      </p>

      <FeaturedRoom
        fixture={fixture}
        room={room}
        dateLabel="Fri 21 Aug"
        live
        preview={{ listeners: 128, stats: { xg: 2.1, possHome: 58, shots: 14 } }}
        signedIn={false}
      />

      <FeaturedRoom
        fixture={{ ...fixture, status: "NS", homeScore: null, awayScore: null }}
        room={{ ...room, state: "scheduled", rsvpCount: 12 }}
        dateLabel="Sat 29 Aug"
        live={false}
        preview={null}
        signedIn={false}
      />
    </div>
  );
}
