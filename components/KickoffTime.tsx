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

/**
 * Just the kickoff TIME (24h), localized to the viewer's timezone — for places
 * that show the date separately (e.g. a date-grouped schedule). Server renders
 * UK time; the effect swaps to the viewer's local zone after hydration, so an
 * international viewer sees when the room starts in THEIR time, not London's
 * (live-test review 2026-08-05). Pass `weekday` to prefix the local weekday.
 */
export function LocalTime({
  iso,
  weekday = false,
  className = "tabular-nums",
}: {
  iso: string;
  weekday?: boolean;
  className?: string;
}) {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(weekday ? { weekday: "short" } : {}),
  };
  const [label, setLabel] = useState(() =>
    new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "Europe/London" }).format(
      new Date(iso),
    ),
  );
  useEffect(() => {
    setLabel(new Intl.DateTimeFormat(undefined, opts).format(new Date(iso)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, weekday]);

  return (
    <time dateTime={iso} suppressHydrationWarning className={className}>
      {label}
    </time>
  );
}
