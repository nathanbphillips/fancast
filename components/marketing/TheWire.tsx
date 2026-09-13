"use client";

import { useEffect, useState } from "react";

/**
 * FROM THE WIRE (Programme front page, right column): the @arseradio.com
 * Bluesky feed, read from Bluesky's public no-auth API on mount and every
 * minute after. Every post is an outbound link to Bluesky. When the feed
 * cannot be reached the column stays honest - a quiet note and the profile
 * link, never fabricated posts. Client-side only; no backend involved.
 */

const ACTOR = "arseradio.com";
const PROFILE_URL = `https://bsky.app/profile/${ACTOR}`;
const FEED_URL = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${ACTOR}&limit=8&filter=posts_no_replies`;

type WirePost = { text: string; date: Date; likes: number; url: string };

function rel(d: Date, now: number): string {
  const m = Math.max(1, Math.round((now - d.getTime()) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function TheWire() {
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
          feed?: { post?: { uri: string; likeCount?: number; indexedAt: string; record?: { text?: string; createdAt?: string } } }[];
        };
        const next = (data.feed ?? [])
          .map((f) => f.post)
          .filter((p): p is NonNullable<typeof p> => !!p)
          .map((p) => ({
            text: p.record?.text ?? "",
            date: new Date(p.record?.createdAt ?? p.indexedAt),
            likes: p.likeCount ?? 0,
            url: `${PROFILE_URL}/post/${p.uri.split("/").pop()}`,
          }))
          .filter((p) => p.text);
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

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2.5 border-b-[3px] border-double border-primary pb-2.5">
        <span className="display text-[26px]">From the wire</span>
        <a
          href={PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-red font-mono text-[13px] tracking-[0.08em] whitespace-nowrap text-primary hover:text-red"
        >
          @{ACTOR} on Bluesky →
        </a>
      </div>

      {posts ? (
        <>
          {posts.map((p) => (
            <a
              key={p.url}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-b border-line px-0.5 pt-4 pb-3.5 transition-colors hover:bg-raised"
            >
              <span className="flex justify-between gap-2.5 font-mono text-[13px] tracking-[0.06em]">
                <span className="font-semibold text-red">Arseradio</span>
                <span className="text-tertiary tabular-nums whitespace-nowrap">
                  {rel(p.date, now)}
                </span>
              </span>
              <span className="mt-1 block text-[15.5px] leading-[1.55]">{p.text}</span>
              <span className="mt-1.5 block font-mono text-[12px] tracking-[0.06em] text-tertiary">
                {p.likes} {p.likes === 1 ? "like" : "likes"} · reply on Bluesky →
              </span>
            </a>
          ))}
          <p className="mt-3 text-[13.5px] text-tertiary italic">
            Live from the wire · refreshes every minute.
          </p>
        </>
      ) : failed ? (
        <p className="mt-4 text-[14.5px] leading-[1.6] text-secondary italic">
          The wire is quiet right now.{" "}
          <a
            href={PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-b border-red text-primary not-italic hover:text-red"
          >
            Follow @{ACTOR} on Bluesky →
          </a>
        </p>
      ) : (
        <p className="mt-4 text-[13.5px] text-tertiary italic">Reading the wire…</p>
      )}
    </div>
  );
}
