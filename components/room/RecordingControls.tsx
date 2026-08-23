"use client";

import { useEffect, useState } from "react";

/**
 * Host control for pausing the RECORDING (founder 2026-08-22). The broadcast
 * and radio stay live; only the produced files skip the paused stretch. The
 * state is shared between co-hosts (DB is truth, the control channel carries
 * it), so this component never guesses: it posts, and the room's `recording`
 * event moves the indicator. Pauses are final. The mic is deliberately NOT
 * touched here: a host who wants an on-air break mutes separately, and only
 * then do listeners see the "back shortly" card.
 */
export function RecordingControls({
  roomId,
  pausedSince,
  onState,
}: {
  roomId: string;
  /** ISO time the recording was paused at, null while recording */
  pausedSince: string | null;
  /** confirmed state from the server response (the control event normally
   *  carries the same thing; this keeps the tapping tab right if it does not) */
  onState: (pausedSince: string | null, at: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paused = pausedSince !== null;

  // elapsed-in-pause ticker: local render only, never sent over the wire
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!paused) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);
  const elapsed = paused ? Math.max(0, Math.floor((now - Date.parse(pausedSince)) / 1000)) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/recording-pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action: paused ? "resume" : "pause" }),
      });
      const body = (await res.json().catch(() => null)) as
        | { error?: string; paused?: boolean; since?: string | null; at?: string }
        | null;
      if (!res.ok) {
        setError(body?.error ?? "Could not update the recording.");
      } else if (body && typeof body.paused === "boolean") {
        onState(body.paused ? (body.since ?? null) : null, body.at ?? null);
      }
    } catch {
      setError("Could not update the recording.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span
        // paused = inverted pill: unmistakable next to the red REC chip and AA
        // in both themes (the yellow-card amber is 1.9:1 on the light surface)
        className={`flex h-9 items-center gap-1.5 rounded-md border px-2 font-mono text-[10px] tracking-[0.06em] tabular-nums ${
          paused ? "border-inverted bg-inverted text-inverted-fg" : "border-line text-secondary"
        }`}
        title={
          paused
            ? "The recording is paused. The broadcast is still live for listeners."
            : "The broadcast is being recorded."
        }
      >
        <span
          aria-hidden="true"
          className={`h-[6px] w-[6px] rounded-full ${paused ? "bg-inverted-fg" : "animate-fcpulse bg-red"}`}
        />
        {/* the state change is announced once; the ticking clock is not */}
        <span className="sr-only" aria-live="polite">
          {paused ? "Recording paused" : "Recording"}
        </span>
        <span aria-hidden="true">{paused ? `REC PAUSED ${mm}:${ss}` : "REC"}</span>
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        title={
          paused
            ? "Recording picks up again from here"
            : "Listeners keep hearing you; the recording skips until you resume"
        }
        className={`h-9 rounded-md px-3 text-xs font-semibold disabled:opacity-60 ${
          paused
            ? "bg-red text-white"
            : "border border-line text-secondary hover:text-primary"
        }`}
      >
        {paused ? "Resume recording" : "Pause recording"}
      </button>
      {error && <span className="text-[10px] text-red">{error}</span>}
    </div>
  );
}
