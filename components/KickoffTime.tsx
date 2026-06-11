"use client";

import { useEffect, useState } from "react";

/**
 * Kickoff time localized to the viewer's timezone (FR-1.1). Server renders
 * UTC; the effect swaps in the local format after hydration.
 */
export function KickoffTime({ iso }: { iso: string }) {
  const date = new Date(iso);
  const [label, setLabel] = useState(() =>
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date),
  );

  useEffect(() => {
    setLabel(
      new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso)),
    );
  }, [iso]);

  return (
    <time dateTime={iso} suppressHydrationWarning className="tabular-nums">
      {label}
    </time>
  );
}
