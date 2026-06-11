"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Commentator-only affordance on home fixture cards: opens the waiting
 *  room (FR-3.2) and heads straight into it. */
export function OpenWaitingButton({ fixtureId }: { fixtureId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open_waiting", fixtureId }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && body.room) {
      router.push(`/room/${body.room.id}`);
    } else {
      setError(body.error ?? "Couldn't open the room.");
    }
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={open}
        className="flex h-11 items-center rounded-lg border border-gold px-4 text-sm font-semibold text-gold hover:bg-raised disabled:opacity-60"
      >
        {busy ? "Opening…" : "Open waiting room"}
      </button>
      {error && <span className="text-xs text-red">{error}</span>}
    </span>
  );
}
