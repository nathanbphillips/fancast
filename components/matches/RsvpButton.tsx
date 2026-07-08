"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/Toast";

/**
 * "Count me in" RSVP toggle (FR-22.1), shared by the /matches hero, the up-next
 * cards, and the flat schedule rows. Optimistic with rollback + toast on
 * failure. Anonymous users get a sign-in link carrying the room as `next`.
 * Presentational states: neutral (not in) / green (confirmed).
 */
export function RsvpButton({
  roomId,
  slug,
  initialRsvped,
  signedIn,
  size = "md",
  className = "",
}: {
  roomId: string;
  slug: string;
  initialRsvped: boolean;
  signedIn: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const toast = useToast();
  const [rsvped, setRsvped] = useState(initialRsvped);
  const [busy, setBusy] = useState(false);

  const pad = size === "sm" ? "px-3.5 py-2 text-[12px]" : "px-4 py-2.5 text-[13px]";

  if (!signedIn) {
    return (
      <Link
        href={`/signin?next=${encodeURIComponent(`/room/${slug}`)}`}
        className={`shrink-0 rounded-[9px] border border-line font-semibold text-primary transition-colors hover:bg-raised ${pad} ${className}`}
      >
        Count me in
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
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={rsvped}
      className={`shrink-0 rounded-[9px] border font-semibold transition-colors disabled:opacity-60 ${pad} ${
        rsvped
          ? "border-green/40 bg-green/10 text-green"
          : "border-line text-primary hover:bg-raised"
      } ${className}`}
    >
      {rsvped ? "You're in ✓" : "Count me in"}
    </button>
  );
}
