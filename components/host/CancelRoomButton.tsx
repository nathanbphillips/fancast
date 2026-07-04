"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Cancel a scheduled room from the My rooms dashboard (FR-19.7). Confirm
 *  required; RSVP holders are notified once FR-21 ships. */
export function CancelRoomButton({
  roomId,
  matchLabel,
}: {
  roomId: string;
  matchLabel: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function cancel() {
    if (!window.confirm(`Cancel your room for ${matchLabel}?`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/rooms/${roomId}`, { method: "DELETE" }).catch(
      () => null,
    );
    setBusy(false);
    if (!res?.ok) {
      const body = await res?.json().catch(() => ({}));
      setError(body?.error ?? "Couldn't cancel.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={busy}
        className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-secondary transition-colors hover:border-red/50 hover:text-red disabled:opacity-60"
      >
        {busy ? "Canceling…" : "Cancel"}
      </button>
      {error && <span className="text-xs text-red">{error}</span>}
    </span>
  );
}
