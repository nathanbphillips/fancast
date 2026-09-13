"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { track } from "@/lib/track";

/**
 * "Count me in" RSVP toggle (FR-22.1), shared by the /matches hero, the up-next
 * cards, and the flat schedule rows. Optimistic with rollback + toast on
 * failure. Anonymous users get a sign-in link carrying the room as `next`.
 * Presentational states: neutral (not in) / the red "✓ Going" stamp (confirmed).
 */
export function RsvpButton({
  roomId,
  slug,
  initialRsvped,
  signedIn,
  size = "md",
  className = "",
  label = "Count me in",
  variant = "outline",
}: {
  roomId: string;
  slug: string;
  initialRsvped: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
  className?: string;
  /** label for the not-yet-RSVP'd state (e.g. "RSVP for notifications") */
  label?: string;
  /** "primary" = solid CTA; "outline" = quiet box (default); "onInk" = outline
   *  for ink/inverted fills (the featured hero's scheduled block) */
  variant?: "outline" | "primary" | "onInk";
}) {
  const toast = useToast();
  const [rsvped, setRsvped] = useState(initialRsvped);
  const [busy, setBusy] = useState(false);

  const pad =
    size === "sm" ? "px-3.5 py-2 text-[12px]" : "px-4 py-2.5 text-[13px]";
  const idle =
    variant === "primary"
      ? "btn-grad-red"
      : variant === "onInk"
        ? "border-2 border-inverted-fg font-mono tracking-[0.08em] text-inverted-fg"
        : "border border-line text-primary hover:bg-raised";
  // toggled = the Programme stamp; on the ink block it sits on a paper chip
  const stamp = `-rotate-2 border-2 border-red text-red ${
    variant === "onInk" ? "bg-canvas" : ""
  }`;

  if (!signedIn) {
    return (
      <Link
        href={`/signin?next=${encodeURIComponent(`/room/${slug}?rsvp=1`)}`}
        className={`inline-flex shrink-0 items-center justify-center font-semibold transition-colors ${idle} ${pad} ${className}`}
      >
        {label}
      </Link>
    );
  }

  async function toggle() {
    const next = !rsvped;
    setRsvped(next);
    setBusy(true);
    const res = await fetch(`/api/rooms/${roomId}/rsvp`, {
      method: next ? "POST" : "DELETE",
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setRsvped(!next);
      toast("Couldn't update your RSVP. Try again.");
    } else if (next) {
      track("rsvp_created", { roomId });
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={rsvped}
      className={`inline-flex shrink-0 items-center justify-center font-semibold transition-colors disabled:opacity-60 ${pad} ${
        rsvped ? stamp : idle
      } ${className}`}
    >
      {rsvped ? "✓ Going" : label}
    </button>
  );
}
