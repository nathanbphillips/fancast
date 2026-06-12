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
      const ctx = new AudioContext();
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
      analyserRef.current.ctx.close().catch(() => {});
      analyserRef.current = null;
    }
    silentSinceRef.current = null;
  }

  useEffect(() => {
    const id = setInterval(() => {
      const a = analyserRef.current;
      const track = commentatorTrackRef.current;
      if (!a || !track || track.isMuted) {
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

  const connect = useCallback(async (): Promise<Room | null> => {
    if (roomRef.current) return roomRef.current;
    setListenStatus("connecting");
    try {
      const res = await fetch(`/api/livekit/token?room=${opts.roomId}`);
      if (!res.ok) throw new Error("token request failed");
      const { token, url, canPublish: granted } = await res.json();
      setCanPublish(granted);

      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
        if (track.kind !== Track.Kind.Audio) return;
        const el = track.attach();
        audioContainerRef.current?.appendChild(el);
        if (participant.identity === opts.commentatorId) {
          watchCommentatorTrack(track);
          clearTech();
        }
        refreshSpeakers(room);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
        track.detach().forEach((el) => el.remove());
        if (participant.identity === opts.commentatorId) {
          stopAnalyser();
          commentatorTrackRef.current = null;
        }
        refreshSpeakers(room);
      });
      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        if (p.identity === opts.commentatorId && !opts.isRoomCommentator) {
          flagTech();
        }
        refreshSpeakers(room);
      });
      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        if (p.identity === opts.commentatorId) clearTech();
        refreshSpeakers(room);
      });
      room.on(RoomEvent.ParticipantPermissionsChanged, () => {
        const perms = room.localParticipant.permissions;
        setCanPublish(perms?.canPublish ?? false);
        if (!(perms?.canPublish ?? false)) {
          void stopMicInternal();
        }
      });
      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setListenStatus("idle");
        setMicStatus("off");
        stopAnalyser();
      });
      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) setListenStatus("live");
        else if (state === ConnectionState.Reconnecting)
          setListenStatus("connecting");
      });

      await room.connect(url, token);
      await room.startAudio(); // inside the user gesture
      setListenStatus("live");
      refreshSpeakers(room);
      return room;
    } catch (err) {
      console.error("audio connect failed:", err);
      setListenStatus("error");
      roomRef.current = null;
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.roomId, opts.commentatorId, opts.isRoomCommentator]);

  const disconnect = useCallback(async () => {
    await stopMicInternal();
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setListenStatus("idle");
    clearTech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.roomId]);

  return {
    listenStatus,
    startListening: connect,
    stopListening: disconnect,
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
