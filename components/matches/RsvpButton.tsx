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
  /** "primary" = red-gradient CTA; "outline" = subtle pill (default) */
  variant?: "outline" | "primary";
}) {
  const toast = useToast();
  const [rsvped, setRsvped] = useState(initialRsvped);
  const [busy, setBusy] = useState(false);

  const pad =
    size === "sm" ? "px-3.5 py-2 text-[12px]" : "px-4 py-2.5 text-[13px]";
  const idle =
    variant === "primary"
      ? "btn-grad-red text-white"
      : "border border-line text-primary hover:bg-raised";

  if (!signedIn) {
    return (
      <Link
        href={`/signin?next=${encodeURIComponent(`/room/${slug}?rsvp=1`)}`}
        className={`inline-flex shrink-0 items-center justify-center rounded-[9px] font-semibold transition-colors ${idle} ${pad} ${className}`}
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
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={rsvped}
      className={`inline-flex shrink-0 items-center justify-center rounded-[9px] font-semibold transition-colors disabled:opacity-60 ${pad} ${
        rsvped ? "border border-green/40 bg-green/10 text-green" : idle
      } ${className}`}
    >
      {rsvped ? "You're in ✓" : label}
    </button>
  );
}
