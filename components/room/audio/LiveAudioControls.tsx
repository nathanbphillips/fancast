"use client";

import { useEffect, useState } from "react";
import { RadioToggle } from "@/components/RadioToggle";
import { CallerActions } from "../CallerActions";
import type { ListenStatus, MicStatus, Speaker } from "./useRoomAudio";

/**
 * Audio bar contents (Phase 5).
 * - Listener: tap to listen / pause, live status, tech difficulties card.
 * - Elevated guest: "go on air" CTA, then the transformed ON AIR bar with
 *   mute + dominant Leave Air (FR-4.3).
 */

function PlayStopButton({
  status,
  onStart,
  onStop,
}: {
  status: ListenStatus;
  onStart: () => void;
  onStop: () => void;
}) {
  const listening = status === "live";
  return (
    <button
      type="button"
      aria-label={listening ? "Stop listening" : "Tap to listen"}
      onClick={listening ? onStop : onStart}
      disabled={status === "connecting"}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red text-white disabled:opacity-60"
    >
      {status === "connecting" ? (
        <span className="h-4 w-4 animate-live-pulse rounded-full bg-white/70" aria-hidden="true" />
      ) : listening ? (
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
          <rect x="3" y="3" width="4" height="10" rx="1" />
          <rect x="9" y="3" width="4" height="10" rx="1" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 16 16" className="ml-0.5 h-4 w-4 fill-current">
          <path d="M4 2.5v11l9-5.5-9-5.5z" />
        </svg>
      )}
    </button>
  );
}

export function TechDifficultiesCard({ since }: { since: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const prolonged = since !== null && now - since > 15 * 60 * 1000;

  return (
    <div className="flex-1 rounded-lg border-[0.75px] border-line bg-raised px-3 py-1.5">
      <p className="text-sm font-semibold">
        Technical difficulties — the commentator will be right back.
      </p>
      {prolonged && (
        <p className="text-xs text-secondary">
          It&apos;s been a while — the broadcast may have ended.
        </p>
      )}
    </div>
  );
}

/** Volume slider. The audio engine scales the live path with a Web Audio gain
 *  node so this works on iOS, where element .volume is ignored. */
function VolumeSlider({
  volume,
  onChange,
  className,
}: {
  volume: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-secondary">
        <path d="M2 6h2.5L8 3v10L4.5 10H2z" className="fill-current" />
        {volume > 0.02 && (
          <path
            d="M10.5 5.5a3 3 0 010 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        )}
      </svg>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Volume"
        className="h-1 flex-1 cursor-pointer accent-red"
      />
    </span>
  );
}

/** Sync-to-TV controls (the listening delay): −.5 / Sync +Xs / +.5. Hidden in
 *  radio mode per FR-6.5. Returns null when sync isn't supported. */
function SyncControls({
  syncRequested,
  syncEffective,
  syncSupported,
  radioActive,
  listenStatus,
  onSyncAdjust,
  onOpenSync,
  className = "shrink-0",
}: {
  syncRequested: number;
  syncEffective: number;
  syncSupported: boolean;
  radioActive: boolean;
  listenStatus: ListenStatus;
  onSyncAdjust: (seconds: number) => void;
  onOpenSync: () => void;
  className?: string;
}) {
  if (radioActive || !syncSupported) return null;
  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => onSyncAdjust(-0.5)}
        aria-label="Half a second less delay"
        className="h-11 shrink-0 rounded-lg border border-line bg-inset px-3 font-mono text-[10px] tabular-nums text-secondary transition-colors hover:border-gold hover:text-primary"
      >
        −0.5s
      </button>
      <button
        type="button"
        onClick={onOpenSync}
        aria-label="Sync to my TV"
        title="Sync to my TV"
        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-inverted px-4 font-mono text-[10px] font-bold tracking-[0.06em] text-inverted-fg transition-opacity hover:opacity-90"
      >
        SYNC NOW
        {syncRequested > 0 && (
          <span className="tabular-nums opacity-80">+{syncRequested.toFixed(1)}s</span>
        )}
        {listenStatus === "live" && syncRequested > syncEffective + 0.5 && (
          <span className="text-gold tabular-nums">⏳{syncEffective.toFixed(0)}s</span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onSyncAdjust(0.5)}
        aria-label="Half a second more delay"
        className="h-11 shrink-0 rounded-lg border border-line bg-inset px-3 font-mono text-[10px] tabular-nums text-secondary transition-colors hover:border-gold hover:text-primary"
      >
        +0.5s
      </button>
    </span>
  );
}

export function ListenerBar({
  commentator,
  live,
  listenStatus,
  onStart,
  onStop,
  techDifficulties,
  techSince,
  canPublish,
  micStatus,
  micMuted,
  onGoOnAir,
  onLeaveAir,
  onToggleMute,
  radioUrl,
  radioActive,
  onRadioToggle,
  syncRequested,
  syncEffective,
  syncSupported,
  onSyncAdjust,
  onOpenSync,
  volume,
  onVolumeChange,
  homeScore,
  awayScore,
  clock,
}: {
  commentator: string;
  live: boolean;
  listenStatus: ListenStatus;
  onStart: () => void;
  onStop: () => void;
  techDifficulties: boolean;
  techSince: number | null;
  canPublish: boolean;
  micStatus: MicStatus;
  micMuted: boolean;
  onGoOnAir: () => void;
  onLeaveAir: () => void;
  onToggleMute: () => void;
  radioUrl: string | null;
  radioActive: boolean;
  onRadioToggle: (next: boolean) => void;
  syncRequested: number;
  syncEffective: number;
  syncSupported: boolean;
  onSyncAdjust: (seconds: number) => void;
  onOpenSync: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  homeScore: number | null;
  awayScore: number | null;
  clock?: string;
}) {
  const onAir = canPublish && micStatus === "live";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const statusLine = radioActive
    ? "Radio mode — a few seconds behind live"
    : listenStatus === "live"
      ? "Live commentary"
      : listenStatus === "connecting"
        ? "Connecting…"
        : listenStatus === "error"
          ? "Couldn't connect — tap to retry"
          : live
            ? "Tap to listen"
            : "Waiting for the show to start";

  if (onAir) {
    // FR-4.3: transformed ON AIR bar
    return (
      <div className="flex items-center gap-3 rounded-lg border-2 border-red px-4 py-2 shadow-[0_0_12px_rgba(239,1,7,0.35)]">
        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-red px-2 py-1 text-xs font-bold text-white">
          <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" />
          ON AIR
        </span>
        <p className="min-w-0 flex-1 truncate text-sm">
          The room hears you{micMuted ? " (muted)" : ""}.
        </p>
        <button
          type="button"
          onClick={onToggleMute}
          className="h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-raised"
        >
          {micMuted ? "Unmute" : "Mute"}
        </button>
        <button
          type="button"
          onClick={onLeaveAir}
          className="h-11 shrink-0 rounded-lg bg-red px-5 text-sm font-bold text-white"
        >
          Leave Air
        </button>
      </div>
    );
  }

  const playButton = radioActive ? (
    <button
      type="button"
      aria-label="Stop radio"
      onClick={() => onRadioToggle(false)}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold text-canvas"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
        <rect x="3" y="3" width="4" height="10" rx="1" />
        <rect x="9" y="3" width="4" height="10" rx="1" />
      </svg>
    </button>
  ) : (
    <PlayStopButton status={listenStatus} onStart={onStart} onStop={onStop} />
  );

  const goOnAir =
    canPublish && micStatus !== "live" ? (
      <button
        type="button"
        onClick={onGoOnAir}
        disabled={micStatus === "starting"}
        className="h-11 shrink-0 rounded-lg bg-gold px-4 text-sm font-bold text-canvas disabled:opacity-60"
      >
        {micStatus === "starting" ? "Mic…" : "Go on air"}
      </button>
    ) : null;

  const liveBadge =
    live && !techDifficulties ? (
      <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-red px-2 py-1 text-xs font-bold text-white">
        <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" />
        LIVE
      </span>
    ) : null;

  const radioToggle = (
    <RadioToggle available={radioUrl !== null && live} active={radioActive} onToggle={onRadioToggle} />
  );

  const sync = (
    <SyncControls
      syncRequested={syncRequested}
      syncEffective={syncEffective}
      syncSupported={syncSupported}
      radioActive={radioActive}
      listenStatus={listenStatus}
      onSyncAdjust={onSyncAdjust}
      onOpenSync={onOpenSync}
    />
  );

  return (
    <>
      {/* DESKTOP: full inline bar */}
      <div className="hidden flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 lg:flex">
        {playButton}
        {techDifficulties && !radioActive ? (
          <TechDifficultiesCard since={techSince} />
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{commentator}</p>
            <p className="truncate text-xs text-secondary">{statusLine}</p>
          </div>
        )}
        {goOnAir}
        {liveBadge}
        {radioToggle}
        {sync}
        <VolumeSlider volume={volume} onChange={onVolumeChange} className="w-28 shrink-0" />
      </div>

      {/* MOBILE: compact bar (play · score + clock · caret) over an audio drawer */}
      <div className="lg:hidden">
        <div className="flex items-center gap-3 px-4 py-2">
          {playButton}
          {techDifficulties && !radioActive ? (
            <TechDifficultiesCard since={techSince} />
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{commentator}</p>
              <p className="truncate text-xs text-secondary tabular-nums">
                {clock ? `${homeScore ?? 0}–${awayScore ?? 0} · ${clock}` : statusLine}
              </p>
            </div>
          )}
          {goOnAir}
          {liveBadge}
          <button
            type="button"
            onClick={() => setDrawerOpen((o) => !o)}
            aria-expanded={drawerOpen}
            aria-label="Audio settings"
            className="flex h-11 w-9 shrink-0 items-center justify-center text-secondary hover:text-primary"
          >
            <span
              aria-hidden
              className={`inline-block text-lg transition-transform ${drawerOpen ? "" : "-rotate-90"}`}
            >
              ⌄
            </span>
          </button>
        </div>

        {drawerOpen && (
          <div className="space-y-3 border-t border-line bg-surface px-4 py-3">
            {!radioActive && syncSupported && (
              <div>
                <p className="mb-1.5 text-xs font-semibold text-secondary">
                  Listening delay — sync to your TV
                </p>
                <SyncControls
                  syncRequested={syncRequested}
                  syncEffective={syncEffective}
                  syncSupported={syncSupported}
                  radioActive={radioActive}
                  listenStatus={listenStatus}
                  onSyncAdjust={onSyncAdjust}
                  onOpenSync={onOpenSync}
                  className="w-full"
                />
              </div>
            )}
            {radioUrl !== null && live && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-secondary">Radio mode</span>
                {radioToggle}
              </div>
            )}
            <div>
              <p className="mb-1.5 text-xs font-semibold text-secondary">Volume</p>
              <VolumeSlider volume={volume} onChange={onVolumeChange} className="w-full" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** Mic controls for the commentator bar: start/stop, mute, self-delay. */
export function MicControls({
  micStatus,
  micMuted,
  selfDelay,
  onStart,
  onStop,
  onToggleMute,
  onDelayChange,
}: {
  micStatus: MicStatus;
  micMuted: boolean;
  selfDelay: number;
  onStart: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  onDelayChange: (s: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {micStatus === "live" ? (
        <>
          <span className="flex items-center gap-1.5 text-xs font-bold text-green">
            <span className="h-2 w-2 animate-live-pulse rounded-full bg-green" />
            MIC LIVE
          </span>
          <button
            type="button"
            onClick={onToggleMute}
            className={`h-9 rounded-md border px-2.5 text-xs font-semibold ${micMuted ? "border-red text-red" : "border-line text-secondary hover:text-primary"}`}
          >
            {micMuted ? "Muted" : "Mute"}
          </button>
          <button
            type="button"
            onClick={onStop}
            className="h-9 rounded-md border border-line px-2.5 text-xs font-semibold text-secondary hover:text-primary"
          >
            Mic off
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={micStatus === "starting"}
          className="h-11 rounded-lg border border-gold px-4 text-sm font-bold text-gold hover:bg-raised disabled:opacity-60"
        >
          {micStatus === "starting" ? "Starting…" : "Start mic"}
        </button>
      )}
      <label className="flex items-center gap-1 text-xs text-secondary">
        Delay
        <select
          value={selfDelay}
          onChange={(e) => onDelayChange(Number(e.target.value))}
          aria-label="Self-delay in seconds"
          className="h-9 rounded-md border border-line bg-surface px-1 text-xs tabular-nums"
        >
          <option value={0}>Off</option>
          {[1, 2, 3, 4, 5].map((s) => (
            <option key={s} value={s}>
              {s}s
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** On-air guest chips (commentator bar, FR-4.3). The X ends the call —
 *  always neutral; ⚑ opens flag/block actions for problem callers. */
export function SpeakerChips({
  speakers,
  roomId,
  onEndCall,
}: {
  speakers: Speaker[];
  roomId: string;
  onEndCall: (identity: string) => void;
}) {
  const guests = speakers.filter((s) => !s.isCommentator && s.name !== "you");
  if (guests.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {guests.map((s) => (
        <span
          key={s.identity}
          className="flex items-center gap-1 rounded-full border border-gold bg-raised px-2.5 py-1 text-xs font-semibold"
        >
          <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-red" aria-hidden="true" />
          {s.name}
          <CallerActions userId={s.identity} username={s.name} roomId={roomId} />
          <button
            type="button"
            aria-label={`End ${s.name}'s call`}
            title="End call (no effect on their account)"
            onClick={() => onEndCall(s.identity)}
            className="px-1 text-secondary hover:text-red"
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
