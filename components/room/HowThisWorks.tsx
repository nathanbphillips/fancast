"use client";

import { useEffect, type ReactNode } from "react";

/**
 * "How this works" listener walkthrough (founder 2026-08-05). A beginner →
 * advanced tour of everything a listener can do in a game-day room, opened from
 * the desktop header button ("How This Works") or the mobile bottom-bar "FAQ"
 * icon. Full-screen takeover on phones; a centered dialog on desktop. Copy
 * compliance (golden rule): "watch" only ever means the reader's own screen; we
 * never show the match.
 */

/** A control name as it appears in the room, so steps point at real buttons. */
function K({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[5px] border border-line bg-inset px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-[0.02em] text-primary">
      {children}
    </span>
  );
}

const SECTIONS: { title: string; body: ReactNode }[] = [
  {
    title: "Listen along",
    body: (
      <>
        This is live fan commentary. Keep the match on your own TV or stream and
        we play the audio alongside it (we never show the game itself). Tap the
        red play button to start, and use the volume slider to set the level.
        Once you&apos;ve listened once, it starts on its own next time you visit.
      </>
    ),
  },
  {
    title: "Sync it to your screen",
    body: (
      <>
        Every TV and stream runs on a slightly different delay. Tap <K>SYNC NOW</K>{" "}
        when what you hear matches what&apos;s on your screen, then fine-tune with{" "}
        <K>−0.5s</K> / <K>+0.5s</K> until it&apos;s spot on. The clock shows the
        game time you&apos;re actually hearing; tap <K>LIVE</K> anytime to jump
        back to the live edge.
      </>
    ),
  },
  {
    title: "Lock your screen with Radio",
    body: (
      <>
        On iPhone/Safari, flip on <K>Radio</K> to keep listening with your screen
        locked or the app in the background. It runs a few seconds behind and
        can&apos;t be synced, so it&apos;s best for casual listening.
      </>
    ),
  },
  {
    title: "Chat with the room",
    body: (
      <>
        Read the live chat and shared links as they land. Sign in to post a
        message, reply to anyone (replies thread underneath), and tap a reaction.
        Paste a link and it turns into a preview card.
      </>
    ),
  },
  {
    title: "Vote and organise the chat",
    body: (
      <>
        Upvote or downvote any message or link. Sort the stream by <K>New</K>,{" "}
        <K>Top</K>, or <K>Controversial</K>, or filter it to just chat or just
        links. See something off? Flag it for the host.
      </>
    ),
  },
  {
    title: "Follow the match",
    body: (
      <>
        Open <K>Stats</K> for live numbers (possession, shots, xG and more),{" "}
        <K>Info</K> for line-ups, team news, venue, weather and referee, and{" "}
        <K>Events</K> for goals and cards as they happen. The host can push a view
        to everyone.
      </>
    ),
  },
  {
    title: "Polls, predictions and ratings",
    body: (
      <>
        In <K>Polls</K>, vote in the host&apos;s polls, predict the final score
        before kickoff, and rate the players at half-time and full-time.
      </>
    ),
  },
  {
    title: "Get on air",
    body: (
      <>
        Tap <K>Call in</K> to raise your hand. The host can bring you on live
        during a break in play. You&apos;ll see your spot in the queue while you
        wait, and you can leave the queue whenever you like.
      </>
    ),
  },
  {
    title: "Handy extras",
    body: (
      <>
        Ask the host a question straight from the chat, switch between dark and
        light with the theme toggle, share the room with a mate, and use the bug
        button if anything looks broken.
      </>
    ),
  },
];

export function HowThisWorks({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How this works"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex bg-canvas/75 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-full w-full flex-col bg-surface shadow-[var(--shadow-raised)] sm:h-auto sm:max-h-[86vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-line"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="display text-[20px] leading-none">How this works</h2>
            <p className="mt-1 text-[12px] text-secondary">
              Everything you can do in the room, from the basics up.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-secondary transition-colors hover:bg-raised hover:text-primary"
          >
            ✕
          </button>
        </header>

        {/* extra bottom padding on mobile so the last of the content (and the
            red button) clears the room's tab bar, which now floats over this
            overlay so people can navigate away without closing it first */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-5">
          <ol className="list-none space-y-5 pl-0">
            {SECTIONS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red font-mono text-xs font-bold text-white tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="display text-[16px] leading-tight">{s.title}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-secondary">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 rounded-xl border border-line bg-raised px-4 py-3 text-[13px] leading-relaxed text-secondary">
            <span className="font-semibold text-primary">On your phone:</span>{" "}
            the bottom bar moves you between FAQ, Chat, Polls, Stats and Call in.
            Tap the audio bar at the top to open the full sync and volume
            controls.
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-grad-red mt-6 flex h-11 w-full items-center justify-center rounded-lg text-sm font-bold text-white"
          >
            Got it, let&apos;s go
          </button>
        </div>
      </div>
    </div>
  );
}
