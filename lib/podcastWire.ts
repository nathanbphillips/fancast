/**
 * Spotify episodes for FROM THE WIRE (founder 2026-09-13): the show's public
 * RSS (Spotify-hosted, the same feed Spotify serves the show from) read
 * server-side with Next's fetch cache - no API keys, no new routes, nothing
 * backend reconfigured. Parsed with a few line regexes (titles are CDATA);
 * a fetch or parse failure returns [] and the wire simply shows Bluesky only.
 */

const FEED_URL = "https://anchor.fm/s/11650b1a0/podcast/rss";

export type WireEpisode = {
  title: string;
  /** ISO publish time - the wire interleaves by this */
  dateIso: string;
  /** the episode page (podcasters.spotify.com; opens/plays on Spotify) */
  url: string;
  image?: string;
};

const cdata = (s: string | undefined): string =>
  (s ?? "")
    .replace(/^<!\[CDATA\[/, "")
    .replace(/\]\]>$/, "")
    .trim();

export async function loadWireEpisodes(limit = 8): Promise<WireEpisode[]> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const xml = await res.text();

    const channelImage = xml.match(/<itunes:image href="([^"]+)"/)?.[1];
    const items = xml.split("<item>").slice(1);
    const episodes: WireEpisode[] = [];
    for (const item of items) {
      const title = cdata(item.match(/<title>([\s\S]*?)<\/title>/)?.[1]);
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
      const pub = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();
      const image = item.match(/<itunes:image href="([^"]+)"/)?.[1] ?? channelImage;
      if (!title || !link || !pub) continue;
      const date = new Date(pub);
      if (Number.isNaN(date.getTime())) continue;
      episodes.push({ title, dateIso: date.toISOString(), url: link, image });
      if (episodes.length >= limit) break;
    }
    return episodes;
  } catch {
    return [];
  }
}
