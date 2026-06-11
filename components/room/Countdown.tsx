"use client";

import { useEffect, useState } from "react";

function label(msLeft: number): string {
  if (msLeft <= 0) return "Kickoff";
  const s = Math.floor(msLeft / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Waiting-room countdown to kickoff (FR-3.2). */
export function Countdown({ kickoffIso }: { kickoffIso: string }) {
  const target = new Date(kickoffIso).getTime();
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setMsLeft(target - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="m-2 rounded-xl border-[0.75px] border-line bg-surface p-4 text-center">
      <p className="text-xs font-bold tracking-wide text-secondary uppercase">
        {msLeft !== null && msLeft <= 0 ? "Kickoff has arrived" : "Kickoff in"}
      </p>
      <p
        className="mt-1 text-3xl font-bold tabular-nums"
        suppressHydrationWarning
      >
        {msLeft === null ? "—" : label(msLeft)}
      </p>
      <p className="mt-1 text-sm text-secondary">Show starts soon.</p>
    </div>
  );
}
