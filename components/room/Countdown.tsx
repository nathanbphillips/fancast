"use client";

import { useEffect, useState } from "react";

function label(msLeft: number): string {
  const s = Math.floor(msLeft / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * Waiting-room countdown (FR-3.2, amended 2026-06-11): counts to the
 * commentator-set broadcast start. No target set -> calm card, no clock.
 */
export function Countdown({
  targetIso,
  heading = "Broadcast starts in",
  bare = false,
}: {
  targetIso: string | null;
  heading?: string;
  /** render just the heading + digits (no card), inheriting the parent color —
   *  used inside the "doors open soon" black box on the waiting screen. */
  bare?: boolean;
}) {
  const target = targetIso ? new Date(targetIso).getTime() : null;
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (target === null) {
      setMsLeft(null);
      return;
    }
    const tick = () => setMsLeft(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  if (bare) {
    return (
      <div className="text-center">
        {target === null ? (
          <p className="text-lg font-bold">Show starts soon.</p>
        ) : msLeft !== null && msLeft <= 0 ? (
          <p className="text-lg font-bold">Any moment now…</p>
        ) : (
          <>
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase opacity-60">
              {heading}
            </p>
            <p
              className="mt-1.5 text-[44px] leading-none font-bold tabular-nums"
              suppressHydrationWarning
            >
              {msLeft === null ? "—" : label(msLeft)}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="m-2 rounded-xl border-[0.75px] border-line bg-surface p-4 text-center">
      {target === null ? (
        <>
          <p className="text-lg font-bold">Show starts soon.</p>
          <p className="mt-1 text-sm text-secondary">
            The commentator hasn&apos;t set a start time yet.
          </p>
        </>
      ) : msLeft !== null && msLeft <= 0 ? (
        <>
          <p className="text-lg font-bold">Any moment now…</p>
          <p className="mt-1 text-sm text-secondary">Show starts soon.</p>
        </>
      ) : (
        <>
          <p className="text-xs font-bold tracking-wide text-secondary uppercase">
            {heading}
          </p>
          <p
            className="mt-1 text-3xl font-bold tabular-nums"
            suppressHydrationWarning
          >
            {msLeft === null ? "—" : label(msLeft)}
          </p>
          <p className="mt-1 text-sm text-secondary">Show starts soon.</p>
        </>
      )}
    </div>
  );
}
