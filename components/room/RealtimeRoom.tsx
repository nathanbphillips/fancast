"use client";

import { useEffect, useRef, useState } from "react";
import * as Ably from "ably";
import type { ChatMessage, Link } from "@/lib/db/types";
import { StatsPanel } from "@/components/StatsPanel";

/**
 * Live room (Phase 3): chat + links over Ably, DB as source of truth.
 * Subscribe-only realtime; every write POSTs to an API route. Channel
 * attach uses rewind so reconnects replay recent history; id-dedupe makes
 * that safe alongside our own POST responses.
 */

export type Viewer = {
  userId: string;
  username: string;
  role: "listener" | "commentator" | "admin";
  isModerator: boolean; // room commentator or admin
} | null;

type Props = {
  roomId: string;
  viewer: Viewer;
  initialMessages: ChatMessage[];
  initialLinks: Link[];
  myMessageVotes: Record<string, 1 | -1>;
  myLinkVotes: Record<string, 1 | -1>;
};

type ConnState = "connecting" | "connected" | "broken";

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "stats", label: "Stats" },
  { id: "links", label: "Links" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function RealtimeRoom(props: Props) {
  const [tab, setTab] = useState<TabId>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>(props.initialMessages);
  const [links, setLinks] = useState<Link[]>(props.initialLinks);
  const [watching, setWatching] = useState<number | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");

  // sender-side append: own messages render from the POST response,
  // never waiting on the realtime echo
  const appendMessage = (m: ChatMessage) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  const appendLink = (l: Link) =>
    setLinks((prev) => (prev.some((x) => x.id === l.id) ? prev : [l, ...prev]));

  useEffect(() => {
    const client = new Ably.Realtime({
      authUrl: `/api/ably/token?room=${props.roomId}`,
      authMethod: "GET",
    });

    client.connection.on("connected", () => setConn("connected"));
    client.connection.on(["disconnected", "suspended", "failed"], () =>
      setConn("broken"),
    );

    const chat = client.channels.get(`room:${props.roomId}:chat`, {
      params: { rewind: "50" },
    });
    const linksCh = client.channels.get(`room:${props.roomId}:links`, {
      params: { rewind: "25" },
    });

    chat.subscribe("message", (msg) => {
      appendMessage(msg.data as ChatMessage);
    });
    chat.subscribe("vote", (msg) => {
      const { messageId, up, down } = msg.data as {
        messageId: string;
        up: number;
        down: number;
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, up_count: up, down_count: down } : m,
        ),
      );
    });
    chat.subscribe("hide", (msg) => {
      const { messageId, hiddenBy } = msg.data as {
        messageId: string;
        hiddenBy: ChatMessage["hidden_by"];
      };
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, hidden_by: hiddenBy } : m)),
      );
    });

    linksCh.subscribe("link", (msg) => {
      appendLink(msg.data as Link);
    });
    linksCh.subscribe("vote", (msg) => {
      const { linkId, up, down, hidden } = msg.data as {
        linkId: string;
        up: number;
        down: number;
        hidden: boolean;
      };
      setLinks((prev) =>
        prev.map((l) =>
          l.id === linkId ? { ...l, up_count: up, down_count: down, hidden } : l,
        ),
      );
    });

    // presence = watching count (everyone enters, including anonymous)
    const refreshPresence = async () => {
      const members = await chat.presence.get();
      setWatching(members.length);
    };
    chat.presence.subscribe(["enter", "leave"], refreshPresence);
    chat.presence.enter().then(refreshPresence).catch(() => {});

    return () => {
      chat.presence.leave().catch(() => {});
      client.close();
    };
  }, [props.roomId]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label="Room sections" className="flex border-b border-line bg-surface lg:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`h-11 flex-1 text-sm font-semibold transition-colors ${
              tab === t.id ? "border-b-2 border-gold text-primary" : "text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* each panel renders exactly once; tab (mobile) and breakpoint (desktop)
          control visibility via CSS so input state survives layout changes */}
      <div className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:grid lg:w-full lg:max-w-7xl lg:grid-cols-[1fr_2fr_1fr]">
        <aside
          aria-label="Stats"
          className={`${tab === "stats" ? "block" : "hidden"} min-h-0 overflow-y-auto lg:block lg:border-r lg:border-line`}
        >
          <StatsPanel />
        </aside>
        <section
          aria-label="Chat"
          className={`${tab === "chat" ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}
        >
          <LiveChat
            roomId={props.roomId}
            viewer={props.viewer}
            messages={messages}
            myVotes={props.myMessageVotes}
            watching={watching}
            conn={conn}
            onSent={appendMessage}
          />
        </section>
        <aside
          aria-label="Links"
          className={`${tab === "links" ? "block" : "hidden"} min-h-0 overflow-y-auto lg:block lg:border-l lg:border-line`}
        >
          <LiveLinks
            roomId={props.roomId}
            viewer={props.viewer}
            links={links}
            myVotes={props.myLinkVotes}
            onSubmitted={appendLink}
          />
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ chat */

function VoteArrows({
  up,
  down,
  myVote,
  disabled,
  onVote,
}: {
  up: number;
  down: number;
  myVote: 1 | -1 | undefined;
  disabled: boolean;
  onVote: (v: 1 | -1 | 0) => void;
}) {
  return (
    <span className="flex shrink-0 flex-col items-center text-secondary">
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={myVote === 1}
        disabled={disabled}
        onClick={() => onVote(myVote === 1 ? 0 : 1)}
        className={`flex h-5 w-6 items-center justify-center hover:text-green ${myVote === 1 ? "text-green" : ""}`}
      >
        <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 fill-current"><path d="M6 0l6 8H0z" /></svg>
      </button>
      <span className="text-xs font-semibold tabular-nums">{up - down}</span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={myVote === -1}
        disabled={disabled}
        onClick={() => onVote(myVote === -1 ? 0 : -1)}
        className={`flex h-5 w-6 items-center justify-center hover:text-red ${myVote === -1 ? "text-red" : ""}`}
      >
        <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 fill-current"><path d="M6 8L0 0h12z" /></svg>
      </button>
    </span>
  );
}

function LiveChat({
  roomId,
  viewer,
  messages,
  myVotes,
  watching,
  conn,
  onSent,
}: {
  roomId: string;
  viewer: Viewer;
  messages: ChatMessage[];
  myVotes: Record<string, 1 | -1>;
  watching: number | null;
  conn: ConnState;
  onSent: (m: ChatMessage) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [votes, setVotes] = useState(myVotes);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setNotice(null);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, body: draft.trim() }),
    });
    setSending(false);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.message) onSent(body.message);
      setDraft("");
    } else {
      const body = await res.json().catch(() => ({}));
      setNotice(body.error ?? "Couldn't send — try again.");
    }
  }

  async function vote(messageId: string, value: 1 | -1 | 0) {
    setVotes((prev) => {
      const next = { ...prev };
      if (value === 0) delete next[messageId];
      else next[messageId] = value;
      return next;
    });
    await fetch("/api/chat/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, value }),
    });
  }

  async function flag(messageId: string) {
    setFlagged((prev) => new Set(prev).add(messageId));
    const res = await fetch("/api/chat/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) setNotice(body.error);
    }
  }

  async function hide(messageId: string) {
    await fetch("/api/chat/hide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="text-xs text-secondary tabular-nums">
          {watching !== null
            ? `${watching} watching`
            : conn === "connecting"
              ? "connecting…"
              : conn === "broken"
                ? "live updates unavailable — refresh to retry"
                : "…"}
        </span>
      </div>

      <ul ref={listRef} className="flex-1 space-y-1 overflow-y-auto p-2">
        {messages.map((m) => {
          if (m.hidden_by) {
            return (
              <li key={m.id} className="rounded-lg px-3 py-2 text-xs text-secondary italic">
                Message hidden{m.hidden_by === "flags" ? " by community flags" : ""}
              </li>
            );
          }
          const isCommentator = m.author?.role === "commentator";
          const isOwn = viewer?.userId === m.user_id;
          return (
            <li
              key={m.id}
              className={`group flex items-start gap-2 rounded-lg px-3 py-2 ${
                isCommentator
                  ? "border-l-[3px] border-gold bg-raised"
                  : isOwn
                    ? "bg-raised/60"
                    : ""
              }`}
            >
              <VoteArrows
                up={m.up_count}
                down={m.down_count}
                myVote={votes[m.id]}
                disabled={!viewer}
                onVote={(v) => vote(m.id, v)}
              />
              <p className="min-w-0 flex-1 text-sm leading-relaxed">
                <span className={`mr-2 font-semibold ${isCommentator ? "text-gold" : "text-secondary"}`}>
                  {m.author?.username ?? "…"}
                </span>
                {isCommentator && (
                  <span className="mr-2 rounded-sm bg-gold px-1 py-0.5 align-middle text-[10px] font-bold text-canvas">
                    COMMENTATOR
                  </span>
                )}
                {m.body}
              </p>
              {viewer && !isOwn && !flagged.has(m.id) && (
                <button
                  type="button"
                  aria-label="Flag message"
                  title="Flag message"
                  onClick={() => flag(m.id)}
                  className="px-1 text-xs text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:text-red focus-visible:opacity-100"
                >
                  ⚑
                </button>
              )}
              {viewer?.isModerator && (
                <button
                  type="button"
                  aria-label="Hide message"
                  title="Hide message"
                  onClick={() => hide(m.id)}
                  className="px-1 text-xs text-secondary hover:text-red"
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
        {messages.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-secondary">
            Nothing here yet — say hello.
          </li>
        )}
      </ul>

      {!viewer ? (
        <div className="border-t border-line p-3">
          <div className="rounded-xl border-[0.75px] border-line bg-raised p-4 text-center">
            <p className="text-sm text-secondary">
              You&apos;re listening as a guest. Join in to chat, vote, ask
              questions, and request to talk.
            </p>
            <a
              href="/signin"
              className="mt-3 inline-flex h-11 items-center rounded-lg bg-red px-5 text-sm font-semibold text-white"
            >
              Sign in to join
            </a>
          </div>
        </div>
      ) : (
        <div className="border-t border-line p-3">
          {notice && (
            <p role="alert" className="mb-2 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-secondary">
              {notice}
            </p>
          )}
          <form onSubmit={send} className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder="Say something"
              aria-label="Chat message"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="h-11 shrink-0 rounded-lg bg-red px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Send
            </button>
          </form>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" disabled title="Phase 4" className="h-11 flex-1 rounded-lg border border-line bg-surface text-sm disabled:opacity-60">
              Ask Question
            </button>
            <button type="button" disabled title="Phase 4" className="h-11 flex-1 rounded-lg border border-line bg-surface text-sm disabled:opacity-60">
              Request to Talk
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- links */

function LiveLinks({
  roomId,
  viewer,
  links,
  myVotes,
  onSubmitted,
}: {
  roomId: string;
  viewer: Viewer;
  links: Link[];
  myVotes: Record<string, 1 | -1>;
  onSubmitted: (l: Link) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [votes, setVotes] = useState(myVotes);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, url: draft.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.link) onSubmitted(body.link);
      setDraft("");
    } else {
      const body = await res.json().catch(() => ({}));
      setNotice(body.error ?? "Couldn't submit that link.");
    }
  }

  async function vote(linkId: string, value: 1 | -1 | 0) {
    setVotes((prev) => {
      const next = { ...prev };
      if (value === 0) delete next[linkId];
      else next[linkId] = value;
      return next;
    });
    await fetch("/api/links/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId, value }),
    });
  }

  return (
    <div className="space-y-2 p-3">
      {viewer && (
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a link"
            aria-label="Submit a link"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="h-11 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-raised disabled:opacity-60"
          >
            {busy ? "…" : "Add"}
          </button>
        </form>
      )}
      {notice && (
        <p role="alert" className="rounded-lg border border-red/40 bg-surface px-3 py-2 text-xs text-red">
          {notice}
        </p>
      )}
      <ul className="space-y-2">
        {links
          .filter((l) => !l.hidden)
          .map((link) => (
            <li
              key={link.id}
              className="flex items-center gap-3 rounded-xl border-[0.75px] border-line bg-surface p-3"
            >
              {link.og_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={link.og_image}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="h-10 w-10 shrink-0 rounded-lg bg-raised" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="block truncate text-sm font-semibold hover:underline"
                >
                  {link.og_title ?? link.url}
                </a>
                <p className="text-xs text-secondary">{link.domain}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Upvote link"
                  aria-pressed={votes[link.id] === 1}
                  disabled={!viewer}
                  onClick={() => vote(link.id, votes[link.id] === 1 ? 0 : 1)}
                  className={`px-1 text-xs font-semibold ${votes[link.id] === 1 ? "text-green" : "text-secondary hover:text-green"}`}
                >
                  ▲
                </button>
                <span className="text-xs font-semibold tabular-nums">
                  {link.up_count - link.down_count}
                </span>
                <button
                  type="button"
                  aria-label="Downvote link"
                  aria-pressed={votes[link.id] === -1}
                  disabled={!viewer}
                  onClick={() => vote(link.id, votes[link.id] === -1 ? 0 : -1)}
                  className={`px-1 text-xs font-semibold ${votes[link.id] === -1 ? "text-red" : "text-secondary hover:text-red"}`}
                >
                  ▼
                </button>
              </span>
            </li>
          ))}
        {links.filter((l) => !l.hidden).length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-secondary">
            No links yet{viewer ? " — paste the first one." : "."}
          </li>
        )}
      </ul>
    </div>
  );
}
