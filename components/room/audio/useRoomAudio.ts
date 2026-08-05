"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
};

// 25s so a natural commentary lull (pregame setup, a goal-kick, a sip of water)
// doesn't trip a false "technical difficulties" for the whole room (live-test
// review 2026-08-05); a genuine host disconnect is caught separately + instantly.
const SILENCE_SECONDS = 25;
const SILENCE_RMS = 0.0035;

export function useRoomAudio(opts: {
  roomId: string;
  commentatorId: string;
  /** viewer's user id, null when anonymous */
  viewerId: string | null;
  isRoomCommentator: boolean;
}) {
  const [listenStatus, setListenStatus] = useState<ListenStatus>("idle");
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
  // host is real time, not behind by their sync offset. Worklet-only override —
  // never persisted, so the saved offset (syncRequested/sessionStorage) is what
  // we restore to when the call ends.
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
    if (playbackCtxRef.current) {
      await playbackCtxRef.current.resume().catch(() => {});
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
    await ctx.resume().catch(() => {});
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
  /** Restore the caller's pre-call sync offset when the call ends. The ring
   *  buffer has been filling the whole time, so the offset returns instantly. */
  function restorePlaybackSync() {
    if (!liveSnapRef.current) return;
    liveSnapRef.current = false;
    workletRef.current?.port.postMessage({
      type: "setDelay",
      seconds: syncRequestedRef.current,
    });
  }

  /* -------------------------------------------------------- connection */

  const refreshSpeakers = useCallback((room: Room) => {
    const remote: Speaker[] = [...room.remoteParticipants.values()]
      .filter((p) => p.audioTrackPublications.size > 0)
      .map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
        isCommentator: p.identity === opts.commentatorId,
      }));
    if (publishedTrackRef.current && opts.viewerId) {
      remote.push({
        identity: opts.viewerId,
        name: "you",
        isCommentator: opts.isRoomCommentator,
      });
    }
    setSpeakers(remote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.commentatorId, opts.viewerId, opts.isRoomCommentator]);

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
      const res = await fetch(`/api/livekit/token?room=${opts.roomId}`);
      if (!res.ok) throw new Error("token request failed");
      const { token, url, canPublish: granted } = await res.json();
      setCanPublish(granted);

      const r = new Room();
      room = r;
      roomRef.current = r;

      r.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Audio) return;
        const ctx = playbackCtxRef.current;
        const worklet = workletRef.current;
        if (ctx && worklet) {
          // muted element keeps Safari delivering WebRTC frames; audible
          // output comes from the ring-buffer graph
          const el = track.attach() as HTMLAudioElement;
          el.muted = true;
          audioContainerRef.current?.appendChild(el);
          const src = ctx.createMediaStreamSource(
            new MediaStream([track.mediaStreamTrack]),
          );
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
        if (participant.identity === opts.commentatorId) {
          watchCommentatorTrack(track);
          clearTech();
        }
        refreshSpeakers(r);
      });
      r.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        const node = trackNodesRef.current.get(
          track.sid ?? participant.identity,
        );
        if (node) {
          node.src.disconnect();
          trackNodesRef.current.delete(track.sid ?? participant.identity);
        }
        track.detach().forEach((el) => el.remove());
        if (participant.identity === opts.commentatorId) {
          stopAnalyser();
          commentatorTrackRef.current = null;
        }
        refreshSpeakers(r);
      });
      r.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        if (p.identity === opts.commentatorId && !opts.isRoomCommentator) {
          flagTech();
        }
        refreshSpeakers(r);
      });
      r.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        if (p.identity === opts.commentatorId) clearTech();
        refreshSpeakers(r);
      });
      r.on(RoomEvent.ParticipantPermissionsChanged, () => {
        const perms = r.localParticipant.permissions;
        setCanPublish(perms?.canPublish ?? false);
        if (!(perms?.canPublish ?? false)) {
          void stopMicInternal();
        }
      });
      r.on(RoomEvent.Disconnected, () => {
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

      await r.connect(url, token);
      await r.startAudio(); // inside the user gesture
      setListenStatus("live");
      refreshSpeakers(r);
      return r;
    } catch (err) {
      console.error("audio connect failed:", err);
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

  /* ------------------------------------------------- radio mode (HLS) */

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
      el.volume = volumeRef.current; // desktop only; iOS ignores element volume
      el.src = url;
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
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
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
    if (micStartingRef.current || publishedTrackRef.current) return;
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
      // a listener-caller going on air: snap their playback to the live edge so
      // the call with the host is real time (restored when the call ends). The
      // commentator/co-hosts broadcast live already, so they never snap.
      if (!opts.isRoomCommentator) snapPlaybackToLive();
      refreshSpeakers(room);
    } catch (err) {
      console.error("mic start failed:", err);
      const name = err instanceof DOMException ? err.name : "";
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
    cancelMicStart,
    stopMic,
    toggleMute,
    canPublish,
    markAccepted,
    selfDelay,
    setSelfDelay,
    speakers,
    techDifficulties,
    techSince,
    setAudioContainer,
  };
}
