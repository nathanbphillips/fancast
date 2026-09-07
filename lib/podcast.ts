import type { SupabaseClient } from "@supabase/supabase-js";
import { brand } from "@/lib/brand";

/**
 * The Arseradio podcast: published post-game shows, served as a standard RSS
 * feed at /podcast.xml (founder 2026-09-01). Spotify has no upload API;
 * podcasts reach it (and Apple, and everywhere else) through an RSS feed the
 * directory polls. Publishing an episode here is therefore the whole
 * automation: one button on the recordings page copies the post-game MP3 into
 * the public `podcast` bucket and adds a row; the feed updates instantly and
 * the directories pick it up on their next poll.
 *
 * One-time founder setup per directory (e.g. Spotify for Creators): add the
 * feed URL, receive the verification email at PODCAST_OWNER_EMAIL, done.
 */
export const PODCAST_BUCKET = "podcast";

export const podcastConfig = {
  // the channel matches the EXISTING Spotify show it now feeds (founder
  // 2026-09-07): same title and byline, so the host migration changes nothing
  // a listener sees. Description is keyword-rich for discovery (Arsenal,
  // Gooners, Premier League) and stays copy-compliant (unofficial, no footage).
  title: process.env.PODCAST_TITLE || `${brand.name} but it's a podcast`,
  description:
    process.env.PODCAST_DESCRIPTION ||
    `The unofficial Arsenal fan podcast from the ${brand.name} matchday room. Live fan commentary on every Arsenal match: the pre-game show, the full match as the room lived it, and the post-game reaction, with call-ins and questions from Gooners in the room. Arsenal talk, team news, and Premier League matchday reaction from real supporters, not pundits. Hosted by Nathan and Christopher. We never carry match footage or broadcast audio; this is our own conversation. ${brand.domain}`,
  language: "en",
  author: process.env.PODCAST_AUTHOR || "Nathan and Christopher",
  ownerName: brand.name,
  /** Spotify sends its claim/verification email here (must be receivable). */
  ownerEmail: process.env.PODCAST_OWNER_EMAIL || `team@${brand.domain}`,
  /** live call-ins from fans during football: assume strong language */
  explicit: (process.env.PODCAST_EXPLICIT ?? "true") !== "false",
  category: "Sports",
  subcategory: "Soccer",
} as const;

export type EpisodeKind = "pregame" | "match" | "postgame";
export const EPISODE_KINDS: readonly EpisodeKind[] = ["pregame", "match", "postgame"];
/** which recording cut each kind publishes */
export const KIND_TO_LABEL: Record<EpisodeKind, string> = {
  pregame: "Pre-game show",
  match: "Full match",
  postgame: "Post-game show",
};

export type PodcastEpisodeRow = {
  id: string;
  /** "import" = a legacy episode carried over from Spotify hosting */
  kind: EpisodeKind | "import";
  title: string;
  description: string;
  audio_path: string;
  audio_bytes: number;
  duration_seconds: number;
  guid: string;
  published_at: string;
};

const esc = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

function itunesDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** RSS 2.0 + itunes tags; the minimum Spotify/Apple require, nothing exotic. */
export function buildFeedXml(args: {
  siteUrl: string;
  audioBaseUrl: string;
  episodes: PodcastEpisodeRow[];
}): string {
  const c = podcastConfig;
  const feedUrl = `${args.siteUrl}/podcast.xml`;
  // the show's existing neon-AR artwork, carried over from Spotify hosting
  const coverUrl = `${args.siteUrl}${process.env.PODCAST_COVER_PATH || "/podcast-cover.jpg"}`;
  const items = args.episodes
    .map((e) => {
      const url = `${args.audioBaseUrl}/${e.audio_path}`;
      return `    <item>
      <title>${esc(e.title)}</title>
      <description>${esc(e.description)}</description>
      <enclosure url="${esc(url)}" length="${e.audio_bytes}" type="audio/mpeg"/>
      <guid isPermaLink="false">${e.guid}</guid>
      <pubDate>${new Date(e.published_at).toUTCString()}</pubDate>
      <itunes:duration>${itunesDuration(Number(e.duration_seconds))}</itunes:duration>
      <itunes:explicit>${c.explicit ? "true" : "false"}</itunes:explicit>
    </item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(c.title)}</title>
    <link>${esc(args.siteUrl)}</link>
    <description>${esc(c.description)}</description>
    <language>${c.language}</language>
    <atom:link href="${esc(feedUrl)}" rel="self" type="application/rss+xml"/>
    <itunes:author>${esc(c.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${esc(c.ownerName)}</itunes:name>
      <itunes:email>${esc(c.ownerEmail)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${esc(coverUrl)}"/>
    <itunes:explicit>${c.explicit ? "true" : "false"}</itunes:explicit>
    <itunes:category text="${esc(c.category)}">
      <itunes:category text="${esc(c.subcategory)}"/>
    </itunes:category>
${items}
  </channel>
</rss>
`;
}

/** RELEASED episodes only, newest first: published_at doubles as the
 *  schedule, so a future date stays off the feed until its time arrives (the
 *  feed is generated per request, so release needs no cron). A read error is
 *  surfaced, never swallowed: an empty feed served with 200 would be
 *  CDN-cached and read by directories as "all episodes removed". */
export async function loadEpisodes(
  service: SupabaseClient,
): Promise<{ episodes: PodcastEpisodeRow[]; error: string | null }> {
  const { data, error } = await service
    .from("podcast_episodes")
    .select("id, kind, title, description, audio_path, audio_bytes, duration_seconds, guid, published_at")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(500)
    .returns<PodcastEpisodeRow[]>();
  return { episodes: data ?? [], error: error?.message ?? null };
}
