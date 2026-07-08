"use client";

import { useEffect, useState } from "react";

/**
 * Live "kicks off in" countdown to a real fixture kickoff (ISO). Ticks locally
 * from the real target time — never a fabricated number. Renders a stable
 * placeholder on the server / first paint to avoid a hydration mismatch (the
 * clock only starts after mount). Tabular figures so it doesn't jitter.
 */
export function Countdown({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  if (now === null) {
    return <span className="tabular-nums">--:--:--</span>;
  }

  const diff = Math.max(0, new Date(iso).getTime() - now);
  if (diff === 0) {
    return <span className="tabular-nums">Underway</span>;
  }

  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return (
    <span className="tabular-nums">
      {days > 0 ? `${days}d ` : ""}
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
