"use client";

import { useEffect, useState } from "react";
import { SPOTIFY_SHOW_URL, type WireEpisode } from "@/lib/podcastWire";

/**
 * FROM THE WIRE (Programme front page, right column): the @arseradio.com
 * Bluesky feed (read from Bluesky's public no-auth API on mount and every
 * minute after) interleaved with the show's Spotify episodes (server-fetched
 * RSS, passed in as a prop), one timeline ordered by post time, each entry
 * labelled with its source (founder 2026-09-13). Every entry is an outbound
 * link. When Bluesky cannot be reached the column stays honest - episodes
 * plus a quiet note, never fabricated posts.
 */

const ACTOR = "arseradio.com";
const PROFILE_URL = `https://bsky.app/profile/${ACTOR}`;
const SPOTIFY_URL = SPOTIFY_SHOW_URL;
const FEED_URL = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${ACTOR}&limit=18&filter=posts_no_replies`;

type WireImage = { thumb: string; alt: string };
type WireExternal = { title: string; uri: string; thumb?: string };
type WirePost = {
  text: string;
  date: Date;
  likes: number;
  url: string;
  images: WireImage[];
  external: WireExternal | null;
};

type EmbedView = {
  $type?: string;
  images?: { thumb?: string; alt?: string }[];
  external?: { uri?: string; title?: string; thumb?: string };
  thumbnail?: string; // video embeds carry a poster frame
  media?: EmbedView;
};

/** post media (founder 2026-09-13): images, video poster frames and external
 *  link cards, from the embed view; recordWithMedia nests its media a level
 *  down. A video renders as its thumbnail - the post links out to Bluesky to
 *  play (golden rule 1 lives elsewhere, but the wire stays a paper page). */
function parseEmbed(embed: EmbedView | undefined): {
  images: WireImage[];
  external: WireExternal | null;
} {
  const e = embed?.media ?? embed;
  const images = (e?.images ?? [])
    .filter((i): i is { thumb: string; alt?: string } => !!i.thumb)
    .map((i) => ({ thumb: i.thumb, alt: i.alt ?? "" }))
    .slice(0, 4);
  if (images.length === 0 && e?.thumbnail) {
    images.push({ thumb: e.thumbnail, alt: "Video - watch on Bluesky" });
  }
  const external =
    e?.external?.uri && e.external.title
      ? { title: e.external.title, uri: e.external.uri, thumb: e.external.thumb }
      : null;
  return { images, external };
}

function rel(d: Date, now: number): string {
  const m = Math.max(1, Math.round((now - d.getTime()) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function TheWire({
  episodes = [],
  maxEntries = 12,
}: {
  episodes?: WireEpisode[];
  /** how many timeline entries to show - the front page passes the fixtures
   *  column's row count so the two columns run the same length (founder
   *  2026-09-14) */
  maxEntries?: number;
}) {
  const [posts, setPosts] = useState<WirePost[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch(FEED_URL);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          feed?: {
            post?: {
              uri: string;
              likeCount?: number;
              indexedAt: string;
              record?: { text?: string; createdAt?: string };
              embed?: EmbedView;
            };
          }[];
        };
        const next = (data.feed ?? [])
          .map((f) => f.post)
          .filter((p): p is NonNullable<typeof p> => !!p)
          .map((p) => ({
            text: p.record?.text ?? "",
            date: new Date(p.record?.createdAt ?? p.indexedAt),
            likes: p.likeCount ?? 0,
            url: `${PROFILE_URL}/post/${p.uri.split("/").pop()}`,
            ...parseEmbed(p.embed),
          }))
          .filter((p) => p.text || p.images.length > 0);
        if (alive && next.length > 0) {
          setPosts(next);
          setFailed(false);
        } else if (alive && next.length === 0) {
          setFailed(true);
        }
      } catch {
        if (alive) setFailed(true);
      }
    }
    void load();
    const feedTimer = setInterval(() => void load(), 60_000);
    const clockTimer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      alive = false;
      clearInterval(feedTimer);
      clearInterval(clockTimer);
    };
  }, []);

  // one timeline: Bluesky posts + Spotify episodes, newest first
  type Entry =
    | { kind: "bluesky"; date: Date; post: WirePost }
    | { kind: "spotify"; date: Date; ep: WireEpisode };
  const entries: Entry[] = [
    ...(posts ?? []).map((post): Entry => ({ kind: "bluesky", date: post.date, post })),
    ...episodes.map((ep): Entry => ({ kind: "spotify", date: new Date(ep.dateIso), ep })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, maxEntries);

  const sourceTag = (label: string) => (
    <span className="flex items-baseline gap-2">
      <span className="font-semibold text-red">Arseradio</span>
      <span className="text-[11px] tracking-[0.1em] text-tertiary uppercase">
        {label}
      </span>
    </span>
  );

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b-[3px] border-double border-primary pb-2.5">
        <span className="display text-[26px]">From the wire</span>
        <span className="flex items-baseline gap-3 font-mono text-[13px] tracking-[0.08em] whitespace-nowrap">
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-b border-red text-primary hover:text-red"
          >
            Bluesky →
          </a>
          <a
            href={SPOTIFY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-b border-red text-primary hover:text-red"
          >
            Spotify →
          </a>
        </span>
      </div>

      {entries.map((e) =>
        e.kind === "bluesky" ? (
          <a
            key={e.post.url}
            href={e.post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block border-b border-line px-0.5 pt-4 pb-3.5 transition-colors hover:bg-raised"
          >
            <span className="flex justify-between gap-2.5 font-mono text-[13px] tracking-[0.06em]">
              {sourceTag("Bluesky")}
              <span className="text-tertiary tabular-nums whitespace-nowrap">
                {rel(e.post.date, now)}
              </span>
            </span>
            <span className="mt-1 block text-[15.5px] leading-[1.55]">
              {e.post.text}
            </span>
            {e.post.images.length > 0 && (
              <span
                className={`mt-2.5 grid gap-1.5 ${e.post.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
              >
                {e.post.images.map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element -- Bluesky's
                  // CDN isn't in the pinned remotePatterns; plain img for the feed
                  <img
                    key={img.thumb}
                    src={img.thumb}
                    alt={img.alt}
                    loading="lazy"
                    className="max-h-[220px] w-full border border-line object-cover"
                  />
                ))}
              </span>
            )}
            {e.post.external && (
              <span className="mt-2.5 flex items-center gap-3 border border-line p-2.5">
                {e.post.external.thumb && (
                  // eslint-disable-next-line @next/next/no-img-element -- see above
                  <img
                    src={e.post.external.thumb}
                    alt=""
                    loading="lazy"
                    className="h-12 w-12 shrink-0 border border-line object-cover"
                  />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {e.post.external.title}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-tertiary">
                    {(() => {
                      try {
                        return new URL(e.post.external.uri).hostname;
                      } catch {
                        return e.post.external.uri;
                      }
                    })()}
                  </span>
                </span>
              </span>
            )}
            <span className="mt-1.5 block font-mono text-[12px] tracking-[0.06em] text-tertiary">
              {e.post.likes} {e.post.likes === 1 ? "like" : "likes"} · reply on
              Bluesky →
            </span>
          </a>
        ) : (
          <a
            key={e.ep.url}
            href={e.ep.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block border-b border-line px-0.5 pt-4 pb-3.5 transition-colors hover:bg-raised"
          >
            <span className="flex justify-between gap-2.5 font-mono text-[13px] tracking-[0.06em]">
              {sourceTag("Spotify")}
              <span className="text-tertiary tabular-nums whitespace-nowrap">
                {rel(e.date, now)}
              </span>
            </span>
            <span className="mt-2 flex items-center gap-3">
              {e.ep.image && (
                // eslint-disable-next-line @next/next/no-img-element -- podcast
                // art CDN isn't in the pinned remotePatterns; plain img
                <img
                  src={e.ep.image}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 border border-line object-cover"
                />
              )}
              <span className="min-w-0 text-[15.5px] leading-[1.45] font-semibold">
                {e.ep.title}
              </span>
            </span>
            <span className="mt-1.5 block font-mono text-[12px] tracking-[0.06em] text-tertiary">
              New episode · listen on Spotify →
            </span>
          </a>
        ),
      )}

      {posts ? (
        <p className="mt-3 text-[13.5px] text-tertiary italic">
          Live from the wire · refreshes every minute.
        </p>
      ) : failed ? (
        <p className="mt-4 text-[14.5px] leading-[1.6] text-secondary italic">
          The Bluesky wire is quiet right now.{" "}
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-b border-red text-primary not-italic hover:text-red"
          >
            Follow @{ACTOR} →
          </a>
        </p>
      ) : (
        <p className="mt-4 text-[13.5px] text-tertiary italic">Reading the wire…</p>
      )}
    </div>
  );
}
