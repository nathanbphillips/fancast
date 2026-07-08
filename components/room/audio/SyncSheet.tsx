"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deriveClock,
  formatClock,
  type ClockEventInput,
} from "@/lib/clock";

/**
 * "Sync to my TV" sheet (FR-6.2/6.3).
 *
 * Calibration mechanic: opening the sheet freezes a target moment (the
 * live-edge match clock right then). The viewer's TV is behind, so that
 * moment is still coming for them — when their TV reaches it, they tap
 * Now. Their lag is exactly the wall time between open and tap, measured
 * to the millisecond, applied immediately, persisted per session.
 * (The PRD's ticking reference clock is shown beneath the frozen target;
 * interpretation logged in the deviation log.)
 */
export function SyncSheet({
  open,
  onClose,
  clockEvents,
  requested,
  effective,
  available,
  onApply,
  onAdjust,
}: {
  open: boolean;
  onClose: () => void;
  clockEvents: ClockEventInput[];
  requested: number;
  effective: number;
  available: number;
  onApply: (seconds: number) => void;
  onAdjust: (delta: number) => void;
}) {
  const [targetMs, setTargetMs] = useState<number | null>(null);
  const [liveText, setLiveText] = useState("");
  const [justSynced, setJustSynced] = useState<number | null>(null);
  const targetTextRef = useRef("");

  const clockRunning = useMemo(
    () => deriveClock(clockEvents, Date.now()).running,
    [clockEvents],
  );

  // freeze the target the moment the sheet opens
  useEffect(() => {
    if (!open) {
      setJustSynced(null);
      setTargetMs(null);
      return;
    }
    const d = deriveClock(clockEvents, Date.now());
    if (d.running) {
      setTargetMs(Date.now());
      targetTextRef.current = `${d.period} ${formatClock(d.elapsedSeconds)}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // small ticking live-edge reference beneath the frozen target
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      const d = deriveClock(clockEvents, Date.now());
      setLiveText(d.running ? `${d.period} ${formatClock(d.elapsedSeconds)}` : "");
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [open, clockEvents]);

  if (!open) return null;

  function tapNow() {
    if (targetMs === null) return;
    const lag = Math.round(((Date.now() - targetMs) / 1000) * 10) / 10;
    onApply(lag);
    setJustSynced(lag);
  }

  function refreshTarget() {
    const d = deriveClock(clockEvents, Date.now());
    if (d.running) {
      setTargetMs(Date.now());
      targetTextRef.current = `${d.period} ${formatClock(d.elapsedSeconds)}`;
      setJustSynced(null);
    }
  }

  const buffering = requested > effective + 0.5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Sync to my TV"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border-[0.75px] border-line bg-surface p-5 lg:rounded-2xl"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold">Sync to my TV</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sync sheet"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-secondary hover:bg-raised hover:text-primary"
          >
            ✕
          </button>
        </div>

        {/* once a target is frozen it stays valid even if the clock stops
            mid-wait (the lag math is pure wall time) — clockRunning only
            gates creating NEW targets */}
        {targetMs !== null ? (
          <div className="mt-2 text-center">
            <p className="text-sm text-secondary">
              When your TV shows this exact moment, tap Now.
            </p>
            <p className="mt-2 text-5xl font-bold tabular-nums">
              {targetTextRef.current}
            </p>
            <p className="mt-1 text-xs text-secondary tabular-nums">
              Live edge: {liveText}
            </p>
            {justSynced === null ? (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={tapNow}
                  className="h-14 rounded-xl bg-red px-10 text-lg font-bold text-white"
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={refreshTarget}
                  disabled={!clockRunning}
                  className="h-14 rounded-xl border border-line px-4 text-sm text-secondary hover:text-primary disabled:opacity-50"
                >
                  New moment
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold text-green">
                ✓ Synced — you&apos;re {justSynced.toFixed(1)}s behind live
              </p>
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border-[0.75px] border-line bg-raised p-3 text-sm text-secondary">
            One-tap calibration uses the match clock, so it&apos;s available
            during live play. The steppers below work any time.
          </p>
        )}

        <div className="mt-5 flex items-center justify-between rounded-xl border-[0.75px] border-line bg-raised p-3">
          <button
            type="button"
            onClick={() => onAdjust(-0.5)}
            aria-label="Half a second less delay"
            className="h-11 w-14 rounded-lg border border-line bg-surface text-sm font-bold tabular-nums hover:bg-raised"
          >
            −0.5s
          </button>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums">
              +{requested.toFixed(1)}s
            </p>
            {buffering && (
              <p className="text-[11px] text-red tabular-nums">
                at +{effective.toFixed(1)}s — filling toward your setting
              </p>
            )}
            <p className="text-[11px] text-secondary tabular-nums">
              {Math.floor(available)}s buffered (max 90s)
            </p>
          </div>
          <button
            type="button"
            onClick={() => onAdjust(0.5)}
            aria-label="Half a second more delay"
            className="h-11 w-14 rounded-lg border border-line bg-surface text-sm font-bold tabular-nums hover:bg-raised"
          >
            +0.5s
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            onApply(0);
            setJustSynced(null);
          }}
          className="mt-3 h-11 w-full rounded-lg border border-line text-sm font-semibold hover:bg-raised"
        >
          Back to live edge
        </button>
      </div>
    </div>
  );
}
