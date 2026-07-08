"use client";

import { useState } from "react";
import type { MyPrediction, PredictionAggregate } from "@/lib/db/types";
import { useToast } from "@/components/Toast";

/**
 * Score predictor (FR-12.1). Pregame: a listener picks one scoreline (one tap
 * per goal). The public distribution renders for everyone and updates via the
 * control channel; the viewer's own pick is highlighted. Read-only once
 * predictions close at kickoff.
 */

function Stepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className="mb-1 max-w-[72px] truncate text-[10px] text-secondary">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Fewer ${label} goals`}
          disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-sm hover:bg-raised disabled:opacity-40"
        >
          −
        </button>
        <span className="w-6 text-center text-lg font-bold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`More ${label} goals`}
          disabled={disabled || value >= 9}
          onClick={() => onChange(Math.min(9, value + 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-sm hover:bg-raised disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function ScorePredictor({
  roomId,
  myValue,
  agg,
  open,
  homeName,
  awayName,
}: {
  roomId: string;
  myValue: MyPrediction;
  agg: PredictionAggregate;
  /** predictions accepted (pregame, and this viewer may predict) */
  open: boolean;
  homeName: string;
  awayName: string;
}) {
  const [home, setHome] = useState(myValue?.home ?? 0);
  const [away, setAway] = useState(myValue?.away ?? 0);
  const [mine, setMine] = useState<MyPrediction>(myValue);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit() {
    if (!open || busy) return;
    setBusy(true);
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, home, away }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setMine({ home, away });
    else toast("Couldn't save your prediction.");
  }

  const max = Math.max(1, ...agg.top.map((t) => t.count));
  const mineLabel = mine ? `${mine.home}-${mine.away}` : null;

  return (
    <div className="mt-3 rounded-xl border-[0.75px] border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Score predictor</p>
        <span className="text-[11px] tabular-nums text-secondary">
          {agg.total === 0 ? "be the first" : `${agg.total} predicted`}
        </span>
      </div>

      {open ? (
        <div className="mt-2 flex items-center justify-center gap-3">
          <Stepper label={homeName} value={home} onChange={setHome} disabled={busy} />
          <span className="mt-4 text-secondary">–</span>
          <Stepper label={awayName} value={away} onChange={setAway} disabled={busy} />
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-4 h-9 shrink-0 rounded-lg bg-red px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {mine ? "Update" : "Predict"}
          </button>
        </div>
      ) : mine ? (
        <p className="mt-1 text-xs text-secondary">
          You predicted {homeName} {mine.home}–{mine.away} {awayName}.
        </p>
      ) : null}

      {agg.top.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Prediction distribution">
          {agg.top.map((t) => {
            const isMine = mineLabel === t.label;
            return (
              <li key={t.label} className="flex items-center gap-2 text-xs">
                <span className={`w-10 shrink-0 tabular-nums ${isMine ? "font-bold text-green" : ""}`}>
                  {t.label}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                  <span
                    className={`block h-full rounded-full ${isMine ? "bg-green" : "bg-red"}`}
                    style={{ width: `${(t.count / max) * 100}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right tabular-nums text-secondary">{t.count}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
