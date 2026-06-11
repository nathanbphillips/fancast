"use client";

import { useState } from "react";
import type { RoomState, TalkRequest } from "@/lib/db/types";

/**
 * Commentator command strip (docs/DESIGN.md: ~70-80px desktop bar).
 * Left: room status. Center: pending talk-request cards with
 * Accept/Dismiss (FR-4.2). Right: the state-machine button.
 * Phase 5 adds mic controls, self-delay, and speaker chips.
 */

const LIVE_STATES: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

const STATUS_LABEL: Partial<Record<RoomState, string>> = {
  waiting: "Waiting room open",
  pregame: "On air — pre-game",
  live_1h: "On air — first half",
  halftime: "On air — halftime",
  live_2h: "On air — second half",
  extra_time: "On air — extra time",
  postgame: "On air — post-game",
  wrapped: "Show ended",
};

export function CommentatorBar({
  roomId,
  state,
  requests,
  onRequestHandled,
}: {
  roomId: string;
  state: RoomState;
  requests: TalkRequest[];
  onRequestHandled: (id: string, status: "accepted" | "dismissed") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(action: "start" | "end") {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, roomId }),
    });
    setBusy(false);
    setConfirmEnd(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong.");
    }
    // success needs no local update — the control channel event lands on
    // every client including this one
  }

  async function handleRequest(id: string, status: "accepted" | "dismissed") {
    onRequestHandled(id, status); // optimistic
    await fetch("/api/talk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id, status }),
    });
  }

  const live = LIVE_STATES.includes(state);

  return (
    <div className="flex min-h-[70px] flex-wrap items-center gap-3 px-4 py-2">
      <div className="shrink-0">
        <p className="text-xs font-bold tracking-wide text-gold uppercase">
          Commentator
        </p>
        <p className="text-sm font-semibold">{STATUS_LABEL[state] ?? state}</p>
        {error && <p className="text-xs text-red">{error}</p>}
      </div>

      {/* center zone: pending talk requests */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {live &&
          requests.map((r) => (
            <div
              key={r.id}
              className="flex shrink-0 items-center gap-2 rounded-lg border-[0.75px] border-line bg-raised px-3 py-1.5"
            >
              <div className="max-w-[180px]">
                <p className="truncate text-xs font-semibold">
                  {r.author?.username}
                </p>
                <p className="truncate text-xs text-secondary">{r.topic}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRequest(r.id, "accepted")}
                className="h-9 rounded-md bg-green px-2.5 text-xs font-bold text-white"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => handleRequest(r.id, "dismissed")}
                aria-label={`Dismiss request from ${r.author?.username}`}
                className="h-9 rounded-md border border-line px-2.5 text-xs font-semibold text-secondary hover:text-primary"
              >
                Dismiss
              </button>
            </div>
          ))}
      </div>

      <div className="shrink-0">
        {state === "waiting" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => transition("start")}
            title="Mic check arrives in Phase 5 — starting opens chat, links, and questions for everyone"
            className="h-11 rounded-lg bg-red px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            Start Broadcast
          </button>
        )}
        {live &&
          (confirmEnd ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => transition("end")}
                className="h-11 rounded-lg bg-red px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                Confirm end
              </button>
              <button
                type="button"
                onClick={() => setConfirmEnd(false)}
                className="h-11 rounded-lg border border-line px-3 text-sm"
              >
                Keep going
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              className="h-11 rounded-lg border border-line px-5 text-sm font-semibold hover:bg-raised"
            >
              End Broadcast
            </button>
          ))}
      </div>
    </div>
  );
}
