"use client";

import { useState } from "react";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { useToast } from "@/components/Toast";
import { attendanceLine } from "@/lib/strings/attendance";
import type { ScheduleRoom } from "@/lib/db/matches";
import { Avatar } from "@/components/Avatar";
import { ShareButton } from "@/components/room/ShareButton";

/**
 * One room under a fixture (FR-22.1/22.3). Scheduled rooms carry a "Count me
 * in" toggle (optimistic, toast on failure) and the attendance line from the
 * strings module; live rooms carry a Join link. Anonymous users see the RSVP
 * button as a join prompt (FR-2.4).
 */
export function RoomRow({
  room,
  signedIn,
  matchLabel,
}: {
  room: ScheduleRoom;
  signedIn: boolean;
  /** "Home vs Away", for a meaningful share message */
  matchLabel: string;
}) {
  const toast = useToast();
  const [rsvped, setRsvped] = useState(room.viewerRsvped);
  const [count, setCount] = useState(room.rsvpCount);
  const [busy, setBusy] = useState(false);

  const enterable = room.state !== "scheduled";
  // friend chips + the friend-aware attendance line (FR-22.3); when the viewer
  // has un-RSVP'd we don't fabricate friends, so the friend layer only shows
  // with the server-provided names
  const line = attendanceLine(count, room.friendNames);

  async function toggle() {
    if (!signedIn) return;
    const next = !rsvped;
    // optimistic
    setRsvped(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setBusy(true);
    const res = await fetch(`/api/rooms/${room.id}/rsvp`, {
      method: next ? "POST" : "DELETE",
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      // roll back
      setRsvped(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      toast("Couldn't update your RSVP. Try again.");
      return;
    }
    const body = await res.json().catch(() => null);
    if (body && typeof body.count === "number") setCount(body.count);
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="shrink-0">
        <Avatar src={null} name={room.hostUsername} size={28} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-[13px] font-bold tracking-[-0.01em]">
          {(room.hostUsernames.length > 0
            ? room.hostUsernames
            : [room.hostUsername]
          ).map((h, i) => (
            <span key={h}>
              {i > 0 && <span className="text-secondary"> · </span>}
              <Link href={`/${h}`} className="hover:underline">
                @{h}
              </Link>
            </span>
          ))}
        </span>
        {room.blurb && (
          <span className="block truncate text-[12.5px] text-secondary">
            {room.blurb}
          </span>
        )}
        {!enterable && line && (
          <span className="mt-0.5 flex items-center gap-1.5">
            {room.friendNames.length > 0 && (
              <span className="flex -space-x-1.5">
                {room.friendNames.slice(0, 3).map((n) => (
                  <span key={n} className="ring-1 ring-surface rounded-full">
                    <Avatar src={null} name={n} size={16} />
                  </span>
                ))}
              </span>
            )}
            <span className="text-[12px] text-secondary tabular-nums">
              {line}
            </span>
          </span>
        )}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        {enterable ? (
          <Link
            href={`/room/${room.slug}`}
            className="btn-grad-red flex shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold text-white"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-white"
            />
            Join live
          </Link>
        ) : signedIn ? (
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={busy}
            aria-pressed={rsvped}
            className={`shrink-0 rounded-[10px] border px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60 ${
              rsvped
                ? "border-green bg-green/10 text-green"
                : "border-line hover:bg-raised"
            }`}
          >
            {rsvped ? "You're in ✓" : "Count me in"}
          </button>
        ) : (
          <Link
            href={`/signin?next=${encodeURIComponent(`/room/${room.slug}`)}`}
            className="shrink-0 rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold hover:bg-raised"
          >
            Count me in
          </Link>
        )}
        <ShareButton
          compact
          url={`/room/${room.slug}`}
          text={`Listen to ${matchLabel} with the room on ${brand.name}`}
        />
      </div>
    </div>
  );
}
