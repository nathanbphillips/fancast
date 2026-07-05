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
  const [menu, setMenu] = useState<"none" | "overflow" | "report">("none");
  const [notice, setNotice] = useState<string | null>(null);
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
    setMenu("none");
    setNotice(null);
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

  async function toggleBlock() {
    if (!card) return;
    setBusy(true);
    const method = card.blocked ? "DELETE" : "POST";
    const res = await fetch(`/api/blocks/${card.userId}`, { method }).catch(
      () => null,
    );
    setBusy(false);
    if (res?.ok) {
      const next = {
        ...card,
        blocked: !card.blocked,
        // a block severs friendship + follow both ways
        friend: card.blocked ? card.friend : ("none" as const),
        following: card.blocked ? card.following : false,
      };
      cardCache.set(username, next);
      setCard(next);
      setNotice(next.blocked ? "Blocked." : "Unblocked.");
      setMenu("none");
    }
  }

  async function report(reason: string) {
    if (!card) return;
    setBusy(true);
    const res = await fetch("/api/profile/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: card.userId, reason }),
    }).catch(() => null);
    setBusy(false);
    setNotice(res?.ok ? "Report sent. Thanks." : "Couldn't send the report.");
    setMenu("none");
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
                {card.signedIn && (
                  <button
                    type="button"
                    aria-label="More actions"
                    onClick={() =>
                      setMenu((m) => (m === "none" ? "overflow" : "none"))
                    }
                    className="rounded-lg border border-line px-2 py-1.5 text-xs font-bold text-secondary hover:bg-raised"
                  >
                    ⋯
                  </button>
                )}
              </div>

              {/* overflow: report (all) + block (listeners), FR-26.4 */}
              {menu === "overflow" && (
                <div className="mt-2 space-y-1 border-t border-line/60 pt-2">
                  <button
                    type="button"
                    onClick={() => setMenu("report")}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-secondary hover:bg-raised"
                  >
                    Report
                  </button>
                  {!card.isHost && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleBlock()}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-red hover:bg-red/10 disabled:opacity-60"
                    >
                      {card.blocked ? "Unblock" : "Block"}
                    </button>
                  )}
                </div>
              )}

              {menu === "report" && (
                <div className="mt-2 space-y-1 border-t border-line/60 pt-2">
                  <p className="px-2 py-1 text-[11px] text-secondary">
                    Report for:
                  </p>
                  {[
                    ["impersonation", "Impersonation"],
                    ["abuse", "Abuse or harassment"],
                    ["spam", "Spam"],
                    ["inappropriate_content", "Inappropriate content"],
                    ["other", "Something else"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={busy}
                      onClick={() => void report(value)}
                      className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-raised disabled:opacity-60"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {notice && (
                <p className="mt-2 text-center text-[11px] text-secondary">
                  {notice}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
