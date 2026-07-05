"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Pending co-host invites TO the current user (FR-25.1): accept or decline. */
export type CohostInvite = {
  roomId: string;
  matchLabel: string;
  inviterName: string;
};

export function CohostInvites({ invites }: { invites: CohostInvite[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function respond(roomId: string, action: "accept" | "decline") {
    setBusy(roomId);
    await fetch(`/api/rooms/${roomId}/cohost-respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    setBusy(null);
    router.refresh();
  }

  if (invites.length === 0) return null;

  return (
    <section aria-label="Co-host invites" className="mb-8">
      <h2 className="mb-2 font-mono text-[11px] font-bold tracking-[0.14em] text-gold uppercase">
        Co-host invites
      </h2>
      <div className="overflow-hidden rounded-2xl border border-gold/40 bg-surface">
        {invites.map((i) => (
          <div
            key={i.roomId}
            className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold tracking-[-0.01em]">
                {i.matchLabel}
              </span>
              <span className="block truncate font-mono text-[10px] text-secondary uppercase">
                @{i.inviterName} invited you to co-host
              </span>
            </span>
            <button
              type="button"
              disabled={busy === i.roomId}
              onClick={() => void respond(i.roomId, "accept")}
              className="rounded-md bg-red px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              Accept
            </button>
            <button
              type="button"
              disabled={busy === i.roomId}
              onClick={() => void respond(i.roomId, "decline")}
              className="rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-secondary disabled:opacity-60"
            >
              Decline
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
