import { brand } from "@/lib/brand";

/**
 * Podcast-style episode notes for the pre-game and post-game shows
 * (founder 2026-09-01): short title + description, simple and direct, offered
 * on the recordings page for copy/paste and .txt download, and reused verbatim
 * by the podcast feed when the post-game show is published.
 *
 * Copy compliance (load-bearing): the notes describe fan commentary recorded
 * in the room. They never imply the platform shows the match or carries
 * broadcast audio, and never imply club or league affiliation.
 */
export type EpisodeNote = { title: string; description: string };
export type EpisodeNotes = { pregame: EpisodeNote; match: EpisodeNote; postgame: EpisodeNote };

// Fixed byline (founder 2026-09-06): the shows are presented as Nathan and
// Christopher regardless of which ACCOUNTS host the room (Christopher is on
// air without one). Env-overridable for the day that changes.
const HOSTS = process.env.EPISODE_NOTES_HOSTS || "Nathan and Christopher";

export function episodeNotes(args: {
  homeTeam: string;
  awayTeam: string;
  kickoffIso: string;
  homeScore: number | null;
  awayScore: number | null;
}): EpisodeNotes {
  const { homeTeam, awayTeam, homeScore, awayScore } = args;
  const matchup = `${homeTeam} vs ${awayTeam}`;
  const date = new Date(args.kickoffIso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  const hasScore = homeScore !== null && awayScore !== null;
  const scoreline = hasScore ? `${homeTeam} ${homeScore}-${awayScore} ${awayTeam}` : matchup;
  const signoff = ` Hosted by ${HOSTS}. Recorded live on ${brand.domain}. Follow us on Bluesky.`;

  return {
    pregame: {
      title: `${matchup}: The Pre-Game Show`,
      description:
        `Live fan commentary before ${matchup} (${date}). ` +
        `Team news, form, and predictions, plus questions and call-ins from the room.` +
        signoff,
    },
    // the Full match blend: first half + halftime show + second half in one
    match: {
      title: `${scoreline}: The Match Show`,
      description:
        `Live fan commentary through ${matchup} (${date})${hasScore ? `, final score ${homeScore}-${awayScore}` : ""}. ` +
        `The full first half, the halftime show, and the second half in one file, as the room lived it.` +
        signoff,
    },
    postgame: {
      title: `${scoreline}: The Post-Game Show`,
      description:
        `Full-time reaction to ${matchup} (${date})${hasScore ? `, final score ${homeScore}-${awayScore}` : ""}. ` +
        `The result, the performances, and what it means, with call-ins and questions from the room.` +
        signoff,
    },
  };
}
