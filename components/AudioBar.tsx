/**
 * Persistent audio bar — listener variant, UI shell only (Phase 1).
 * No audio until Phase 5; sync controls become functional in Phase 6.
 * Mobile renders it as a compact in-flow strip under the match header;
 * desktop renders it as the fixed bottom bar (~50px).
 */

function PlayButton() {
  return (
    <button
      type="button"
      aria-label="Play"
      disabled
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red text-white disabled:opacity-60"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="ml-0.5 h-4 w-4 fill-current"
      >
        <path d="M4 2.5v11l9-5.5-9-5.5z" />
      </svg>
    </button>
  );
}

function SyncReadout() {
  return (
    <button
      type="button"
      disabled
      aria-label="Sync to my TV"
      className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm disabled:opacity-60"
    >
      <span className="text-secondary">Sync</span>
      <span className="font-semibold tabular-nums">+0.0s</span>
    </button>
  );
}

export function AudioBar({
  commentator,
  live,
}: {
  commentator: string;
  live: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <PlayButton />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{commentator}</p>
        <p className="truncate text-xs text-secondary">
          {live ? "Live commentary" : "Waiting for the show to start"}
        </p>
      </div>
      {live && (
        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-red px-2 py-1 text-xs font-bold text-white">
          <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" />
          LIVE
        </span>
      )}
      <SyncReadout />
    </div>
  );
}
