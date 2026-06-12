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
}) {
  const onAir = canPublish && micStatus === "live";

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

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {radioActive ? (
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
      )}
      {techDifficulties && !radioActive ? (
        <TechDifficultiesCard since={techSince} />
      ) : (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{commentator}</p>
          <p className="truncate text-xs text-secondary">
            {radioActive
              ? "Radio mode — a few seconds behind live"
              : listenStatus === "live"
                ? "Live commentary"
                : listenStatus === "connecting"
                  ? "Connecting…"
                  : listenStatus === "error"
                    ? "Couldn't connect — tap to retry"
                    : live
                      ? "Tap to listen"
                      : "Waiting for the show to start"}
          </p>
        </div>
      )}
      {canPublish && micStatus !== "live" && (
        <button
          type="button"
          onClick={onGoOnAir}
          disabled={micStatus === "starting"}
          className="h-11 shrink-0 rounded-lg bg-gold px-4 text-sm font-bold text-canvas disabled:opacity-60"
        >
          {micStatus === "starting" ? "Mic…" : "Go on air"}
        </button>
      )}
      {live && !techDifficulties && (
        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-red px-2 py-1 text-xs font-bold text-white">
          <span className="h-1.5 w-1.5 animate-live-pulse rounded-full bg-white" />
          LIVE
        </span>
      )}
      <RadioToggle
        available={radioUrl !== null && live}
        active={radioActive}
        onToggle={onRadioToggle}
      />
      {/* sync controls hidden in radio mode (FR-6.5) */}
      {!radioActive && (
        <button
          type="button"
          disabled
          aria-label="Sync to my TV (Phase 6)"
          className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm disabled:opacity-60"
        >
          <span className="text-secondary">Sync</span>
          <span className="font-semibold tabular-nums">+0.0s</span>
        </button>
      )}
    </div>
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
