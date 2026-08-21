"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { identityUserId } from "@/lib/livekitIdentity";
import {
  ConnectionState,
  LocalAudioTrack,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
} from "livekit-client";

/**
 * The room's audio engine (Phase 5). One LiveKit room per match room.
 * - Listeners: tap-to-listen (autoplay policy), subscribe-only.
 * - Commentator: mic through a Web Audio delay node (self-delay 0-5s).
 * - Guests: permission elevation flips canPublish live; they go on air
 *   with an explicit gesture, Leave Air revokes instantly.
 * - Technical difficulties (FR-4.5): commentator disconnect, or 10s of
 *   silence while unmuted.
 */

export type ListenStatus = "idle" | "connecting" | "live" | "error";
export type MicStatus = "off" | "starting" | "live";

export type Speaker = {
  identity: string;
  name: string;
  isCommentator: boolean;
  /** true when their published mic is muted, read from LiveKit rather than from
   *  whoever pressed the button — the host's chip used to track only its OWN
   *  taps, so a caller's self-mute was invisible to the host and vice versa
   *  (audit 2026-08-05) */
  muted: boolean;
};

// 25s so a natural commentary lull (pregame setup, a goal-kick, a sip of water)
// doesn't trip a false "technical difficulties" for the whole room (live-test
// review 2026-08-05); a genuine host disconnect is caught separately + instantly.
const SILENCE_SECONDS = 25;
const SILENCE_RMS = 0.0035;

/** iOS ignores element volume entirely (it is effectively read-only), so the
 *  volume-based background handoff below cannot work there; iOS keeps the
 *  muted keep-alive + radio mode as its background story (golden rule 3). */
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Android phone or similar: the platforms whose OS mutes WebRTC-backed audio
 *  in a backgrounded tab (proven by the 2026-08-21 bg_audio_snapshot: element
 *  playing, unmuted, volume 1, connection live - and inaudible). Desktop keeps
 *  WebRTC audible in background, iOS ignores element volume, so the background
 *  radio handoff below applies only here. */
function needsBackgroundRadio(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|Mobi/i.test(navigator.userAgent) && !isIOS();
}

/** Point an <audio> element at our HLS stream: natively where the browser can
 *  (Safari/iOS), via hls.js (MediaSource) everywhere else - which is what
 *  finally makes radio REAL on Android and desktop Chrome instead of
 *  Safari-only. Returns a cleanup that detaches the engine. */
async function attachHls(
  el: HTMLAudioElement,
  url: string,
  /** called when the engine is genuinely dead (recovery exhausted) */
  onDead?: () => void,
): Promise<(() => void) | null> {
  if (el.canPlayType("application/vnd.apple.mpegurl")) {
    el.src = url;
    return () => {
      el.removeAttribute("src");
      el.load();
    };
  }
  try {
    const { default: Hls } = await import("hls.js");
    if (!Hls.isSupported()) return null;
    const hls = new Hls({
      // Hug the live edge (founder 2026-08-21). With 1s segments (lib/egress)
      // this targets ~2s behind the newest segment, 1.5x catch-up playback
      // when drifting, hard resync past 6 segments.
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 6,
      maxLiveSyncPlaybackRate: 1.5,
      maxBufferLength: 12,
      backBufferLength: 30,
    });
    hls.loadSource(url);
    hls.attachMedia(el);
    // A mid-show egress restart replaces the playlist and resets its media
    // sequence, which lands here as a fatal error. Dying permanently bricked
    // every armed listener (proven live 2026-08-21: the understudy froze at
    // t=6 with ready=2 after a restart). Recover the standard hls.js way and
    // only report dead after repeated failures.
    let recoveries = 0;
    hls.on(
      Hls.Events.ERROR,
      (_e: unknown, data: { fatal?: boolean; type?: string }) => {
        if (!data?.fatal) return;
        recoveries++;
        if (recoveries > 4) {
          try {
            hls.destroy();
          } catch {}
          onDead?.();
          return;
        }
        if (data.type === "networkError") hls.startLoad();
        else if (data.type === "mediaError") hls.recoverMediaError();
        else {
          try {
            hls.destroy();
          } catch {}
          onDead?.();
        }
      },
    );
    return () => {
      try {
        hls.destroy();
      } catch {}
      el.removeAttribute("src");
      el.load();
    };
  } catch {
    return null;
  }
}

export function useRoomAudio(opts: {
  roomId: string;
  commentatorId: string;
  /** viewer's user id, null when anonymous */
  viewerId: string | null;
  isRoomCommentator: boolean;
  /** radio (HLS) playlist for this room, null until egress starts */
  hlsUrl: string | null;
}) {
  const [listenStatus, setListenStatus] = useState<ListenStatus>("idle");
  // mirrored in a ref so event handlers can report the status at drop time
  const listenStatusRef = useRef<ListenStatus>("idle");
  useEffect(() => {
    listenStatusRef.current = listenStatus;
  }, [listenStatus]);
  // set when a gesture-less autostart is blocked by the browser (iOS Safari, or
  // a browser with no media engagement) so the UI can show a "Tap to listen"
  // prompt instead of failing silently (founder 2026-08-05)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatus>("off");
  const [micMuted, setMicMuted] = useState(false);
  // set when starting the mic fails (esp. a denied mic permission) so a caller
  // gets a clear reason instead of the "Go on air" button silently reverting
  // (live-test review 2026-08-05)
  const [micError, setMicError] = useState<string | null>(null);
  const micStartingRef = useRef(false);
  const micStartGenRef = useRef(0);
  // true only when the listener THEMSELVES stopped playback (pause / radio
  // switch). An involuntary LiveKit drop leaves this false, which is how the
  // room tells "they chose silence" apart from "the audio died on them"
  // (adversarial review 2026-08-05).
  const [userStopped, setUserStopped] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [selfDelay, setSelfDelayState] = useState(0);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [techDifficulties, setTechDifficulties] = useState(false);
  const [techSince, setTechSince] = useState<number | null>(null);
  const [radioActive, setRadioActive] = useState(false);
  const radioElRef = useRef<HTMLAudioElement | null>(null);
  // Background radio (Android): a SECOND, silent HLS element pre-armed while
  // the live path plays. Android's OS mutes WebRTC-backed audio in hidden
  // tabs but keeps real media elements sounding, so backgrounding raises this
  // element's volume and foregrounding zeroes it again. Pre-armed inside the
  // listen session (not started while hidden) so no autoplay policy is ever
  // asked to bless a background start.
  const bgRadioRef = useRef<HTMLAudioElement | null>(null);
  const bgRadioCleanupRef = useRef<(() => void) | null>(null);
  const hlsUrlRef = useRef<string | null>(opts.hlsUrl);
  useEffect(() => {
    hlsUrlRef.current = opts.hlsUrl;
  }, [opts.hlsUrl]);

  // listener volume (0..1). The live sync path is scaled by a Web Audio gain
  // node (the only volume control iOS Safari honours — element .volume is a
  // no-op there); radio / no-worklet fallback fall back to element .volume.
  const [volume, setVolumeState] = useState(1);
  const volumeRef = useRef(1);
  const gainRef = useRef<GainNode | null>(null);

  // sync ring buffer (FR-6): requested vs effective offset + buffered depth
  const [syncRequested, setSyncRequested] = useState(0);
  const syncRequestedRef = useRef(0);
  // Call-in sync snap (founder 2026-08-03): while a listener-caller is on air,
  // their playback snaps to the live edge (delay 0) so the conversation with the
  // host is real time, not behind by their sync offset. After the call they
  // STAY at the live edge and the saved offset is cleared (founder 2026-08-21;
  // see restorePlaybackSync).
  const liveSnapRef = useRef(false);
  const [syncEffective, setSyncEffective] = useState(0);
  const [syncAvailable, setSyncAvailable] = useState(0);
  const [syncSupported, setSyncSupported] = useState(true);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const playbackElRef = useRef<HTMLAudioElement | null>(null);
  const trackNodesRef = useRef<
    Map<string, { src: MediaStreamAudioSourceNode; el: HTMLElement[] }>
  >(new Map());

  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const publishedTrackRef = useRef<LocalAudioTrack | null>(null);
  const analyserRef = useRef<{
    ctx: AudioContext;
    analyser: AnalyserNode;
    src: MediaStreamAudioSourceNode;
  } | null>(null);
  const silentSinceRef = useRef<number | null>(null);
  const commentatorTrackRef = useRef<RemoteTrack | null>(null);

  const setAudioContainer = useCallback((el: HTMLDivElement | null) => {
    audioContainerRef.current = el;
  }, []);

  // surface the per-session saved offset immediately (it's applied to the
  // audio graph when listening starts)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`fc_sync_${opts.roomId}`);
      if (saved !== null) {
        const s = Number(saved);
        if (Number.isFinite(s) && s > 0) {
          setSyncRequested(s);
          syncRequestedRef.current = s;
        }
      }
    } catch {}
  }, [opts.roomId]);

  /* ------------------------------------------------ tech difficulties */

  const clearTech = useCallback(() => {
    setTechDifficulties(false);
    setTechSince(null);
    silentSinceRef.current = null;
  }, []);

  const flagTech = useCallback(() => {
    setTechDifficulties(true);
    setTechSince((prev) => prev ?? Date.now());
  }, []);

  function watchCommentatorTrack(track: RemoteTrack) {
    commentatorTrackRef.current = track;
    stopAnalyser();
    try {
      // reuse the gesture-unlocked playback context: a context created
      // here (post-await, outside the tap) starts suspended on iOS and
      // would read eternal silence -> false "technical difficulties"
      const ctx = playbackCtxRef.current;
      if (!ctx) return;
      const stream = new MediaStream([track.mediaStreamTrack]);
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      analyserRef.current = { ctx, analyser, src };
    } catch {
      // analyser is best-effort; disconnect detection still works
    }
  }

  function stopAnalyser() {
    if (analyserRef.current) {
      // the context is the shared playback context — never close it here
      analyserRef.current.src.disconnect();
      analyserRef.current.analyser.disconnect();
      analyserRef.current = null;
    }
    silentSinceRef.current = null;
  }

  useEffect(() => {
    const id = setInterval(() => {
      const a = analyserRef.current;
      const track = commentatorTrackRef.current;
      // a non-running context yields all-zero data — that's "no signal
      // to judge", never "silence"
      if (!a || a.ctx.state !== "running" || !track || track.isMuted) {
        silentSinceRef.current = null;
        return;
      }
      const buf = new Float32Array(a.analyser.fftSize);
      a.analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      if (rms < SILENCE_RMS) {
        silentSinceRef.current ??= Date.now();
        if (Date.now() - silentSinceRef.current > SILENCE_SECONDS * 1000) {
          flagTech();
        }
      } else {
        silentSinceRef.current = null;
        clearTech();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [flagTech, clearTech]);

  /* ----------------------------------------------- sync playback graph */

  /**
   * Listener playback path (FR-6): every remote track feeds one shared
   * ring-buffer worklet; its output drives a single audible element via
   * MediaStreamDestination (keeps MediaSession + iOS happy). Falls back
   * to plain per-track elements when AudioWorklet is unavailable.
   */
  function teardownPlaybackGraph() {
    stopAnalyser(); // its nodes live on this context
    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = null;
    workletRef.current = null;
    gainRef.current = null;
    if (playbackElRef.current) {
      playbackElRef.current.pause();
      playbackElRef.current.srcObject = null;
    }
  }

  async function ensurePlaybackGraph(): Promise<{
    blocked: boolean;
    worklet: boolean;
  }> {
    // HOSTS SKIP THE SYNC GRAPH (founder 2026-08-05: call-in conversation had a
    // 1-2s lag). Sync-to-TV is a listener feature — a host has no sync UI and no
    // volume slider — so for them the ring buffer + MediaStreamDestination +
    // <audio> detour is pure latency on the one path where it matters most:
    // hearing an on-air caller. Returning here falls through to the existing
    // plain-attached-element branch in TrackSubscribed (the same path browsers
    // without AudioWorklet already use), cutting ~110-280ms off the round trip.
    // It also makes it impossible for a host to sit behind the live edge on a
    // stale saved sync offset, since they no longer have a worklet at all.
    if (opts.isRoomCommentator) return { blocked: false, worklet: false };
    // resume() is NOT awaited bare anywhere in this function. On iOS it
    // resolves and leaves the context "suspended"; on Chrome Android, outside a
    // real tap, it stays PENDING FOREVER. Awaiting it unbounded hung the silent
    // autostart, which kept the gate suppressed - the "gate flashed once then
    // vanished, no way to play" report from the 2026-08-21 live test, on both
    // Brave and Chrome. Bounded: if the context is not running shortly, the
    // caller treats it as autoplay-blocked and shows the one-tap gate; inside a
    // real gesture resume() completes immediately, so the bound never bites.
    const resumeBounded = async (ctx: AudioContext) => {
      await Promise.race([
        ctx.resume().catch(() => {}),
        new Promise<void>((res) => setTimeout(res, 1200)),
      ]);
    };
    if (playbackCtxRef.current) {
      await resumeBounded(playbackCtxRef.current);
      if (playbackCtxRef.current.state !== "running") {
        // suspended with no gesture to open it: blocked, NOT unsupported. Keep
        // the graph - the gate's tap re-enters here with real activation.
        return { blocked: true, worklet: workletRef.current !== null };
      }
      // iOS can pause the element across interruptions/backgrounding —
      // a dead audible element means the whole sync path is silent
      const replayed = await playbackElRef.current
        ?.play()
        .then(() => true)
        .catch(() => false);
      if (replayed === false) {
        console.warn("sync playback element blocked on resume — falling back");
        teardownPlaybackGraph();
        setSyncSupported(false);
        return { blocked: true, worklet: false };
      }
      return { blocked: false, worklet: workletRef.current !== null };
    }
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
    } catch {
      setSyncSupported(false);
      return { blocked: false, worklet: false };
    }
    await resumeBounded(ctx);
    // Autoplay gate: outside a user gesture (iOS Safari, or a browser with no
    // media engagement) resume() RESOLVES but leaves the context "suspended"
    // and el.play() below would reject. A "running" context is the single
    // reliable proof the gate is open — treat anything else as blocked (the
    // caller shows a one-tap prompt) rather than tearing the sync path down as
    // "unsupported". Inside a real gesture, resume() reaches "running".
    if (ctx.state !== "running") {
      await ctx.close().catch(() => {});
      return { blocked: true, worklet: false };
    }
    try {
      await ctx.audioWorklet.addModule("/ring-delay-worklet.js");
      const node = new AudioWorkletNode(ctx, "ring-delay", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      node.port.onmessage = (e) => {
        if (e.data?.type === "state") {
          setSyncAvailable(e.data.availableSeconds as number);
          setSyncEffective(e.data.effectiveDelaySeconds as number);
        }
      };
      const dest = ctx.createMediaStreamDestination();
      // gain sits between the ring-delay worklet and the audible stream so the
      // volume slider works on iOS (where element .volume is ignored)
      const gain = ctx.createGain();
      gain.gain.value = volumeRef.current;
      node.connect(gain);
      gain.connect(dest);
      gainRef.current = gain;
      let el = playbackElRef.current;
      if (!el) {
        el = new Audio();
        el.autoplay = true;
        playbackElRef.current = el;
      }
      el.srcObject = dest.stream;
      // the audible element is the ONLY sound output of the sync path —
      // if it can't play, fall back to plain attached elements, which
      // room.startAudio() knows how to rescue
      await el.play();
      playbackCtxRef.current = ctx;
      workletRef.current = node;

      // per-session offset persistence (FR-6.2)
      try {
        const saved = sessionStorage.getItem(`fc_sync_${opts.roomId}`);
        if (saved !== null) {
          const s = Number(saved);
          if (Number.isFinite(s) && s > 0) {
            setSyncRequested(s);
            syncRequestedRef.current = s;
            node.port.postMessage({ type: "setDelay", seconds: s });
          }
        }
      } catch {}
      return { blocked: false, worklet: true };
    } catch (err) {
      // context is running but the worklet is unavailable (old browser) — a
      // capability fallback to element playback, NOT an autoplay block
      console.warn("sync buffer unavailable, falling back to live-edge:", err);
      ctx.close().catch(() => {});
      if (playbackElRef.current) {
        playbackElRef.current.pause();
        playbackElRef.current.srcObject = null;
      }
      setSyncSupported(false);
      playbackCtxRef.current = null;
      workletRef.current = null;
      return { blocked: false, worklet: false };
    }
  }

  const setSyncOffset = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, Math.min(90, Math.round(seconds * 10) / 10));
      setSyncRequested(clamped);
      syncRequestedRef.current = clamped;
      // while snapped to live for an on-air call, keep playback at the live edge;
      // the new value just becomes what we restore to when the call ends.
      if (!liveSnapRef.current) {
        workletRef.current?.port.postMessage({
          type: "setDelay",
          seconds: clamped,
        });
      }
      try {
        sessionStorage.setItem(`fc_sync_${opts.roomId}`, String(clamped));
      } catch {}
    },
    [opts.roomId],
  );

  /** Ref-backed stepper: rapid taps never read a stale render value. */
  const adjustSyncOffset = useCallback(
    (delta: number) => setSyncOffset(syncRequestedRef.current + delta),
    [setSyncOffset],
  );

  /** Snap playback to the live edge for an on-air call (ref-only; no persist). */
  function snapPlaybackToLive() {
    liveSnapRef.current = true;
    workletRef.current?.port.postMessage({ type: "setDelay", seconds: 0 });
  }
  /** After a call ends the caller STAYS at the live edge (founder 2026-08-21,
   *  supersedes the 2026-08-03 "restore the pre-call offset" behaviour).
   *  Restoring silently put a caller 3-4s behind the conversation they were
   *  just part of - a SYNC NOW tap earlier in the session leaves an offset in
   *  sessionStorage, so "I never adjusted anything" callers were rewound
   *  without any indication. The saved offset is cleared too; re-syncing to a
   *  TV is one tap in the drawer, being secretly behind is not fixable. */
  function restorePlaybackSync() {
    if (!liveSnapRef.current) return;
    liveSnapRef.current = false;
    syncRequestedRef.current = 0;
    setSyncRequested(0);
    try {
      sessionStorage.removeItem(`fc_sync_${opts.roomId}`);
    } catch {}
    workletRef.current?.port.postMessage({ type: "setDelay", seconds: 0 });
    // and drop the buffered timeline: any backlog that built up during the
    // call (device route changes stall the sink) must not replay as lag
    workletRef.current?.port.postMessage({ type: "reset" });
  }

  /* -------------------------------------------------------- connection */

  const refreshSpeakers = useCallback((room: Room) => {
    // Speaker.identity carries the ACCOUNT id, not the raw connection identity:
    // everything downstream (end call, mute, flag) addresses a user, and those
    // routes validate a uuid. Dedupe so one account on two devices is one chip.
    const seen = new Set<string>();
    const remote: Speaker[] = [];
    for (const p of room.remoteParticipants.values()) {
      if (p.audioTrackPublications.size === 0) continue;
      const userId = identityUserId(p.identity);
      if (seen.has(userId)) continue;
      seen.add(userId);
      remote.push({
        identity: userId,
        name: p.name || userId,
        isCommentator: userId === opts.commentatorId,
        // truth from LiveKit: every audio publication of theirs is muted
        muted: [...p.audioTrackPublications.values()].every((pub) => pub.isMuted),
      });
    }
    if (publishedTrackRef.current && opts.viewerId) {
      remote.push({
        identity: opts.viewerId,
        name: "you",
        isCommentator: opts.isRoomCommentator,
        muted: publishedTrackRef.current.isMuted,
      });
    }
    setSpeakers(remote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.commentatorId, opts.viewerId, opts.isRoomCommentator]);

  /** Optimistically drop one account's chip (e.g. the host's ✕ succeeded).
   *  LiveKit remains the source of truth: if they are somehow still
   *  publishing, the next track event re-adds them. */
  const dropSpeaker = useCallback((userId: string) => {
    setSpeakers((prev) => prev.filter((s) => s.identity !== userId));
  }, []);

  const connectPromiseRef = useRef<Promise<Room | null> | null>(null);

  const connect = useCallback(
    async (gestured = true): Promise<Room | null> => {
      if (roomRef.current) return roomRef.current;
      // overlapping calls (play button, lock-screen play, go-on-air) must
      // share one attempt — a second Room here would be unstoppable
      if (connectPromiseRef.current) return connectPromiseRef.current;
      const attempt = doConnect(gestured).finally(() => {
        connectPromiseRef.current = null;
      });
      connectPromiseRef.current = attempt;
      return attempt;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opts.roomId, opts.commentatorId, opts.isRoomCommentator],
  );

  async function doConnect(gestured: boolean): Promise<Room | null> {
    setUserStopped(false); // any (re)connect attempt means they want audio
    // a gestured start (Play tap / lock-screen / go-on-air) shows "Connecting…"
    // immediately; a silent autostart stays idle until we know it isn't blocked
    if (gestured) setListenStatus("connecting");
    let room: Room | null = null;
    try {
      // build the sync graph inside the user gesture, before any track
      // subscription can fire
      const graph = await ensurePlaybackGraph();
      // a gesture-less autostart the browser blocked (iOS Safari, no media
      // engagement): surface the one-tap prompt and DO NOT open a LiveKit room
      // — no silent half-connect, no wasted participant slot
      if (!gestured && graph.blocked) {
        setAutoplayBlocked(true);
        setListenStatus("idle");
        return null;
      }
      setAutoplayBlocked(false);
      setListenStatus("connecting");
      const res = await fetch(`/api/livekit/token?room=${opts.roomId}`, {
        // a stalled token fetch must fail into the catch, not hang "connecting"
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error("token request failed");
      const { token, url, canPublish: granted } = await res.json();
      setCanPublish(granted);

      // disconnectOnPageLeave defaults to TRUE and fires on 'pagehide' -
      // which Android sends when it freezes a backgrounded tab. The SDK was
      // HANGING UP THE CALL the moment a listener switched apps (the
      // "client initiated" disconnects in telemetry, live-test 2026-08-21),
      // which is why no amount of element juggling kept background audio
      // alive. A real tab close still disconnects: the websocket dies with
      // the page and the server reaps the participant.
      const r = new Room({ disconnectOnPageLeave: false });
      room = r;
      roomRef.current = r;

      r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Audio) return;
        const ctx = playbackCtxRef.current;
        const worklet = workletRef.current;
        if (ctx && worklet) {
          // A muted element keeps Safari delivering WebRTC frames; the audible
          // output comes from the ring-buffer graph. It is deliberately OUR OWN
          // element, never track.attach(): livekit-client's Room.startAudio()
          // force-unmutes every element the SDK knows about (`e.muted = false;
          // e.play()`), which made this keep-alive audible at the live edge
          // ALONGSIDE the worklet output a few hundred ms behind it - the
          // persistent "slight echo" every sync-path listener could hit,
          // timing-dependent per browser (live-test 2026-08-21; the published
          // stream measured clean while phones heard doubling). An element the
          // SDK has never seen stays muted forever.
          const ms = new MediaStream([track.mediaStreamTrack]);
          const el = document.createElement("audio");
          // Non-iOS: UNMUTED at volume 0, established while the page holds the
          // listen tap's activation. Backgrounding then only RAISES the volume
          // - volume changes are never autoplay-gated, whereas unmuting a muted
          // element inside a hidden tab can be refused outright. iOS ignores
          // element volume, so there it stays muted (radio covers background).
          if (isIOS()) {
            el.muted = true;
          } else {
            el.muted = false;
            el.volume = 0;
          }
          el.autoplay = true;
          el.setAttribute("playsinline", "");
          el.srcObject = ms;
          void el.play().catch(() => {});
          audioContainerRef.current?.appendChild(el);
          const src = ctx.createMediaStreamSource(ms);
          src.connect(worklet);
          trackNodesRef.current.set(track.sid ?? participant.identity, {
            src,
            el: [el],
          });
        } else {
          // no-worklet fallback: live-edge element playback, no sync
          const el = track.attach() as HTMLAudioElement;
          el.volume = volumeRef.current; // desktop only; iOS ignores it
          audioContainerRef.current?.appendChild(el);
        }
        if (identityUserId(participant.identity) === opts.commentatorId) {
          watchCommentatorTrack(track);
          clearTech();
        }
        refreshSpeakers(r);
      });
      // TrackUnsubscribed can fire BEFORE the SDK drops the publication from
      // participant.audioTrackPublications, so a refresh from that handler
      // alone can still count the caller and leave a stale LIVE chip on the
      // host's bar after the X (live-test 2026-08-21). TrackUnpublished is the
      // event that means the publication itself is gone.
      r.on(RoomEvent.TrackUnpublished, () => refreshSpeakers(r));
      r.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        const node = trackNodesRef.current.get(
          track.sid ?? participant.identity,
        );
        if (node) {
          node.src.disconnect();
          // the keep-alive element is OURS (not SDK-attached, see subscribe),
          // so track.detach() below cannot remove it - do it here
          for (const el of node.el) {
            (el as HTMLAudioElement).srcObject = null;
            el.remove();
          }
          trackNodesRef.current.delete(track.sid ?? participant.identity);
        }
        track.detach().forEach((el) => el.remove());
        if (identityUserId(participant.identity) === opts.commentatorId) {
          stopAnalyser();
          commentatorTrackRef.current = null;
        }
        refreshSpeakers(r);
      });
      r.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        if (identityUserId(p.identity) === opts.commentatorId && !opts.isRoomCommentator) {
          flagTech();
        }
        refreshSpeakers(r);
      });
      r.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        if (identityUserId(p.identity) === opts.commentatorId) clearTech();
        refreshSpeakers(r);
      });
      r.on(RoomEvent.ParticipantPermissionsChanged, () => {
        const perms = r.localParticipant.permissions;
        setCanPublish(perms?.canPublish ?? false);
        if (!(perms?.canPublish ?? false)) {
          void stopMicInternal();
        }
      });
      // Mute state is authoritative from LiveKit, not from whoever tapped.
      // A host mute lands on the guest as a remote mute of their LOCAL track,
      // so without this the guest's card kept saying "the room can hear you"
      // and their own Mute button would have UNMUTED them (audit 2026-08-05).
      const onMuteChanged = (
        pub: { isMuted: boolean },
        participant: { identity: string },
      ) => {
        if (participant.identity === r.localParticipant.identity) {
          setMicMuted(pub.isMuted);
        }
        refreshSpeakers(r);
      };
      r.on(RoomEvent.TrackMuted, onMuteChanged);
      r.on(RoomEvent.TrackUnmuted, onMuteChanged);
      r.on(RoomEvent.Disconnected, (reason) => {
        // Record WHY. A drop is otherwise indistinguishable from a deliberate
        // stop, and DUPLICATE_IDENTITY (the same account connecting elsewhere)
        // is exactly the failure that made the play button look dead for
        // signed-in listeners (founder report 2026-08-05).
        const why = reason !== undefined ? String(reason) : "unknown";
        if (why !== "unknown") {
          track("audio_disconnected", {
            roomId: opts.roomId,
            props: { reason: why, wasListening: listenStatusRef.current },
          });
        }
        // stop the mic FIRST (it reads roomRef): an unexpected drop must
        // not leave getUserMedia capturing with the indicator lit
        void stopMicInternal();
        if (roomRef.current === r) roomRef.current = null;
        setListenStatus("idle");
        stopAnalyser();
      });
      r.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) setListenStatus("live");
        else if (state === ConnectionState.Reconnecting)
          setListenStatus("connecting");
      });

      // WATCHDOG (live-test 2026-08-21). A browser that BLOCKS WebRTC (Brave
      // with Shields up) can stall connect() rather than reject it. Untended,
      // that did two bad things at once: the status sat on "connecting" forever
      // so the listen gate never came back (the "gate flashed then vanished"
      // report), and the attempt could finally sneak through MINUTES later in a
      // background tab - which is how a phone ended up playing the stream twice
      // and hearing everything echoed. Past the deadline we kill the attempt:
      // the catch below tears the half-open room down and shows a real error.
      let cancelDeadline: () => void = () => {};
      const deadline = new Promise<never>((_, reject) => {
        const t = setTimeout(
          () => reject(new Error("connect timed out (browser may be blocking live audio)")),
          15_000,
        );
        cancelDeadline = () => clearTimeout(t);
      });
      deadline.catch(() => {}); // never an unhandled rejection after success
      try {
        await Promise.race([r.connect(url, token), deadline]);
        await Promise.race([r.startAudio(), deadline]); // inside the user gesture
      } finally {
        cancelDeadline();
      }
      setListenStatus("live");
      refreshSpeakers(r);
      void ensureBgRadio(); // silent HLS understudy for Android backgrounding
      return r;
    } catch (err) {
      console.error("audio connect failed:", err);
      track("audio_connect_failed", {
        roomId: opts.roomId,
        props: {
          gestured,
          message: String((err as Error)?.message ?? err).slice(0, 200),
        },
      });
      // never orphan a half-connected room — its handlers would keep
      // feeding audio with no way to stop it
      if (room) {
        await room.disconnect().catch(() => {});
      }
      if (roomRef.current === room) roomRef.current = null;
      setListenStatus("error");
      return null;
    }
  }

  const disconnect = useCallback(async () => {
    setUserStopped(true); // deliberate stop — don't re-gate them
    teardownBgRadio();
    await stopMicInternal();
    await roomRef.current?.disconnect();
    roomRef.current = null;
    // explicitly disconnect each source node before dropping the map — a
    // TrackUnsubscribed that lands after room.disconnect() would otherwise miss
    // its entry and leave an orphaned MediaStreamAudioSourceNode on the worklet
    // (audit polish — slow leak across stop/restart cycles)
    trackNodesRef.current.forEach((n) => {
      try {
        n.src.disconnect();
      } catch {
        /* already disconnected */
      }
      // our own keep-alive elements (not SDK-attached) go with the map
      for (const el of n.el) {
        (el as HTMLAudioElement).srcObject = null;
        el.remove();
      }
    });
    trackNodesRef.current.clear();
    // drop the buffered timeline: resuming later must not replay stale
    // audio from before the stop
    workletRef.current?.port.postMessage({ type: "reset" });
    setSyncAvailable(0);
    setSyncEffective(0);
    // full teardown (not just suspend) so a later replay builds a FRESH context
    // inside its gesture (same path as the first play). iOS Safari won't reliably
    // resume a suspended context + MediaStream element, which left "tap play to
    // restart" doing nothing after a pause (founder 2026-08-05).
    teardownPlaybackGraph();
    setListenStatus("idle");
    setAutoplayBlocked(false);
    clearTech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------- background continuation (Android) */

  // Keep the live path audible when the app is backgrounded (founder
  // 2026-08-21). Android suspends the WebAudio pipeline in a hidden tab; the
  // audible element's SOURCE is that pipeline, so playback went silent, Chrome
  // then throttled the "silent" tab, and the connection died. While hidden,
  // the OWNED keep-alive elements (fed straight from the WebRTC stream, no
  // graph involved - the same elements the echo fix made ours) become the
  // audible path at the live edge; on return the graph takes back over.
  //
  // Deliberate exception: a listener with a sync offset (behind their TV) is
  // NOT switched - the keep-alives play the live edge, which would spoil
  // goals for someone listening ahead of their own feed. They keep the old
  // behaviour (background = silence, resumes on return). iOS is untested here;
  // radio mode remains the certified background path there (golden rule 3).
  const bgEngagedRef = useRef(false);
  const teardownBgRadio = useCallback(() => {
    bgRadioRef.current?.pause();
    bgRadioCleanupRef.current?.();
    bgRadioCleanupRef.current = null;
    bgRadioRef.current = null;
  }, []);
  const bgRetryRef = useRef(0);
  const ensureBgRadio = useCallback(async () => {
    if (!needsBackgroundRadio()) return;
    if (!hlsUrlRef.current || bgRadioRef.current) return;
    if (bgRetryRef.current > 5) return; // a truly dead stream: stop looping
    const el = new Audio();
    el.volume = 0; // unmuted, silent - volume changes are never policy-gated
    el.setAttribute("playsinline", "");
    bgRadioRef.current = el;
    // an egress restart or stream death re-arms rather than bricking the
    // listener until reload (the 2026-08-21 failure mode)
    const rearm = () => {
      if (bgRadioRef.current !== el) return;
      bgRetryRef.current++;
      teardownBgRadio();
      setTimeout(() => {
        if (listenStatusRef.current === "live") void ensureBgRadio();
      }, 4000);
    };
    const cleanup = await attachHls(el, hlsUrlRef.current, rearm);
    if (!cleanup || bgRadioRef.current !== el) {
      // no engine, or torn down while attaching - don't fake coverage
      if (bgRadioRef.current === el) bgRadioRef.current = null;
      cleanup?.();
      return;
    }
    bgRadioCleanupRef.current = cleanup;
    el.addEventListener("error", rearm);
    el.addEventListener("playing", () => {
      if (bgRadioRef.current === el) bgRetryRef.current = 0; // healthy again
    });
    // starvation without a fatal error (frozen position, ready<3): heal it
    el.addEventListener("waiting", () => {
      setTimeout(() => {
        if (bgRadioRef.current !== el) return;
        if (el.readyState >= 3 && !el.paused) return; // recovered on its own
        rearm();
      }, 3000);
    });
    void el.play().catch(() => {
      // couldn't start (rare - page has sticky activation by now)
      rearm();
    });
    // re-armed WHILE backgrounded: come back audible, not silently at vol 0
    if (bgEngagedRef.current) el.volume = volumeRef.current;
  }, [teardownBgRadio]);
  // egress can start mid-show (it did on 2026-08-21): arm as soon as the url
  // exists while already listening
  useEffect(() => {
    if (opts.hlsUrl && listenStatusRef.current === "live") void ensureBgRadio();
  }, [opts.hlsUrl, ensureBgRadio]);
  useEffect(() => {
    const onVis = () => {
      if (!needsBackgroundRadio()) return; // desktop keeps WebRTC; iOS: radio toggle
      if (document.visibilityState === "hidden") {
        if (listenStatusRef.current !== "live") return;
        const bg = bgRadioRef.current;
        if (!bg) return; // no armed radio path - nothing that can survive
        bgEngagedRef.current = true;
        // radio trails live by ~10-20s: for a live-edge listener that means a
        // short replay on handoff, which beats silence; a SYNCED listener is
        // deliberately behind their TV, and radio's lag is usually LESS than
        // a TV sync offset, so the same guard from the earlier design applies
        if (syncRequestedRef.current > 0 && !liveSnapRef.current) {
          bgEngagedRef.current = false;
          return;
        }
        bg.volume = volumeRef.current;
        if (bg.paused) void bg.play().catch(() => {});
        playbackElRef.current?.pause();
      } else {
        if (!bgEngagedRef.current) return;
        bgEngagedRef.current = false;
        // diagnose what the background actually did to us - this event is the
        // difference between "not working" and knowing which part died
        const kas: { paused: boolean; muted: boolean; vol: number }[] = [];
        trackNodesRef.current.forEach((n) => {
          for (const el of n.el) {
            const a = el as HTMLAudioElement;
            kas.push({ paused: a.paused, muted: a.muted, vol: a.volume });
          }
        });
        const bg = bgRadioRef.current;
        track("bg_audio_snapshot", {
          roomId: opts.roomId,
          props: {
            keepAlives: JSON.stringify(kas).slice(0, 160),
            ctx: playbackCtxRef.current?.state ?? "none",
            listen: listenStatusRef.current,
            lkState: roomRef.current?.state ?? "none",
            bgRadio: bg
              ? JSON.stringify({ paused: bg.paused, vol: bg.volume, ready: bg.readyState, t: Math.round(bg.currentTime) })
              : "none",
          },
        });
        const pb = playbackElRef.current;
        const silenceBg = () => {
          if (bgRadioRef.current) bgRadioRef.current.volume = 0;
        };
        if (!pb) {
          silenceBg();
          return;
        }
        void pb
          .play()
          .then(silenceBg)
          .catch(() => {
            /* radio stays audible; the next gesture rebuilds the graph */
          });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------- radio mode (HLS) */

  const radioCleanupRef = useRef<(() => void) | null>(null);
  const enableRadio = useCallback(
    async (url: string) => {
      await disconnect(); // WebRTC and HLS paths are mutually exclusive
      let el = radioElRef.current;
      if (!el) {
        el = new Audio();
        el.preload = "none";
        // a mid-stream HLS drop/load failure: reset the toggle so the listener
        // isn't stuck "on but silent" and can re-tap (Phase 10 hardening)
        el.addEventListener("error", () => setRadioActive(false));
        radioElRef.current = el;
      }
      el.volume = volumeRef.current; // desktop/Android; iOS ignores element volume
      radioCleanupRef.current?.();
      radioCleanupRef.current = await attachHls(el, url);
      if (!radioCleanupRef.current) {
        console.error("radio: no HLS engine available");
        setRadioActive(false);
        return;
      }
      try {
        await el.play(); // called inside the toggle gesture
        setRadioActive(true);
      } catch (err) {
        console.error("radio playback failed:", err);
        setRadioActive(false);
      }
    },
    [disconnect],
  );

  const disableRadio = useCallback(() => {
    const el = radioElRef.current;
    if (el) el.pause();
    radioCleanupRef.current?.();
    radioCleanupRef.current = null;
    setRadioActive(false);
  }, []);

  const setVolume = useCallback((v: number) => {
    const vol = Math.max(0, Math.min(1, v));
    volumeRef.current = vol;
    setVolumeState(vol);
    // live sync path — the iOS-correct control
    if (gainRef.current) gainRef.current.gain.value = vol;
    // radio + any no-worklet fallback elements (desktop; iOS uses hardware)
    if (radioElRef.current) radioElRef.current.volume = vol;
    audioContainerRef.current?.querySelectorAll("audio,video").forEach((node) => {
      const m = node as HTMLMediaElement;
      if (!m.muted) m.volume = vol;
    });
  }, []);

  /* --------------------------------------------------------- publisher */

  async function stopMicInternal() {
    // caller leaving air (self-leave / host-removed / disconnect): restore their
    // pre-call sync offset so their audio realigns with their own video feed
    restorePlaybackSync();
    if (publishedTrackRef.current && roomRef.current) {
      await roomRef.current.localParticipant
        .unpublishTrack(publishedTrackRef.current)
        .catch(() => {});
      publishedTrackRef.current.stop();
      publishedTrackRef.current = null;
    }
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      delayNodeRef.current = null;
    }
    setMicStatus("off");
    setMicMuted(false);
  }

  // `gestured` is false for the automatic start when a host accepts a call-in:
  // that runs from an Ably callback with no user activation, which iOS Safari
  // rejects — the error copy has to send them to the button, not to Settings.
  const startMic = useCallback(async (gestured = true) => {
    // RE-ENTRANCY GUARD: two concurrent starts each open their own getUserMedia
    // stream + published track and overwrite the refs, orphaning the first — it
    // then keeps capturing after Leave Air (mic indicator stays lit). Mirrors
    // connect()'s connectPromiseRef dedupe. Also covers a StrictMode double
    // effect and a double-tap. (adversarial review 2026-08-05)
    if (publishedTrackRef.current) return; // already publishing
    // A USER TAP ALWAYS PREEMPTS. The old guard returned early whenever an
    // attempt was in flight, so once one hung on a permission prompt the lock
    // stuck and every tap became a no-op that merely cleared the error label —
    // which looked like "the button just shows another button" (founder
    // 2026-08-05). Only the AUTOMATIC start defers to an attempt already
    // running; the generation token below still stops a stale attempt from
    // publishing behind this one's back.
    if (!gestured && micStartingRef.current) return;
    micStartingRef.current = true;
    // Generation token: getUserMedia can stay PENDING FOREVER while a permission
    // prompt sits unanswered (exactly what hangs an auto-start on accept). The
    // watchdog cancels the attempt; if this one later resolves anyway it must not
    // publish a second mic behind the retry's back (founder 2026-08-05).
    const gen = ++micStartGenRef.current;
    const stale = () => micStartGenRef.current !== gen;
    // clear any stale error up front, so a dead error from a previous attempt
    // can't render a competing "Retry mic" button while this start is in flight
    setMicError(null);
    try {
      const room = roomRef.current ?? (await connect());
      if (stale()) return;
      if (!room) {
        // connect failed — surface it instead of bailing silently, which left
        // the caller stuck on "Putting you on air…" forever
        setMicError("Couldn't connect you to the room. Tap to try again.");
        return;
      }
      setMicStatus("starting");
      const raw = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // mono (FR-4.1)
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (stale()) {
        // abandoned while the prompt was open — release the device
        raw.getTracks().forEach((t) => t.stop());
        return;
      }
      rawStreamRef.current = raw;

      // mic -> delay node -> published track; delayTime 0 = passthrough,
      // adjustable live up to 5s (commentator self-delay)
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(raw);
      const delay = ctx.createDelay(6);
      delay.delayTime.value = opts.isRoomCommentator ? selfDelay : 0;
      delayNodeRef.current = delay;
      const dest = ctx.createMediaStreamDestination();
      src.connect(delay);
      delay.connect(dest);

      const track = new LocalAudioTrack(dest.stream.getAudioTracks()[0]);
      await room.localParticipant.publishTrack(track, {
        source: Track.Source.Microphone,
        dtx: true,
      });
      publishedTrackRef.current = track;
      setMicStatus("live");
      // claim the single on-air slot for this account: the server revokes
      // publish on any other device/tab of ours (founder 2026-08-05)
      void fetch("/api/talk/claim-air", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: opts.roomId,
          identity: room.localParticipant.identity,
        }),
      }).catch(() => {});
      // a listener-caller going on air: snap their playback to the live edge so
      // the call with the host is real time (restored when the call ends). The
      // commentator/co-hosts broadcast live already, so they never snap.
      if (!opts.isRoomCommentator) snapPlaybackToLive();
      refreshSpeakers(room);
    } catch (err) {
      console.error("mic start failed:", err);
      const name = err instanceof DOMException ? err.name : "";
      // surface it in /admin/diagnostics — a call-in that fails on someone
      // else's device is otherwise invisible to us
      track("callin_mic_failed", {
        roomId: opts.roomId,
        props: { name, gestured, message: String((err as Error)?.message ?? "") },
      });
      const denied = name === "NotAllowedError" || name === "SecurityError";
      setMicError(
        denied
          ? gestured
            ? "Allow microphone access to go on air. Check your browser's site settings."
            : // no user gesture (auto-start on accept): the fix is one tap on the
              // button, NOT a trip into browser settings
              "Your browser needs one tap before it can use your mic."
          : name === "NotFoundError"
            ? "No microphone found. Plug one in or check your device."
            : "Couldn't start your mic. Close anything else using it, then try again.",
      );
      await stopMicInternal();
    } finally {
      // only release the lock if we're still the current attempt — a cancelled
      // one must not unlock the retry that replaced it
      if (!stale()) micStartingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, selfDelay, opts.isRoomCommentator]);

  /**
   * Ask for the microphone DURING a real user gesture (the "request to talk"
   * tap) and immediately release it again. This is the fix for the auto-start
   * hanging: by the time the host accepts, the browser has already granted the
   * mic, so the gesture-less getUserMedia on the accept path resolves instantly
   * instead of sitting on an unanswered prompt forever (founder 2026-08-05).
   * Returns false if the user denied or no device exists.
   */
  const primeMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop()); // release straight away
      return true;
    } catch (err) {
      console.warn("mic permission not granted:", (err as Error)?.name);
      return false;
    }
  }, []);

  /** Abandon a mic start that never resolved (a permission prompt left hanging),
   *  so the caller gets a tappable retry instead of a frozen "Putting you on
   *  air…". Invalidates the in-flight attempt and releases the re-entrancy lock
   *  so the retry actually runs (founder 2026-08-05). */
  const cancelMicStart = useCallback(() => {
    if (publishedTrackRef.current) return; // already live — nothing to cancel
    micStartGenRef.current += 1;
    micStartingRef.current = false;
    setMicStatus("off");
    setMicError(
      "Your browser didn't hand over the mic. Tap to go on air and allow access when asked.",
    );
  }, []);

  const stopMic = useCallback(async () => {
    await stopMicInternal();
    if (roomRef.current) refreshSpeakers(roomRef.current);
  }, [refreshSpeakers]);

  const toggleMute = useCallback(async () => {
    const track = publishedTrackRef.current;
    if (!track) return;
    // read the CURRENT track state rather than local UI state, so a host-side
    // mute can't be flipped back on by a stale toggle
    if (track.isMuted) {
      await track.unmute();
      setMicMuted(false);
    } else {
      await track.mute();
      setMicMuted(true);
    }
  }, []);

  const setSelfDelay = useCallback((seconds: number) => {
    setSelfDelayState(seconds);
    if (delayNodeRef.current) {
      delayNodeRef.current.delayTime.value = seconds;
    }
  }, []);

  useEffect(() => {
    return () => {
      void stopMicInternal();
      roomRef.current?.disconnect();
      roomRef.current = null;
      stopAnalyser();
      radioElRef.current?.pause();
      radioElRef.current = null;
      playbackCtxRef.current?.close().catch(() => {});
      playbackCtxRef.current = null;
      workletRef.current = null;
      playbackElRef.current?.pause();
      playbackElRef.current = null;
      trackNodesRef.current.clear();
      bgRadioRef.current?.pause();
      bgRadioCleanupRef.current?.();
      bgRadioCleanupRef.current = null;
      bgRadioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.roomId]);

  // fire a gesture-less autostart (used by the room when the listener has
  // opted in on a prior visit); comes back "blocked" on iOS → one-tap prompt
  const tryAutostart = useCallback(() => connect(false), [connect]);
  // the host accepted this listener's call-in — surface "Go on air" even if they
  // had dropped off LiveKit; their tap reconnects with a publish-capable token
  // (call-in audit 2026-08-05)
  const markAccepted = useCallback(() => setCanPublish(true), []);

  return {
    listenStatus,
    autoplayBlocked,
    userStopped,
    tryAutostart,
    startListening: connect,
    stopListening: disconnect,
    radioActive,
    enableRadio,
    disableRadio,
    volume,
    setVolume,
    syncRequested,
    syncEffective,
    syncAvailable,
    syncSupported,
    setSyncOffset,
    adjustSyncOffset,
    micStatus,
    micError,
    micMuted,
    startMic,
    primeMicPermission,
    cancelMicStart,
    stopMic,
    toggleMute,
    canPublish,
    markAccepted,
    selfDelay,
    setSelfDelay,
    speakers,
    dropSpeaker,
    techDifficulties,
    techSince,
    setAudioContainer,
  };
}
