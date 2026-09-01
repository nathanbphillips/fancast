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
export type EpisodeNotes = { pregame: EpisodeNote; postgame: EpisodeNote };

function hostLine(hosts: string[]): string {
  if (hosts.length === 0) return "";
  const joined = hosts.length === 1 ? hosts[0] : `${hosts.slice(0, -1).join(", ")} and ${hosts[hosts.length - 1]}`;
  return ` Hosted by ${joined}.`;
}

export function episodeNotes(args: {
  homeTeam: string;
  awayTeam: string;
  kickoffIso: string;
  homeScore: number | null;
  awayScore: number | null;
  /** accepted hosts' usernames, in any order */
  hosts: string[];
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
  const signoff = ` Recorded live on ${brand.name}, the matchday room for Arsenal fans. ${brand.domain}`;

  return {
    pregame: {
      title: `${matchup}: The Pre-Game Show`,
      description:
        `Live fan commentary before ${matchup} (${date}). ` +
        `Team news, form, and predictions, plus questions and call-ins from the room.` +
        hostLine(args.hosts) +
        signoff,
    },
    postgame: {
      title: `${scoreline}: The Post-Game Show`,
      description:
        `Full-time reaction to ${matchup} (${date})${hasScore ? `, final score ${homeScore}-${awayScore}` : ""}. ` +
        `The result, the performances, and what it means, with call-ins and questions from the room.` +
        hostLine(args.hosts) +
        signoff,
    },
  };
}
