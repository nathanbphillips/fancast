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
}: {
  targetIso: string | null;
  heading?: string;
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
