"use client";

/** Radio-Only toggle (FR-5.4): switches the listener to the HLS mix
 *  (5-15s latency, locked-screen friendly). Disabled until the room has
 *  a live HLS playlist. */
export function RadioToggle({
  available,
  active,
  onToggle,
}: {
  available: boolean;
  active: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={!available}
      onClick={() => onToggle(!active)}
      title={
        available
          ? "Radio mode: steadier playback for background listening (a few seconds behind)"
          : "Radio mode becomes available when the broadcast starts"
      }
      className={`flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50 ${
        active
          ? "border-red text-red"
          : "border-line bg-surface text-secondary hover:bg-raised"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${active ? "animate-live-pulse bg-red" : "bg-line"}`}
      />
      Radio
    </button>
  );
}
