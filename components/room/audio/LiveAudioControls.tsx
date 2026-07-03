"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { RadioToggle } from "@/components/RadioToggle";
import { Waveform } from "@/components/ui/Waveform";
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
        Technical difficulties. The commentator will be right back.
      </p>
      {prolonged && (
        <p className="text-xs text-secondary">
          It&apos;s been a while; the broadcast may have ended.
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
      {syncRequested > 0 && (
        <button
          type="button"
          onClick={() => onSyncAdjust(-syncRequested)}
          aria-label="Jump back to live"
          title="Drop the delay and jump to the live edge"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-red/40 px-2.5 font-mono text-[10px] tracking-[0.06em] text-red transition-colors hover:bg-red/10"
        >
          <span
            aria-hidden="true"
            className="h-[5px] w-[5px] animate-fcpulse rounded-full bg-red"
          />
          LIVE
        </button>
      )}
    </span>
  );
}

/** 3-letter team code for the compact score readout (matches MatchHeader). */
function abbr3(s: string): string {
  return s.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

/** Little animated EQ bars shown while live audio is playing (decorative). */
function EqTicks({ h = 14 }: { h?: number }) {
  return (
    <span aria-hidden="true" className="flex items-end gap-0.5" style={{ height: h }}>
      {[0, 0.18, 0.36].map((d) => (
        <span
          key={d}
          className="animate-fceq w-[3px] rounded-[1px] bg-red"
          style={{ height: h, transformOrigin: "bottom", animationDelay: `${d}s` }}
        />
      ))}
    </span>
  );
}

export function ListenerBar({
  commentator,
  home,
  away,
  leaveHref = "/matches",
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
  syncedClock,
  speakers = [],
}: {
  commentator: string;
  /** team names for the transport's score readout (mobile) */
  home: string;
  away: string;
  leaveHref?: string;
  /** on-air roster so listeners can see who's speaking (audit 2026-07-02) */
  speakers?: Speaker[];
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
  /** the commentator's clock minus THIS listener's sync delay — the game time
   *  they're hearing; matches their telly once synced (founder 2026-07-02) */
  syncedClock?: string;
}) {
  const onAir = canPublish && micStatus === "live";
  // other people currently on air (guests/co-hosts) — shown so listeners can
  // tell who the second voice is (audit 2026-07-02)
  const guestNames = speakers
    .filter((s) => !s.isCommentator && s.name !== "you")
    .map((s) => s.name)
    .join(", ");
  // mobile sync transport (Cloud Design): expanded by default — "tap SYNC once,
  // then collapse it". Session-local UI state only.
  const [expanded, setExpanded] = useState(true);

  const statusLine = radioActive
    ? "Radio mode · a few seconds behind live"
    : listenStatus === "live"
      ? "Live commentary"
      : listenStatus === "connecting"
        ? "Connecting…"
        : listenStatus === "error"
          ? "Couldn't connect · tap to retry"
          : live
            ? "Tap to listen"
            : "Waiting for the show to start";

  // Auto-expand the transport when the commentator elevates this listener
  // (canPublish flips true) so the "Go on air" CTA is never hidden behind a
  // collapsed strip (audit 2026-07-02). Also fires when they leave air, which
  // correctly restores the full transport.
  useEffect(() => {
    if (canPublish && micStatus !== "live") setExpanded(true);
  }, [canPublish, micStatus]);

  if (onAir) {
    // FR-4.3: transformed ON AIR bar. On mobile the desktop match bar is
    // hidden, so keep a slim score + clock line above it — an on-air caller
    // still needs the scoreline they're talking about (audit 2026-07-02).
    return (
      <div>
        <div className="flex items-center justify-center gap-2.5 border-b border-line bg-inset px-3 py-1.5 lg:hidden">
          <span className="display text-[14px] tracking-[0.03em]">{abbr3(home)}</span>
          <span className="text-[14px] font-bold tabular-nums">
            {homeScore ?? 0}
            <span className="font-normal text-secondary">–</span>
            {awayScore ?? 0}
          </span>
          <span className="display text-[14px] tracking-[0.03em]">{abbr3(away)}</span>
          {clock && (
            <span className="font-mono text-[11px] text-secondary tabular-nums">{clock}</span>
          )}
        </div>
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
          /* on-air card (Cloud Design, founder 2026-07-02): who's speaking —
             host avatar with a red ring, HOST badge, EQ while playing, and the
             on-air guests/co-hosts on the second line */
          <div className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-xl border border-red/30 bg-raised py-1.5 pr-3.5 pl-1.5">
            <Avatar
              name={commentator}
              size={32}
              className="border-2 border-red"
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold">
                <span className="truncate">{commentator}</span>
                <span className="shrink-0 rounded-[3px] border border-gold/50 px-1 py-0.5 font-mono text-[8px] tracking-[0.1em] text-gold uppercase">
                  Host
                </span>
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[8.5px] text-secondary">
                {listenStatus === "live" && !radioActive && <EqTicks h={8} />}
                <span className="truncate">
                  {guestNames ? `${guestNames} · on air` : statusLine}
                </span>
              </p>
            </div>
          </div>
        )}
        {/* decorative broadcast waveform fills the dock's center on wide
            screens (Cloud Design); clips first, never the controls */}
        <div className="hidden min-w-0 flex-1 xl:block">
          <Waveform bars={40} height={26} />
        </div>
        <div className="min-w-0 flex-1 xl:hidden" />
        {goOnAir}
        {liveBadge}
        {radioToggle}
        {sync}
        <VolumeSlider volume={volume} onChange={onVolumeChange} className="w-28 shrink-0" />
      </div>

      {/* MOBILE: sync transport (Cloud Design) — a rich expanded state (score,
          host card, sync, radio + volume) that collapses to a slim always-on
          strip. Pure reslot: every engine callback is the same one the old
          drawer used. */}
      <div className="lg:hidden">
        {expanded ? (
          <div
            className="border-b border-line px-4 pt-3 pb-3.5"
            style={{
              background:
                "radial-gradient(120% 110% at 80% 0%, rgba(241,35,43,0.16), transparent 60%), var(--bg2)",
            }}
          >
            {/* leave · LIVE (collapse moved to the bottom hint — founder 2026-07-02) */}
            <div className="mb-3 flex items-center justify-between">
              <a
                href={leaveHref}
                className="flex items-center gap-1 text-[12.5px] font-bold text-secondary"
              >
                <span aria-hidden="true" className="text-[15px] leading-none">
                  ‹
                </span>
                Leave
              </a>
              {live && !techDifficulties && (
                <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.06em] text-red">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 animate-fcpulse rounded-full bg-red"
                    style={{ boxShadow: "0 0 8px #f1232b" }}
                  />
                  LIVE
                </span>
              )}
            </div>

            {/* score (left) · YOUR game clock (right) — the clock is the
                commentator's clock minus this listener's sync delay, so it
                should read the same as their telly once synced (founder
                2026-07-02). Team codes on the display face; every ticking
                digit stays body-font tabular-nums. */}
            <div className="mb-3 grid grid-cols-2 items-center">
              <div className="flex items-center justify-center gap-2.5 border-r border-line/60">
                <span className="display text-[17px] tracking-[0.03em]">{abbr3(home)}</span>
                <span className="text-[28px] leading-none font-bold whitespace-nowrap tabular-nums">
                  {homeScore ?? 0} <span className="font-normal text-secondary">–</span>{" "}
                  {awayScore ?? 0}
                </span>
                <span className="display text-[17px] tracking-[0.03em]">{abbr3(away)}</span>
              </div>
              <div className="flex flex-col items-center justify-center">
                <span
                  className={`text-[28px] leading-none font-bold tabular-nums ${
                    syncedClock ? "" : "text-secondary"
                  }`}
                >
                  {syncedClock ?? "--:--"}
                </span>
                <span className="mt-1 font-mono text-[9px] tracking-[0.08em] text-secondary uppercase">
                  {syncedClock
                    ? syncRequested > 0
                      ? `Synced · −${
                          Number.isInteger(syncRequested)
                            ? syncRequested.toFixed(0)
                            : syncRequested.toFixed(1)
                        }s`
                      : "Match clock"
                    : "Clock not started"}
                </span>
              </div>
            </div>

            {/* play + host card (tech difficulties swaps in) */}
            {techDifficulties && !radioActive ? (
              <div className="mb-3 flex items-center gap-2.5">
                {playButton}
                <TechDifficultiesCard since={techSince} />
              </div>
            ) : (
              <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-line bg-raised px-3 py-2">
                {playButton}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-extrabold">
                    <span className="truncate">{commentator}</span>
                    <span className="shrink-0 rounded-[3px] border border-gold/50 px-1 py-0.5 font-mono text-[8px] tracking-[0.1em] text-gold uppercase">
                      Host
                    </span>
                  </p>
                  <p className="truncate font-mono text-[9px] text-secondary">{statusLine}</p>
                </div>
                {listenStatus === "live" && !radioActive && <EqTicks />}
              </div>
            )}

            {goOnAir && <div className="mb-3 flex">{goOnAir}</div>}

            {/* sync transport */}
            {!radioActive && syncSupported && (
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
            )}

            {/* radio + volume (kept from the old drawer — nothing lost) */}
            <div className="mt-3 flex items-center gap-3">
              {radioUrl !== null && live && radioToggle}
              <VolumeSlider
                volume={volume}
                onChange={onVolumeChange}
                className="min-w-0 flex-1"
              />
            </div>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded={true}
              aria-label="Collapse audio controls"
              className="mt-2.5 w-full py-1 text-center font-mono text-[9.5px] tracking-[0.03em] text-secondary transition-colors hover:text-primary"
            >
              Tap SYNC NOW when your telly matches the game time. Click here to
              collapse.
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-b border-line bg-inset px-3 py-2">
            <a
              href={leaveHref}
              aria-label="Leave room"
              className="shrink-0 px-1 text-base leading-none text-secondary"
            >
              ‹
            </a>
            {playButton}
            {goOnAir}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-expanded={false}
              aria-label="Expand audio controls"
              className="flex h-11 min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              {live && !techDifficulties && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 animate-fcpulse rounded-full bg-red"
                />
              )}
              <span className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
                <span className="display text-[15px] tracking-[0.03em]">{abbr3(home)}</span>
                <span className="text-[15px] font-bold tabular-nums">
                  {homeScore ?? 0}
                  <span className="font-normal text-secondary">–</span>
                  {awayScore ?? 0}
                </span>
                <span className="display text-[15px] tracking-[0.03em]">{abbr3(away)}</span>
              </span>
              {(listenStatus === "live" || radioActive) && !techDifficulties && (
                <EqTicks h={11} />
              )}
              {/* honest state label: tech trouble + radio + unsupported sync all
                  read differently — no fake "Synced" claims (audit 2026-07-02) */}
              <span
                className={`ml-auto min-w-0 truncate text-right font-mono text-[9px] tracking-[0.05em] uppercase ${
                  techDifficulties && !radioActive ? "text-red" : "text-secondary"
                }`}
              >
                {techDifficulties && !radioActive
                  ? "Tech difficulties ▼"
                  : radioActive
                    ? "Radio playing ▼"
                    : listenStatus === "live"
                      ? syncSupported
                        ? syncRequested > 0
                          ? "Synced · tap to nudge ▼"
                          : "Live · tap to sync ▼"
                        : "Live ▼"
                      : listenStatus === "error"
                        ? "Audio issue · expand ▼"
                        : "Tap for audio ▼"}
              </span>
            </button>
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
