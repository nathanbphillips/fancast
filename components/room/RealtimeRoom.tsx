"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFixtureStats } from "@/lib/hooks/useFixtureStats";
import type { StatTab } from "@/lib/stats";
import * as Ably from "ably";
import type {
  ChatMessage,
  Link,
  MyPollVote,
  MyPrediction,
  MyRatings,
  PollState,
  PredictionAggregate,
  Question,
  RatingPlayer,
  RatingsAggregate,
  RoomState,
  SliderAggregate,
  TalkRequest,
} from "@/lib/db/types";
import { MatchHeader } from "@/components/MatchHeader";
import { StatsPanel } from "@/components/StatsPanel";
import {
  deriveClock,
  formatClock,
  type ClockEventInput,
} from "@/lib/clock";
import {
  ListenerBar,
  MicControls,
  SpeakerChips,
} from "./audio/LiveAudioControls";
import { SyncSheet } from "./audio/SyncSheet";
import { useRoomAudio } from "./audio/useRoomAudio";
import { ClockControls } from "./ClockControls";
import { CommentatorBar } from "./CommentatorBar";
import { Countdown } from "./Countdown";
import { DownloadsPanel } from "./DownloadsPanel";
import { InteractionButtons } from "./InteractionButtons";
import { AggregateMeter, PreferenceSlider } from "./PreferenceSlider";
import { ScorePredictor } from "./ScorePredictor";
import { PollComposer, PollWidget } from "./PollWidget";
import { PlayerRatings } from "./PlayerRatings";
import { QuestionsPanel } from "./QuestionsPanel";
import { FollowButton } from "@/components/FollowButton";
import { useToast } from "@/components/Toast";

/**
 * Live room: chat + links + lifecycle over Ably, DB as source of truth.
 * Control-channel `state` events drive lock/unlock on every client with
 * no reload (FR-3.3); the commentator's private channel carries questions
 * and talk requests. Clients are subscribe-only; writes go to API routes.
 */

export type Viewer = {
  userId: string;
  username: string;
  role: "listener" | "commentator" | "admin";
  isModerator: boolean; // room commentator or admin
  isRoomCommentator: boolean;
} | null;

export type RoomInfo = {
  id: string;
  state: RoomState;
  scheduledKickoff: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  commentatorUsername: string;
  commentatorId: string;
  fixtureId: number; // Sportmonks fixture id (negative for dev seeds)
};

type Props = {
  room: RoomInfo;
  viewer: Viewer;
  viewerFollowsCommentator: boolean;
  initialMessages: ChatMessage[];
  initialLinks: Link[];
  myMessageVotes: Record<string, 1 | -1>;
  myLinkVotes: Record<string, 1 | -1>;
  initialQuestions: Question[];
  initialTalkRequests: TalkRequest[];
  sliderAgg: SliderAggregate;
  mySliderValue: number | null;
  predictionAgg: PredictionAggregate;
  myPrediction: MyPrediction;
  activePoll: PollState;
  myPollVote: MyPollVote;
  ratingsAgg: RatingsAggregate;
  myRatings: MyRatings;
  talkConsentGiven: boolean;
  hasPendingTalk: boolean;
  initialBroadcastStart: string | null;
  initialChatOpen: boolean;
  initialLinksOpen: boolean;
  initialHlsUrl: string | null;
  initialClockEvents: ClockEventInput[];
};

type ConnState = "connecting" | "connected" | "broken";

/** Close a listener-metrics segment (FR-9.4). sendBeacon survives tab-close /
 *  refresh, where a normal fetch would be cancelled; falls back to keepalive. */
function stopListenSegment(id: string) {
  const body = JSON.stringify({ action: "stop", id });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/listen", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  void fetch("/api/listen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

const INPUTS_OPEN: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

export function RealtimeRoom(props: Props) {
  const { room, viewer } = props;
  const [roomState, setRoomState] = useState<RoomState>(room.state);
  // Phase 11: desktop is a fixed two-column split — stats LEFT 50 / merged
  // chat+links stream RIGHT 50. The old 25/50/25 expand/swap/companion model is
  // retired (founder decision 2026-06-24). On mobile `tab` switches Stream/Stats
  // (and Questions for the commentator); links live inside the stream now.
  const [tab, setTab] = useState<"chat" | "stats" | "questions">("chat");
  const [centerTab, setCenterTab] = useState<"chat" | "questions">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>(props.initialMessages);
  const [links, setLinks] = useState<Link[]>(props.initialLinks);
  const [questions, setQuestions] = useState<Question[]>(props.initialQuestions);
  const [talkRequests, setTalkRequests] = useState<TalkRequest[]>(
    props.initialTalkRequests,
  );
  const [sliderAgg, setSliderAgg] = useState<SliderAggregate>(props.sliderAgg);
  const [predictionAgg, setPredictionAgg] = useState<PredictionAggregate>(props.predictionAgg);
  const [activePoll, setActivePoll] = useState<PollState>(props.activePoll);
  const [ratingsAgg, setRatingsAgg] = useState<RatingsAggregate>(props.ratingsAgg);
  const [watching, setWatching] = useState<number | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [broadcastStart, setBroadcastStart] = useState(props.initialBroadcastStart);
  const [chatOpen, setChatOpen] = useState(props.initialChatOpen);
  const [linksOpen, setLinksOpen] = useState(props.initialLinksOpen);
  const [hlsUrl, setHlsUrl] = useState(props.initialHlsUrl);
  const [clockEvents, setClockEvents] = useState<ClockEventInput[]>(
    props.initialClockEvents,
  );
  const [clockText, setClockText] = useState<string | undefined>(undefined);
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);
  // bumped when THIS viewer's talk request is resolved, so their button clears
  const [talkResolvedSignal, setTalkResolvedSignal] = useState(0);
  // commentator-pushed stats tab (Phase 7); nonce re-applies repeated pushes
  const [pushedStatsTab, setPushedStatsTab] = useState<StatTab | null>(null);
  const [statsPushNonce, setStatsPushNonce] = useState(0);
  // reconnect resilience (M-4): rehydrate room state from the DB on a *re*connect
  const lastStateTsRef = useRef(""); // newest `state` event ts seen
  const hasConnectedRef = useRef(false); // skip rehydrate on the first connect
  const rehydratingRef = useRef(false); // guard against overlapping rehydrates

  // tick locally; derivation resyncs whenever an event arrives (FR-7.3)
  useEffect(() => {
    const tick = () => {
      const d = deriveClock(clockEvents, Date.now());
      setClockText(d.running ? formatClock(d.elapsedSeconds) : undefined);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [clockEvents]);

  const appendMessage = (m: ChatMessage) =>
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  const appendLink = (l: Link) =>
    setLinks((prev) => (prev.some((x) => x.id === l.id) ? prev : [l, ...prev]));

  const isRoomCommentator = viewer?.isRoomCommentator ?? false;

  const audio = useRoomAudio({
    roomId: room.id,
    commentatorId: room.commentatorId,
    viewerId: viewer?.userId ?? null,
    isRoomCommentator,
  });

  // lock-screen metadata + controls (FR-5.1)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (audio.listenStatus === "live") {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `${room.home} vs ${room.away}`,
        artist: room.commentatorUsername,
        artwork: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.setActionHandler("pause", () => {
        void audio.stopListening();
      });
      navigator.mediaSession.setActionHandler("play", () => {
        void audio.startListening();
      });
    } else {
      navigator.mediaSession.playbackState =
        audio.listenStatus === "idle" ? "paused" : "none";
    }
    return () => {
      // page-global handlers must die with the room — a lock-screen
      // "play" after navigating away would resurrect audio with no UI
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.metadata = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.listenStatus, room.home, room.away, room.commentatorUsername]);

  // listener metrics (FR-9.4): one durable segment per listening session, with
  // a heartbeat so the stale sweep can close sessions a tab-close beacon missed.
  // Fire-and-forget — never blocks audio. The commentator broadcasts, not listens.
  const listenSegIdRef = useRef<string | null>(null);
  const listenMode: "live" | "radio" | null = isRoomCommentator
    ? null
    : audio.radioActive
      ? "radio"
      : audio.listenStatus === "live"
        ? "live"
        : null;
  useEffect(() => {
    if (!listenMode) return;
    let alive = true;
    void fetch("/api/listen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", roomId: room.id, mode: listenMode }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (alive) listenSegIdRef.current = (d?.id as string) ?? null;
      })
      .catch(() => {});
    const hb = setInterval(() => {
      const id = listenSegIdRef.current;
      if (id) {
        void fetch("/api/listen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "heartbeat", id }),
        }).catch(() => {});
      }
    }, 30_000);
    return () => {
      alive = false;
      clearInterval(hb);
      const id = listenSegIdRef.current;
      listenSegIdRef.current = null;
      if (id) stopListenSegment(id);
    };
  }, [listenMode, room.id]);

  // close the open segment on tab-close / refresh (React doesn't unmount then)
  useEffect(() => {
    const onHide = () => {
      const id = listenSegIdRef.current;
      if (id) stopListenSegment(id);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  async function leaveAir() {
    await audio.stopMic();
    await fetch("/api/talk/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id }),
    });
  }

  async function removeSpeaker(identity: string) {
    await fetch("/api/talk/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, userId: identity }),
    });
  }

  useEffect(() => {
    const client = new Ably.Realtime({
      authUrl: `/api/ably/token?room=${room.id}`,
      authMethod: "GET",
    });

    // Rebuild reconcilable state from the DB after a reconnect (M-4, golden
    // rule 5). Control/private rewind covers brief blips; this covers longer
    // drops where the rewind window was overrun.
    const rehydrate = async () => {
      if (rehydratingRef.current) return;
      rehydratingRef.current = true;
      const tsBefore = lastStateTsRef.current;
      try {
        const res = await fetch(`/api/rooms/${room.id}/snapshot`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const s = (await res.json()) as {
          state: RoomState;
          sliderAgg: SliderAggregate;
          predictionAgg: PredictionAggregate;
          activePoll: PollState;
          ratingsAgg: RatingsAggregate;
          broadcastStart: string | null;
          chatOpen: boolean;
          linksOpen: boolean;
          hlsUrl: string | null;
          clockEvents: ClockEventInput[];
          messages: ChatMessage[];
          links: Link[];
          questions: Question[];
          talkRequests: TalkRequest[];
        };
        // don't clobber a newer `state` control event that landed mid-fetch
        if (lastStateTsRef.current === tsBefore) setRoomState(s.state);
        setSliderAgg(s.sliderAgg);
        setPredictionAgg(s.predictionAgg);
        setActivePoll(s.activePoll);
        setRatingsAgg(s.ratingsAgg);
        // backfill chat + links missed during a drop longer than the rewind
        // window (M-4). Snapshot rows are authoritative (fresher vote/hidden state).
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          for (const m of s.messages ?? []) byId.set(m.id, m);
          return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
        setLinks((prev) => {
          const byId = new Map(prev.map((l) => [l.id, l]));
          for (const l of s.links ?? []) byId.set(l.id, l);
          return [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
        });
        setBroadcastStart(s.broadcastStart);
        setChatOpen(s.chatOpen);
        setLinksOpen(s.linksOpen);
        setHlsUrl(s.hlsUrl);
        setClockEvents((prev) => {
          const merged = [...prev];
          for (const e of s.clockEvents ?? []) {
            if (
              !merged.some(
                (x) => x.action === e.action && x.server_ts === e.server_ts,
              )
            )
              merged.push(e);
          }
          return merged;
        });
        if (viewer?.isModerator) {
          setQuestions(s.questions ?? []);
          setTalkRequests(s.talkRequests ?? []);
        }
      } catch {
        // best-effort; channel rewind also helps recover
      } finally {
        rehydratingRef.current = false;
      }
    };

    client.connection.on("connected", () => {
      setConn("connected");
      // skip the very first connect — SSR already delivered fresh state
      if (hasConnectedRef.current) {
        void rehydrate();
        // enter/leave events fired during the drop were missed, so the watch
        // count is stale — recompute it from the freshly-synced presence set
        void refreshPresence();
      }
      hasConnectedRef.current = true;
    });
    client.connection.on(["disconnected", "suspended", "failed"], () =>
      setConn("broken"),
    );

    const chat = client.channels.get(`room:${room.id}:chat`, {
      params: { rewind: "50" },
    });
    const linksCh = client.channels.get(`room:${room.id}:links`, {
      params: { rewind: "25" },
    });
    const control = client.channels.get(`room:${room.id}:control`, {
      // 6 event types multiplex here; a small window drops the state/clock
      // event under slider churn, so replay deep enough to recover (M-4)
      params: { rewind: "100" },
    });

    chat.subscribe("message", (msg) => appendMessage(msg.data as ChatMessage));
    chat.subscribe("vote", (msg) => {
      const { messageId, up, down } = msg.data as {
        messageId: string;
        up: number;
        down: number;
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, up_count: up, down_count: down } : m,
        ),
      );
    });
    chat.subscribe("hide", (msg) => {
      const { messageId, hiddenBy } = msg.data as {
        messageId: string;
        hiddenBy: ChatMessage["hidden_by"];
      };
      // also blank the body so hidden text doesn't linger in state/DOM
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, hidden_by: hiddenBy, body: "" } : m,
        ),
      );
    });

    linksCh.subscribe("link", (msg) => appendLink(msg.data as Link));
    linksCh.subscribe("vote", (msg) => {
      const { linkId, up, down, hidden } = msg.data as {
        linkId: string;
        up: number;
        down: number;
        hidden: boolean;
      };
      setLinks((prev) =>
        prev.map((l) =>
          l.id === linkId ? { ...l, up_count: up, down_count: down, hidden } : l,
        ),
      );
    });

    control.subscribe("state", (msg) => {
      const { state, ts } = msg.data as { state: RoomState; ts?: string };
      // rewind can replay history — never let an older event win. The ts lives
      // in a ref so rehydrate() can tell if a newer state landed mid-fetch (M-4)
      if (ts && ts < lastStateTsRef.current) return;
      if (ts) lastStateTsRef.current = ts;
      setRoomState(state);
      if (state === "wrapped") {
        // a completed session earns the gentle install prompt (FR-5.2)
        try {
          localStorage.setItem("fc_session_completed", "1");
        } catch {}
      }
    });
    control.subscribe("slider", (msg) => {
      setSliderAgg(msg.data as SliderAggregate);
    });
    control.subscribe("prediction", (msg) => {
      setPredictionAgg(msg.data as PredictionAggregate);
    });
    control.subscribe("poll", (msg) => {
      setActivePoll(msg.data as PollState);
    });
    control.subscribe("ratings", (msg) => {
      setRatingsAgg(msg.data as RatingsAggregate);
    });
    control.subscribe("broadcast_start", (msg) => {
      setBroadcastStart((msg.data as { broadcastStart: string | null }).broadcastStart);
    });
    control.subscribe("features", (msg) => {
      const { chatOpen: c, linksOpen: l } = msg.data as {
        chatOpen: boolean;
        linksOpen: boolean;
      };
      setChatOpen(c);
      setLinksOpen(l);
    });
    control.subscribe("radio", (msg) => {
      setHlsUrl((msg.data as { url: string }).url);
    });
    control.subscribe("clock", (msg) => {
      const e = msg.data as ClockEventInput;
      setClockEvents((prev) =>
        // rewind can replay events the server already gave us — dedupe
        prev.some(
          (x) => x.action === e.action && x.server_ts === e.server_ts,
        )
          ? prev
          : [...prev, e],
      );
    });
    // a talk request leaving "pending" (dismiss/accept/complete) reaches the
    // requester on THEIR OWN per-user channel, so their button re-enables (M-10)
    // without the shared control channel leaking who requested + was dismissed
    // (FR-4.2). Only signed-in users ever have a pending request.
    if (viewer?.userId) {
      const mine = client.channels.get(`room:${room.id}:user:${viewer.userId}`, {
        params: { rewind: "5" },
      });
      mine.subscribe("talk_resolved", () => setTalkResolvedSignal((n) => n + 1));
    }
    // commentator pushed a stats tab to everyone (Phase 7); bump the nonce on
    // every push so re-pushing the same tab still re-applies
    control.subscribe("stats_tab", (msg) => {
      // rename out of the outer mobile-nav `tab` state to avoid shadowing
      const { tab: pushedTab } = msg.data as { tab: StatTab; ts?: string };
      setPushedStatsTab(pushedTab);
      setStatsPushNonce((n) => n + 1);
    });

    // private channel: only the room commentator/admin holds the capability
    if (viewer?.isModerator) {
      const priv = client.channels.get(`room:${room.id}:private`, {
        // rewind so question/talk events sent during a brief commentator drop
        // are replayed on reattach (M-4); the token grants history on private
        params: { rewind: "50" },
      });
      priv.subscribe("question", (msg) => {
        const q = msg.data as Question;
        setQuestions((prev) =>
          prev.some((x) => x.id === q.id) ? prev : [q, ...prev],
        );
      });
      priv.subscribe("question_update", (msg) => {
        const { questionId, status } = msg.data as {
          questionId: string;
          status: Question["status"];
        };
        setQuestions((prev) =>
          prev.map((q) => (q.id === questionId ? { ...q, status } : q)),
        );
      });
      priv.subscribe("talk_request", (msg) => {
        const r = msg.data as TalkRequest;
        setTalkRequests((prev) =>
          prev.some((x) => x.id === r.id) ? prev : [...prev, r],
        );
      });
      priv.subscribe("talk_update", (msg) => {
        const { requestId } = msg.data as { requestId: string };
        setTalkRequests((prev) => prev.filter((r) => r.id !== requestId));
      });
    }

    // hoisted so the reconnect handler above can recompute the count too
    async function refreshPresence() {
      const members = await chat.presence.get();
      setWatching(members.length);
    }
    chat.presence.subscribe(["enter", "leave"], refreshPresence);
    chat.presence.enter().then(refreshPresence).catch(() => {});

    return () => {
      chat.presence.leave().catch(() => {});
      client.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, viewer?.isModerator, viewer?.userId]);

  const isLive = ["live_1h", "live_2h", "extra_time"].includes(roomState);
  const audioLive = INPUTS_OPEN.includes(roomState);
  const newQuestionCount = questions.filter((q) => q.status === "new").length;

  // Phase 7: poll live match detail (faster cadence while live); push a tab
  const { stats: matchStats, error: statsError } = useFixtureStats({
    fixtureId: room.fixtureId,
    live: isLive,
  });
  // updates have stalled if a poll is failing while the match is live (clears on
  // the next good poll); distinct from the route's own last-good `stale` flag
  const statsOutage = isLive && statsError !== null;

  // live scoreline from the stats poll, falling back to the page-load value so a
  // goal during the session updates the header. The CLOCK stays event-sourced
  // (golden rule 6) — only the score tracks the provider here.
  const liveHome = matchStats?.score.home ?? room.homeScore;
  const liveAway = matchStats?.score.away ?? room.awayScore;

  // rateable players (FR-12.3): starters + subs from the lineup in the stats payload
  const ratingPlayers = useMemo<RatingPlayer[]>(() => {
    const out: RatingPlayer[] = [];
    const lu = matchStats?.lineups;
    for (const side of ["home", "away"] as const) {
      const s = lu?.[side];
      if (!s) continue;
      for (const p of s.starters)
        if (p.playerId != null) out.push({ playerId: p.playerId, name: p.name, side, starter: true });
      for (const p of s.bench)
        if (p.playerId != null) out.push({ playerId: p.playerId, name: p.name, side, starter: false });
    }
    return out;
  }, [matchStats]);
  const pushStatsTab = (tab: StatTab) => {
    void fetch("/api/stats-tab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, tab }),
    }).catch(() => {});
  };

  function handleRequestHandled(id: string, _status: "accepted" | "dismissed") {
    setTalkRequests((prev) => prev.filter((r) => r.id !== id));
  }

  type TabId = "chat" | "stats" | "questions";
  const mobileTabs: { id: TabId; label: string; badge: number }[] = [
    { id: "chat", label: "Chat", badge: 0 },
    ...(isRoomCommentator
      ? [{ id: "questions" as const, label: "Questions", badge: newQuestionCount }]
      : []),
    { id: "stats", label: "Stats", badge: 0 },
  ];

  const bar = isRoomCommentator ? (
    <CommentatorBar
      roomId={room.id}
      state={roomState}
      requests={talkRequests}
      onRequestHandled={handleRequestHandled}
      broadcastStart={broadcastStart}
      chatOpen={chatOpen}
      linksOpen={linksOpen}
      startDisabled={audio.micStatus !== "live"}
      clockControls={
        roomState === "wrapped" ? null : (
          <ClockControls roomId={room.id} state={roomState} />
        )
      }
      micControls={
        roomState === "wrapped" ? null : (
          <MicControls
            micStatus={audio.micStatus}
            micMuted={audio.micMuted}
            selfDelay={audio.selfDelay}
            onStart={() => void audio.startMic()}
            onStop={() => void audio.stopMic()}
            onToggleMute={() => void audio.toggleMute()}
            onDelayChange={audio.setSelfDelay}
          />
        )
      }
      speakerChips={
        roomState === "wrapped" ? null : (
          <SpeakerChips
            speakers={audio.speakers}
            roomId={room.id}
            onEndCall={removeSpeaker}
          />
        )
      }
    />
  ) : (
    <ListenerBar
      commentator={room.commentatorUsername}
      live={audioLive}
      listenStatus={audio.listenStatus}
      onStart={() => void audio.startListening()}
      onStop={() => void audio.stopListening()}
      techDifficulties={audio.techDifficulties && audioLive}
      techSince={audio.techSince}
      canPublish={viewer !== null && audio.canPublish}
      micStatus={audio.micStatus}
      micMuted={audio.micMuted}
      onGoOnAir={() => void audio.startMic()}
      onLeaveAir={() => void leaveAir()}
      onToggleMute={() => void audio.toggleMute()}
      radioUrl={hlsUrl}
      radioActive={audio.radioActive}
      onRadioToggle={(next) => {
        if (next && hlsUrl) void audio.enableRadio(hlsUrl);
        else audio.disableRadio();
      }}
      syncRequested={audio.syncRequested}
      syncEffective={audio.syncEffective}
      syncSupported={audio.syncSupported}
      onSyncAdjust={audio.adjustSyncOffset}
      onOpenSync={() => setSyncSheetOpen(true)}
      volume={audio.volume}
      onVolumeChange={audio.setVolume}
      homeScore={liveHome}
      awayScore={liveAway}
      clock={clockText}
    />
  );

  // wrapped + room commentator: the center becomes the downloads panel
  const showDownloads = roomState === "wrapped" && isRoomCommentator;

  const chatPanel = showDownloads ? (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <DownloadsPanel roomId={room.id} />
    </div>
  ) : (
    <LiveChat
      room={room}
      roomState={roomState}
      viewer={viewer}
      viewerFollowsCommentator={props.viewerFollowsCommentator}
      messages={messages}
      myVotes={props.myMessageVotes}
      links={links}
      myLinkVotes={props.myLinkVotes}
      linksOpen={linksOpen}
      onLinkSubmitted={appendLink}
      watching={watching}
      conn={conn}
      onSent={appendMessage}
      sliderAgg={sliderAgg}
      mySliderValue={props.mySliderValue}
      predictionAgg={predictionAgg}
      myPrediction={props.myPrediction}
      activePoll={activePoll}
      myPollVote={props.myPollVote}
      ratingsAgg={ratingsAgg}
      myRatings={props.myRatings}
      ratingPlayers={ratingPlayers}
      talkConsentGiven={props.talkConsentGiven}
      hasPendingTalk={props.hasPendingTalk}
      talkResolvedSignal={talkResolvedSignal}
      broadcastStart={broadcastStart}
      chatOpen={chatOpen}
    />
  );

  const questionsPanel = (
    <QuestionsPanel
      questions={questions}
      onStatusChange={(id, status) =>
        setQuestions((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status } : q)),
        )
      }
    />
  );

  return (
    <div
      className={`flex h-[calc(100dvh-3.5rem)] flex-col ${
        isRoomCommentator ? "lg:pb-[80px]" : "lg:pb-[52px]"
      }`}
    >
      {/* detached LiveKit audio elements live here */}
      <div ref={audio.setAudioContainer} className="hidden" aria-hidden="true" />
      <MatchHeader
        home={room.home}
        away={room.away}
        homeScore={liveHome}
        awayScore={liveAway}
        state={roomState}
        clock={clockText}
        listeners={watching ?? undefined}
      />

      {/* mobile: in-flow strip under the header */}
      <div className="border-b border-line bg-surface lg:hidden">{bar}</div>

      <nav aria-label="Room sections" className="flex border-b border-line bg-surface lg:hidden">
        {mobileTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`h-11 flex-1 text-sm font-semibold transition-colors ${
              tab === t.id ? "border-b-2 border-gold text-primary" : "text-secondary"
            }`}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="ml-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-canvas tabular-nums">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col lg:mx-auto lg:grid lg:w-full lg:max-w-7xl lg:grid-cols-2">
        <aside
          aria-label="Stats"
          className={`${tab === "stats" ? "block" : "hidden"} min-h-0 overflow-y-auto lg:block lg:border-r lg:border-line`}
        >
          <StatsPanel
            data={matchStats}
            radio={audio.radioActive}
            isRoomCommentator={isRoomCommentator}
            roomId={room.id}
            pushedTab={pushedStatsTab}
            pushNonce={statsPushNonce}
            onPushTab={pushStatsTab}
            expanded
            outage={statsOutage}
            defaultTab={roomState === "waiting" || roomState === "pregame" ? "info" : "stats"}
          />
        </aside>

        <section
          aria-label="Chat"
          className={`${tab === "chat" || tab === "questions" ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}
        >
          {isRoomCommentator && (
            <div className="hidden border-b border-line bg-surface lg:flex">
              {(["chat", "questions"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCenterTab(t)}
                  aria-current={centerTab === t ? "page" : undefined}
                  className={`h-10 px-4 text-sm font-semibold ${
                    centerTab === t
                      ? "border-b-2 border-gold text-primary"
                      : "text-secondary"
                  }`}
                >
                  {t === "chat" ? "Chat" : "Questions"}
                  {t === "questions" && newQuestionCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-canvas tabular-nums">
                      {newQuestionCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {/* mobile: driven by the tab bar; desktop: by centerTab */}
          <div className={`min-h-0 flex-1 ${tab === "questions" ? "overflow-y-auto" : "flex flex-col"} lg:hidden`}>
            {tab === "questions" ? questionsPanel : chatPanel}
          </div>
          <div className={`hidden min-h-0 flex-1 ${centerTab === "questions" ? "overflow-y-auto" : ""} lg:flex lg:flex-col`}>
            {centerTab === "questions" && isRoomCommentator
              ? questionsPanel
              : chatPanel}
          </div>
        </section>
      </div>

      {/* desktop: fixed bottom bar (~50px listener, ~80px commentator) */}
      <div className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-line bg-surface lg:block">
        <div className="mx-auto max-w-7xl">{bar}</div>
      </div>

      {!isRoomCommentator && (
        <SyncSheet
          open={syncSheetOpen}
          onClose={() => setSyncSheetOpen(false)}
          clockEvents={clockEvents}
          requested={audio.syncRequested}
          effective={audio.syncEffective}
          available={audio.syncAvailable}
          onApply={audio.setSyncOffset}
          onAdjust={audio.adjustSyncOffset}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ chat */

function VoteArrows({
  up,
  down,
  myVote,
  disabled,
  onVote,
}: {
  up: number;
  down: number;
  myVote: 1 | -1 | undefined;
  disabled: boolean;
  onVote: (v: 1 | -1 | 0) => void;
}) {
  return (
    <span className="flex shrink-0 flex-col items-center text-secondary">
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={myVote === 1}
        disabled={disabled}
        onClick={() => onVote(myVote === 1 ? 0 : 1)}
        className={`flex h-5 w-6 items-center justify-center hover:text-green ${myVote === 1 ? "text-green" : ""}`}
      >
        <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 fill-current"><path d="M6 0l6 8H0z" /></svg>
      </button>
      <span className="text-xs font-semibold tabular-nums">{up - down}</span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={myVote === -1}
        disabled={disabled}
        onClick={() => onVote(myVote === -1 ? 0 : -1)}
        className={`flex h-5 w-6 items-center justify-center hover:text-red ${myVote === -1 ? "text-red" : ""}`}
      >
        <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 fill-current"><path d="M6 8L0 0h12z" /></svg>
      </button>
    </span>
  );
}

/** One item in the merged chat+links stream (Phase 11). Both carry id +
 *  created_at; the stream interleaves them chronologically and a local filter
 *  narrows to chat-only / links-only / blended (default). */
type StreamItem =
  | { kind: "message"; id: string; createdAt: string; msg: ChatMessage }
  | { kind: "link"; id: string; createdAt: string; lnk: Link };

type StreamFilter = "blended" | "chat" | "links";

function LiveChat({
  room,
  roomState,
  viewer,
  viewerFollowsCommentator,
  messages,
  myVotes,
  links,
  myLinkVotes,
  linksOpen,
  onLinkSubmitted,
  watching,
  conn,
  onSent,
  sliderAgg,
  mySliderValue,
  predictionAgg,
  myPrediction,
  activePoll,
  myPollVote,
  ratingsAgg,
  myRatings,
  ratingPlayers,
  talkConsentGiven,
  hasPendingTalk,
  talkResolvedSignal,
  broadcastStart,
  chatOpen,
}: {
  room: RoomInfo;
  roomState: RoomState;
  viewer: Viewer;
  viewerFollowsCommentator: boolean;
  messages: ChatMessage[];
  myVotes: Record<string, 1 | -1>;
  links: Link[];
  myLinkVotes: Record<string, 1 | -1>;
  linksOpen: boolean;
  onLinkSubmitted: (l: Link) => void;
  watching: number | null;
  conn: ConnState;
  onSent: (m: ChatMessage) => void;
  sliderAgg: SliderAggregate;
  mySliderValue: number | null;
  predictionAgg: PredictionAggregate;
  myPrediction: MyPrediction;
  activePoll: PollState;
  myPollVote: MyPollVote;
  ratingsAgg: RatingsAggregate;
  myRatings: MyRatings;
  ratingPlayers: RatingPlayer[];
  talkConsentGiven: boolean;
  hasPendingTalk: boolean;
  talkResolvedSignal: number;
  broadcastStart: string | null;
  chatOpen: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [votes, setVotes] = useState(myVotes);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const toast = useToast();
  const [linkVotes, setLinkVotes] = useState(myLinkVotes);
  const [streamFilter, setStreamFilter] = useState<StreamFilter>("blended");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [submittingLink, setSubmittingLink] = useState(false);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pinnedRef = useRef(true); // user is at/near the bottom
  const prevLenRef = useRef(0); // length of the merged stream last render
  const filterRef = useRef<StreamFilter>("blended");
  const [unread, setUnread] = useState(0);
  const NEAR_BOTTOM_PX = 64;

  // saved filter (localStorage, per-device); load after mount to avoid an SSR mismatch
  useEffect(() => {
    try {
      const s = localStorage.getItem("fc:streamFilter");
      if (s === "chat" || s === "links" || s === "blended") setStreamFilter(s);
    } catch {
      /* ignore */
    }
  }, []);
  function changeFilter(f: StreamFilter) {
    setStreamFilter(f);
    try {
      localStorage.setItem("fc:streamFilter", f);
    } catch {
      /* ignore */
    }
  }

  // the merged chat+links stream: interleaved by created_at, narrowed by the filter
  const streamItems = useMemo<StreamItem[]>(() => {
    const items: StreamItem[] = [];
    if (streamFilter !== "links") {
      for (const m of messages)
        items.push({ kind: "message", id: m.id, createdAt: m.created_at, msg: m });
    }
    if (streamFilter !== "chat") {
      for (const l of links)
        if (!l.hidden)
          items.push({ kind: "link", id: l.id, createdAt: l.created_at, lnk: l });
    }
    items.sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
    );
    return items;
  }, [messages, links, streamFilter]);

  function scrollChatToBottom() {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    pinnedRef.current = true;
    setUnread(0);
  }
  function onChatScroll() {
    const el = listRef.current;
    if (!el) return;
    pinnedRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
    if (pinnedRef.current) setUnread(0); // React bails out if already 0
  }

  // open pinned to the latest message (matches the prior always-scroll behavior)
  useEffect(() => {
    scrollChatToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // on new messages: follow only if the user is pinned to the bottom (or it's
  // their own send); otherwise hold their scroll position and count unread so
  // reading history during a busy match isn't yanked away (M-12, audit)
  useLayoutEffect(() => {
    const el = listRef.current;
    const prevLen = prevLenRef.current;
    const filterChanged = filterRef.current !== streamFilter;
    prevLenRef.current = streamItems.length;
    filterRef.current = streamFilter;
    // a filter switch changes the list length with no live insert — re-pin if the
    // reader was at the bottom, but never count it as unread
    if (filterChanged) {
      if (el && pinnedRef.current) {
        requestAnimationFrame(() => {
          const e = listRef.current;
          if (e) e.scrollTop = e.scrollHeight;
        });
      }
      return;
    }
    if (!el || streamItems.length <= prevLen) return; // only react to growth
    const newest = streamItems[streamItems.length - 1];
    const newestUser =
      newest?.kind === "message" ? newest.msg.user_id : newest?.lnk.user_id;
    const isOwn = newestUser === viewer?.userId;
    const visible = el.clientHeight > 0; // chat tab hidden on mobile -> 0
    if (isOwn || (visible && pinnedRef.current)) {
      requestAnimationFrame(() => {
        const e = listRef.current;
        if (e) e.scrollTop = e.scrollHeight;
      });
      setUnread(0);
    } else {
      setUnread((n) => n + (streamItems.length - prevLen));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamItems.length, streamFilter, viewer?.userId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setNotice(null);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, body: draft.trim() }),
    });
    setSending(false);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.message) onSent(body.message);
      setDraft("");
    } else {
      const body = await res.json().catch(() => ({}));
      setNotice(body.error ?? "Couldn't send — try again.");
    }
  }

  async function vote(messageId: string, value: 1 | -1 | 0) {
    // for rollback if the write fails (index access can be absent at runtime)
    const prev = (votes[messageId] as 1 | -1 | 0 | undefined) ?? 0;
    setVotes((p) => {
      const next = { ...p };
      if (value === 0) delete next[messageId];
      else next[messageId] = value;
      return next;
    });
    const res = await fetch("/api/chat/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, value }),
    }).catch(() => null);
    if (!res?.ok) {
      setVotes((p) => {
        const next = { ...p };
        if (prev === 0) delete next[messageId];
        else next[messageId] = prev;
        return next;
      });
      toast("Couldn't record your vote.");
    }
  }

  async function flag(messageId: string) {
    setFlagged((prev) => new Set(prev).add(messageId));
    const res = await fetch("/api/chat/flag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) setNotice(body.error);
    }
  }

  async function hide(messageId: string) {
    await fetch("/api/chat/hide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
  }

  async function linkVote(linkId: string, value: 1 | -1 | 0) {
    const prev = (linkVotes[linkId] as 1 | -1 | 0 | undefined) ?? 0;
    setLinkVotes((p) => {
      const next = { ...p };
      if (value === 0) delete next[linkId];
      else next[linkId] = value;
      return next;
    });
    const res = await fetch("/api/links/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId, value }),
    }).catch(() => null);
    if (!res?.ok) {
      setLinkVotes((p) => {
        const next = { ...p };
        if (prev === 0) delete next[linkId];
        else next[linkId] = prev;
        return next;
      });
      toast("Couldn't record your vote.");
    }
  }

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkDraft.trim() || submittingLink) return;
    setSubmittingLink(true);
    setLinkNotice(null);
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, url: linkDraft.trim() }),
    });
    setSubmittingLink(false);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.link) onLinkSubmitted(body.link);
      setLinkDraft("");
      setLinkOpen(false);
    } else {
      const body = await res.json().catch(() => ({}));
      setLinkNotice(body.error ?? "Couldn't submit that link.");
    }
  }

  const inputsOpen = INPUTS_OPEN.includes(roomState);
  const isRoomCommentator = viewer?.isRoomCommentator ?? false;
  const canType =
    viewer !== null &&
    (inputsOpen ||
      (roomState === "waiting" && (isRoomCommentator || chatOpen)));
  const canSubmitLink =
    viewer !== null &&
    (inputsOpen ||
      (roomState === "waiting" && (isRoomCommentator || linksOpen)));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
        <span className="text-xs text-secondary tabular-nums">
          {watching !== null
            ? `${watching} watching`
            : conn === "connecting"
              ? "connecting…"
              : conn === "broken"
                ? "live updates unavailable — refresh to retry"
                : "…"}
        </span>
        <div className="flex gap-1" role="tablist" aria-label="Stream filter">
          {(["blended", "chat", "links"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={streamFilter === f}
              onClick={() => changeFilter(f)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                streamFilter === f
                  ? "bg-gold text-canvas"
                  : "text-secondary hover:bg-raised"
              }`}
            >
              {f === "blended" ? "All" : f === "chat" ? "Chat" : "Links"}
            </button>
          ))}
        </div>
      </div>

      {roomState === "waiting" && <Countdown targetIso={broadcastStart} />}

      <ul
        ref={listRef}
        onScroll={onChatScroll}
        className="flex-1 space-y-1 overflow-y-auto p-2"
      >
        {streamItems.map((item) => {
          if (item.kind === "link") {
            return (
              <LinkCard
                key={item.id}
                link={item.lnk}
                myVote={linkVotes[item.id]}
                canVote={viewer !== null}
                onVote={(v) => linkVote(item.id, v)}
              />
            );
          }
          const m = item.msg;
          if (m.hidden_by) {
            return (
              <li key={m.id} className="rounded-lg px-3 py-2 text-xs text-secondary italic">
                Message hidden{m.hidden_by === "flags" ? " by community flags" : ""}
              </li>
            );
          }
          const isCommentator = m.author?.role === "commentator";
          const isOwn = viewer?.userId === m.user_id;
          return (
            <li
              key={m.id}
              className={`group flex items-start gap-2 rounded-lg px-3 py-2 ${
                isCommentator
                  ? "border-l-[3px] border-gold bg-raised"
                  : isOwn
                    ? "bg-raised/60"
                    : ""
              }`}
            >
              <VoteArrows
                up={m.up_count}
                down={m.down_count}
                myVote={votes[m.id]}
                disabled={!viewer}
                onVote={(v) => vote(m.id, v)}
              />
              <p className="min-w-0 flex-1 text-sm leading-relaxed">
                <span className={`mr-2 font-semibold ${isCommentator ? "text-gold" : "text-secondary"}`}>
                  {m.author?.username ?? "…"}
                </span>
                {isCommentator && (
                  <span className="mr-2 rounded-sm bg-gold px-1 py-0.5 align-middle text-[10px] font-bold text-canvas">
                    COMMENTATOR
                  </span>
                )}
                {m.body}
              </p>
              {viewer && !isOwn && !flagged.has(m.id) && (
                <button
                  type="button"
                  aria-label="Flag message"
                  title="Flag message"
                  onClick={() => flag(m.id)}
                  className="px-1 text-xs text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:text-red focus-visible:opacity-100"
                >
                  ⚑
                </button>
              )}
              {viewer?.isModerator && (
                <button
                  type="button"
                  aria-label="Hide message"
                  title="Hide message"
                  onClick={() => hide(m.id)}
                  className="px-1 text-xs text-secondary hover:text-red"
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
        {streamItems.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-secondary">
            {streamFilter === "links"
              ? "No links yet."
              : roomState === "waiting"
                ? "The commentator will be along shortly."
                : "Nothing here yet — say hello."}
          </li>
        )}
      </ul>

      {/* new-messages affordance shown only when scrolled away from bottom */}
      {unread > 0 && (
        <button
          type="button"
          onClick={scrollChatToBottom}
          className="z-10 mx-auto -mt-9 mb-1 block rounded-full bg-gold px-3 py-1 text-xs font-semibold text-canvas shadow tabular-nums"
        >
          {unread} new {unread === 1 ? "message" : "messages"} ↓
        </button>
      )}

      {/* score predictor: distribution visible to everyone; the form opens for
          signed-in listeners during pregame (FR-12.1) */}
      {inputsOpen && (roomState === "pregame" || predictionAgg.total > 0) && (
        <div className="border-t border-line px-3 pt-3">
          <ScorePredictor
            roomId={room.id}
            myValue={myPrediction}
            agg={predictionAgg}
            open={roomState === "pregame" && !!viewer && !isRoomCommentator}
            homeName={room.home}
            awayName={room.away}
          />
        </div>
      )}

      {/* half-time poll: live poll visible to all; composer is commentator-only */}
      {(activePoll || (inputsOpen && isRoomCommentator)) && (
        <div className="border-t border-line px-3 pt-3">
          {activePoll && (
            <PollWidget
              poll={activePoll}
              myVote={myPollVote}
              canVote={!!viewer && !isRoomCommentator}
              isCommentator={isRoomCommentator}
            />
          )}
          {inputsOpen && isRoomCommentator && <PollComposer roomId={room.id} />}
        </div>
      )}

      {/* player ratings: postgame, rate the XI + subs; visible to all */}
      {(roomState === "postgame" || ratingsAgg.length > 0) && ratingPlayers.length > 0 && (
        <div className="border-t border-line px-3 pt-3">
          <PlayerRatings
            roomId={room.id}
            players={ratingPlayers}
            agg={ratingsAgg}
            myRatings={myRatings}
            open={roomState === "postgame" && !!viewer && !isRoomCommentator}
            homeName={room.home}
            awayName={room.away}
          />
        </div>
      )}

      {!viewer ? (
        <div className="border-t border-line p-3">
          <div className="rounded-xl border-[0.75px] border-line bg-raised p-4 text-center">
            <p className="text-sm text-secondary">
              You&apos;re listening as a guest. Join in to chat, vote, ask
              questions, and request to talk.
            </p>
            <a
              href="/signin"
              className="mt-3 inline-flex h-11 items-center rounded-lg bg-red px-5 text-sm font-semibold text-white"
            >
              Sign in to join
            </a>
          </div>
          {inputsOpen && (
            <div className="mt-3">
              <AggregateMeter agg={sliderAgg} />
            </div>
          )}
        </div>
      ) : roomState === "wrapped" ? (
        <div className="border-t border-line p-3">
          <div className="rounded-xl border-[0.75px] border-line bg-raised p-4 text-center">
            <p className="text-sm">That&apos;s full time on the show.</p>
            {!isRoomCommentator &&
              (viewerFollowsCommentator ? (
                <p className="mt-1 text-xs text-secondary">
                  You follow{" "}
                  <a
                    href={`/u/${room.commentatorUsername}`}
                    className="font-semibold text-gold hover:underline"
                  >
                    {room.commentatorUsername}
                  </a>{" "}
                  — see you next time.
                </p>
              ) : (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <p className="text-xs text-secondary">
                    Enjoyed it? Follow{" "}
                    <a
                      href={`/u/${room.commentatorUsername}`}
                      className="font-semibold text-gold hover:underline"
                    >
                      {room.commentatorUsername}
                    </a>{" "}
                    to catch the next one.
                  </p>
                  <FollowButton
                    commentatorId={room.commentatorId}
                    initialFollowing={false}
                  />
                </div>
              ))}
          </div>
        </div>
      ) : !canType && !canSubmitLink ? (
        <div className="border-t border-line p-3">
          <p className="rounded-xl border-[0.75px] border-line bg-raised p-4 text-center text-sm text-secondary">
            Waiting room — the commentator opens chat and links when the show
            starts.
          </p>
        </div>
      ) : (
        <div className="space-y-2 border-t border-line p-3">
          {notice && (
            <p role="alert" className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-secondary">
              {notice}
            </p>
          )}
          {canType && (
            <form onSubmit={send} className="flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={500}
                placeholder={roomState === "waiting" ? "Warm the room up" : "Say something"}
                aria-label="Chat message"
                className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="h-11 shrink-0 rounded-lg bg-red px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                Send
              </button>
            </form>
          )}
          {canSubmitLink &&
            (linkOpen ? (
              <form onSubmit={submitLink} className="flex gap-2">
                <input
                  type="url"
                  value={linkDraft}
                  onChange={(e) => setLinkDraft(e.target.value)}
                  placeholder="Paste a link"
                  aria-label="Submit a link"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
                />
                <button
                  type="submit"
                  disabled={submittingLink || !linkDraft.trim()}
                  className="h-10 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-raised disabled:opacity-60"
                >
                  {submittingLink ? "…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLinkOpen(false);
                    setLinkNotice(null);
                  }}
                  aria-label="Cancel link"
                  className="h-10 shrink-0 rounded-lg px-2 text-sm text-secondary hover:text-primary"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="text-xs font-semibold text-secondary hover:text-primary"
              >
                + Add a link
              </button>
            ))}
          {linkNotice && (
            <p role="alert" className="text-xs text-red">
              {linkNotice}
            </p>
          )}
          {inputsOpen && !isRoomCommentator && (
            <>
              <InteractionButtons
                roomId={room.id}
                consentGiven={talkConsentGiven}
                hasPendingTalk={hasPendingTalk}
                resolvedSignal={talkResolvedSignal}
              />
              <PreferenceSlider
                roomId={room.id}
                myValue={mySliderValue}
                agg={sliderAgg}
                enabled
              />
            </>
          )}
          {inputsOpen && isRoomCommentator && (
            <div className="mt-1">
              <AggregateMeter agg={sliderAgg} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- links */

function LinkCard({
  link,
  myVote,
  canVote,
  onVote,
}: {
  link: Link;
  myVote: 1 | -1 | undefined;
  canVote: boolean;
  onVote: (v: 1 | -1 | 0) => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const showImage = link.og_image !== null && !imgBroken;

  return (
    <li className="overflow-hidden rounded-xl border-[0.75px] border-line bg-surface">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="block"
      >
        {showImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={link.og_image!}
            alt=""
            loading="lazy"
            onError={() => setImgBroken(true)}
            className="aspect-video w-full border-b border-line object-cover"
          />
        )}
        <div className="px-3 pt-3">
          <p className="line-clamp-2 text-sm leading-snug font-semibold hover:underline">
            {link.og_title ?? link.url}
          </p>
          {link.og_description && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-secondary">
              {link.og_description}
            </p>
          )}
        </div>
      </a>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="truncate text-xs text-secondary">{link.domain}</span>
        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Upvote link"
            aria-pressed={myVote === 1}
            disabled={!canVote}
            onClick={() => onVote(myVote === 1 ? 0 : 1)}
            className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold hover:bg-raised ${myVote === 1 ? "text-green" : "text-secondary hover:text-green"}`}
          >
            ▲
          </button>
          <span className="text-xs font-semibold tabular-nums">
            {link.up_count - link.down_count}
          </span>
          <button
            type="button"
            aria-label="Downvote link"
            aria-pressed={myVote === -1}
            disabled={!canVote}
            onClick={() => onVote(myVote === -1 ? 0 : -1)}
            className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold hover:bg-raised ${myVote === -1 ? "text-red" : "text-secondary hover:text-red"}`}
          >
            ▼
          </button>
        </span>
      </div>
    </li>
  );
}
