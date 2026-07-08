"use client";

import { useState } from "react";
import type { RoomState, TalkRequest } from "@/lib/db/types";
import { CallerActions } from "./CallerActions";

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

/** ISO -> value for <input type="datetime-local"> in the local timezone. */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CommentatorBar({
  roomId,
  state,
  requests,
  onRequestHandled,
  broadcastStart,
  chatOpen,
  linksOpen,
  micControls,
  speakerChips,
  clockControls,
  startDisabled = false,
}: {
  roomId: string;
  state: RoomState;
  requests: TalkRequest[];
  onRequestHandled: (id: string, status: "accepted" | "dismissed") => void;
  broadcastStart: string | null;
  chatOpen: boolean;
  linksOpen: boolean;
  /** Phase 5 audio slots */
  micControls?: React.ReactNode;
  speakerChips?: React.ReactNode;
  /** Phase 6 clock controls slot */
  clockControls?: React.ReactNode;
  /** FR-3.3: Start Broadcast requires a live mic */
  startDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState(() =>
    toLocalInputValue(broadcastStart),
  );
  const [startStatus, setStartStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const [startError, setStartError] = useState<string | null>(null);

  /** Commit the drafted start time (explicit action — never on keystroke). */
  async function saveBroadcastStart(value: string | null) {
    setStartError(null);
    setStartStatus("idle");
    if (value) {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        setStartError("That doesn't look like a valid time.");
        setStartStatus("error");
        return;
      }
      if (parsed.getTime() < Date.now()) {
        setStartError("That time is in the past — pick a future time.");
        setStartStatus("error");
        return;
      }
    }
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_broadcast_start",
        roomId,
        broadcastStart: value ? new Date(value).toISOString() : null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStartError(body.error ?? "Couldn't set the start time.");
      setStartStatus("error");
      return;
    }
    if (!value) setStartDraft("");
    setStartStatus("saved");
    setTimeout(() => setStartStatus("idle"), 2500);
  }

  async function toggleFeature(feature: "chatOpen" | "linksOpen", next: boolean) {
    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_features", roomId, [feature]: next }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't update that.");
    }
    // the control-channel `features` event updates every client incl. us
  }

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
        <p className="font-display text-[11px] font-bold tracking-wider text-secondary uppercase">
          Status
        </p>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="font-display text-red uppercase">Commentator</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide text-green uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-green" />
            Connected
          </span>
        </p>
        <p className="text-xs text-secondary">{STATUS_LABEL[state] ?? state}</p>
        {error && <p className="text-xs text-red">{error}</p>}
      </div>

      {/* center zone: waiting-room setup, then pending talk requests */}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {state === "waiting" && (
          <>
            <div className="flex shrink-0 items-center gap-2 rounded-lg border-[0.75px] border-line bg-raised px-3 py-1.5 text-xs">
              <label className="flex items-center gap-2">
                <span className="font-semibold text-secondary">Start time</span>
                <input
                  type="datetime-local"
                  value={startDraft}
                  min={toLocalInputValue(new Date().toISOString())}
                  onChange={(e) => setStartDraft(e.target.value)}
                  aria-label="Planned broadcast start time"
                  className="h-8 rounded-md border border-line bg-surface px-2 text-xs tabular-nums"
                />
              </label>
              <button
                type="button"
                disabled={!startDraft}
                onClick={() => saveBroadcastStart(startDraft)}
                className="h-8 rounded-md bg-red px-2.5 font-bold text-white disabled:opacity-60"
              >
                Set
              </button>
              {broadcastStart && (
                <button
                  type="button"
                  onClick={() => saveBroadcastStart(null)}
                  className="h-8 rounded-md border border-line px-2 text-secondary hover:text-primary"
                >
                  Clear
                </button>
              )}
              {startStatus === "saved" && (
                <span className="font-semibold text-green">✓ set</span>
              )}
              {startStatus === "error" && startError && (
                <span role="alert" className="max-w-[200px] text-red">
                  {startError}
                </span>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={chatOpen}
              onClick={() => toggleFeature("chatOpen", !chatOpen)}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${
                chatOpen
                  ? "border-green text-green"
                  : "border-line bg-raised text-secondary hover:text-primary"
              }`}
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${chatOpen ? "bg-green" : "bg-line"}`} />
              Chat {chatOpen ? "open" : "closed"}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={linksOpen}
              onClick={() => toggleFeature("linksOpen", !linksOpen)}
              className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${
                linksOpen
                  ? "border-green text-green"
                  : "border-line bg-raised text-secondary hover:text-primary"
              }`}
            >
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${linksOpen ? "bg-green" : "bg-line"}`} />
              Links {linksOpen ? "open" : "closed"}
            </button>
          </>
        )}
        {live &&
          requests.map((r) => (
            <div
              key={r.id}
              className="flex shrink-0 items-center gap-2 rounded-lg border-[0.75px] border-line bg-raised px-3 py-1.5"
            >
              <div className="max-w-[200px]">
                <p className="truncate text-xs font-semibold">
                  {r.author?.username}
                  {(r.caller_flags?.count ?? 0) > 0 && (
                    <span
                      className="ml-1.5 rounded-sm bg-red px-1 py-0.5 text-[10px] font-bold text-white"
                      title={r.caller_flags!.notes
                        .map((n) => `${n.by}: ${n.note ?? "(no note)"}`)
                        .join("\n")}
                    >
                      ⚑ {r.caller_flags!.count}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-secondary">{r.topic}</p>
                {(r.caller_flags?.count ?? 0) > 0 && r.caller_flags!.notes[0] && (
                  <p className="truncate text-[10px] text-red">
                    “{r.caller_flags!.notes[0].note ?? "flagged"}” —{" "}
                    {r.caller_flags!.notes[0].by}
                  </p>
                )}
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
              <CallerActions
                userId={r.user_id}
                username={r.author?.username ?? "caller"}
                roomId={roomId}
              />
            </div>
          ))}
      </div>

      {clockControls}
      {speakerChips}
      {micControls}

      <div className="shrink-0">
        {state === "waiting" && (
          <button
            type="button"
            disabled={busy || startDisabled}
            onClick={() => transition("start")}
            title={
              startDisabled
                ? "Start your mic first — the broadcast needs a live mic (FR-3.3)"
                : "Opens chat, links, and questions for everyone"
            }
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
