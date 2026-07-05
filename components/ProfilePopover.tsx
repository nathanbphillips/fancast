"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";

/**
 * In-room profile popover (FR-26). Tapping a chat avatar or host badge opens a
 * client-rendered card over the room (never interrupts audio). One open at a
 * time; dismiss on outside tap or Esc; content cached per user per session; no
 * popover for your own avatar. Anonymous viewers get the join prompt.
 */

type Card = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  aboutSnippet: string | null;
  isHost: boolean;
  followerCount: number;
  fanScore: number;
  matchesAttended: number;
  isSelf: boolean;
  signedIn: boolean;
  following: boolean;
  friend: "self" | "none" | "requested" | "incoming" | "friends";
  blocked: boolean;
};

// per-session cache + a one-at-a-time signal
const cardCache = new Map<string, Card>();
let openCounter = 0;

export function ProfilePopover({
  username,
  children,
  className = "",
}: {
  username: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<Card | null>(cardCache.get(username) ?? null);
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onOther(e: Event) {
      if ((e as CustomEvent).detail !== idRef.current) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("fc-popover-open", onOther as EventListener);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("fc-popover-open", onOther as EventListener);
    };
  }, [open]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    idRef.current = ++openCounter;
    window.dispatchEvent(
      new CustomEvent("fc-popover-open", { detail: idRef.current }),
    );
    setOpen(true);
    if (!cardCache.has(username)) {
      const res = await fetch(`/api/profiles/${username}/card`).catch(() => null);
      if (res?.ok) {
        const c = (await res.json()) as Card;
        cardCache.set(username, c);
        setCard(c);
      }
    } else {
      setCard(cardCache.get(username)!);
    }
  }

  async function follow() {
    if (!card) return;
    setBusy(true);
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentatorId: card.userId }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      const next = { ...card, following: true };
      cardCache.set(username, next);
      setCard(next);
    }
  }

  async function addFriend() {
    if (!card) return;
    setBusy(true);
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: card.userId }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      const next = { ...card, friend: "requested" as const };
      cardCache.set(username, next);
      setCard(next);
    }
  }

  // own avatar links straight to the profile, no popover (FR-26.5)
  if (card?.isSelf) {
    return (
      <Link href={`/${username}`} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Profile: ${username}`}
        className={className}
      >
        {children}
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-line bg-surface p-3 shadow-raised"
        >
          {!card ? (
            <p className="py-4 text-center text-xs text-secondary">Loading…</p>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Avatar src={card.avatarUrl} name={card.username} size={40} />
                <div className="min-w-0">
                  <Link
                    href={`/${card.username}`}
                    className={`block truncate text-sm font-bold ${card.isHost ? "text-gold" : ""}`}
                  >
                    {card.username}
                  </Link>
                  <p className="text-[11px] text-secondary tabular-nums">
                    {card.isHost
                      ? `${card.followerCount} follower${card.followerCount === 1 ? "" : "s"}`
                      : `Fan score ${card.fanScore} · ${card.matchesAttended} attended`}
                  </p>
                </div>
              </div>

              {card.aboutSnippet && (
                <p className="mt-2 text-[12px] leading-snug text-secondary">
                  {card.aboutSnippet}
                </p>
              )}

              <div className="mt-3 flex items-center gap-2">
                {!card.signedIn ? (
                  <Link
                    href="/signin"
                    className="flex-1 rounded-lg bg-red px-3 py-1.5 text-center text-xs font-bold text-white"
                  >
                    {card.isHost ? "Sign in to follow" : "Sign in to add"}
                  </Link>
                ) : card.isHost ? (
                  <button
                    type="button"
                    disabled={busy || card.following}
                    onClick={() => void follow()}
                    className="flex-1 rounded-lg bg-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {card.following ? "Following" : "Follow"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy || card.friend !== "none"}
                    onClick={() => void addFriend()}
                    className="flex-1 rounded-lg bg-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                  >
                    {card.friend === "friends"
                      ? "Friends"
                      : card.friend === "requested"
                        ? "Requested"
                        : card.friend === "incoming"
                          ? "Respond"
                          : "Add friend"}
                  </button>
                )}
                <Link
                  href={`/${card.username}`}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:bg-raised"
                >
                  View
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
