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

const SILENCE_SECONDS = 10;
const SILENCE_RMS = 0.0035;

export function useRoomAudio(opts: {
  roomId: string;
  commentatorId: string;
  /** viewer's user id, null when anonymous */
  viewerId: string | null;
  isRoomCommentator: boolean;
}) {
  const [listenStatus, setListenStatus] = useState<ListenStatus>("idle");
  const [micStatus, setMicStatus] = useState<MicStatus>("off");
  const [micMuted, setMicMuted] = useState(false);
  const [canPublish, setCanPublish] = useState(false);
  const [selfDelay, setSelfDelayState] = useState(0);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [techDifficulties, setTechDifficulties] = useState(false);
  const [techSince, setTechSince] = useState<number | null>(null);
  const [radioActive, setRadioActive] = useState(false);
  const radioElRef = useRef<HTMLAudioElement | null>(null);

  // sync ring buffer (FR-6): requested vs effective offset + buffered depth
  const [syncRequested, setSyncRequested] = useState(0);
  const syncRequestedRef = useRef(0);
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
    if (playbackElRef.current) {
      playbackElRef.current.pause();
      playbackElRef.current.srcObject = null;
    }
  }

  async function ensurePlaybackGraph(): Promise<boolean> {
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
        return false;
      }
      return workletRef.current !== null;
    }
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      await ctx.resume();
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
      node.connect(dest);
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
      return true;
    } catch (err) {
      console.warn("sync buffer unavailable, falling back to live-edge:", err);
      ctx?.close().catch(() => {});
      if (playbackElRef.current) {
        playbackElRef.current.pause();
        playbackElRef.current.srcObject = null;
      }
      setSyncSupported(false);
      playbackCtxRef.current = null;
      workletRef.current = null;
      return false;
    }
  }

  const setSyncOffset = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, Math.min(90, Math.round(seconds * 10) / 10));
      setSyncRequested(clamped);
      syncRequestedRef.current = clamped;
      workletRef.current?.port.postMessage({
        type: "setDelay",
        seconds: clamped,
      });
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

  const connect = useCallback(async (): Promise<Room | null> => {
    if (roomRef.current) return roomRef.current;
    // overlapping calls (play button, lock-screen play, go-on-air) must
    // share one attempt — a second Room here would be unstoppable
    if (connectPromiseRef.current) return connectPromiseRef.current;
    const attempt = doConnect().finally(() => {
      connectPromiseRef.current = null;
    });
    connectPromiseRef.current = attempt;
    return attempt;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.roomId, opts.commentatorId, opts.isRoomCommentator]);

  async function doConnect(): Promise<Room | null> {
    setListenStatus("connecting");
    let room: Room | null = null;
    try {
      // build the sync graph inside the user gesture, before any track
      // subscription can fire
      await ensurePlaybackGraph();
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
          const el = track.attach();
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
    await stopMicInternal();
    await roomRef.current?.disconnect();
    roomRef.current = null;
    trackNodesRef.current.clear();
    // drop the buffered timeline: resuming later must not replay stale
    // audio from before the stop
    workletRef.current?.port.postMessage({ type: "reset" });
    setSyncAvailable(0);
    setSyncEffective(0);
    await playbackCtxRef.current?.suspend().catch(() => {});
    setListenStatus("idle");
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
        radioElRef.current = el;
      }
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

  /* --------------------------------------------------------- publisher */

  async function stopMicInternal() {
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

  const startMic = useCallback(async () => {
    const room = roomRef.current ?? (await connect());
    if (!room) return;
    setMicStatus("starting");
    try {
      const raw = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // mono (FR-4.1)
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
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
      refreshSpeakers(room);
    } catch (err) {
      console.error("mic start failed:", err);
      await stopMicInternal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, selfDelay, opts.isRoomCommentator]);

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

  return {
    listenStatus,
    startListening: connect,
    stopListening: disconnect,
    radioActive,
    enableRadio,
    disableRadio,
    syncRequested,
    syncEffective,
    syncAvailable,
    syncSupported,
    setSyncOffset,
    adjustSyncOffset,
    micStatus,
    micMuted,
    startMic,
    stopMic,
    toggleMute,
    canPublish,
    selfDelay,
    setSelfDelay,
    speakers,
    techDifficulties,
    techSince,
    setAudioContainer,
  };
}
