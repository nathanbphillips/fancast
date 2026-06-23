"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFixtureStats } from "@/lib/hooks/useFixtureStats";
import type { StatTab } from "@/lib/stats";
import * as Ably from "ably";
import type {
  ChatMessage,
  Link,
  Question,
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
import { QuestionsPanel } from "./QuestionsPanel";

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
  initialMessages: ChatMessage[];
  initialLinks: Link[];
  myMessageVotes: Record<string, 1 | -1>;
  myLinkVotes: Record<string, 1 | -1>;
  initialQuestions: Question[];
  initialTalkRequests: TalkRequest[];
  sliderAgg: SliderAggregate;
  mySliderValue: number | null;
  talkConsentGiven: boolean;
  hasPendingTalk: boolean;
  initialBroadcastStart: string | null;
  initialChatOpen: boolean;
  initialLinksOpen: boolean;
  initialHlsUrl: string | null;
  initialClockEvents: ClockEventInput[];
};

type ConnState = "connecting" | "connected" | "broken";

const INPUTS_OPEN: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

// default = 3 columns (25/50/25); expanded = 2 columns (50/50, stats + companion).
const GRID_DEFAULT = "lg:grid-cols-[1fr_2fr_1fr]";
const GRID_EXPANDED = "lg:grid-cols-[1fr_1fr]";

export function RealtimeRoom(props: Props) {
  const { room, viewer } = props;
  const [roomState, setRoomState] = useState<RoomState>(room.state);
  const [tab, setTab] = useState<"chat" | "stats" | "links" | "questions">("chat");
  const [centerTab, setCenterTab] = useState<"chat" | "questions">("chat");
  // desktop layout is a personal, local choice (not commentator-pushed, not saved):
  //   default  → stats 25 / chat 50 / links 25
  //   expanded → stats 50 / companion 50  (companion swaps between chat & links)
  // expanding stats keeps chat (priority); expanding links pushes chat behind links.
  const [deskLayout, setDeskLayout] = useState<"default" | "expanded">("default");
  const [companion, setCompanion] = useState<"chat" | "links">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>(props.initialMessages);
  const [links, setLinks] = useState<Link[]>(props.initialLinks);
  const [questions, setQuestions] = useState<Question[]>(props.initialQuestions);
  const [talkRequests, setTalkRequests] = useState<TalkRequest[]>(
    props.initialTalkRequests,
  );
  const [sliderAgg, setSliderAgg] = useState<SliderAggregate>(props.sliderAgg);
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
          broadcastStart: string | null;
          chatOpen: boolean;
          linksOpen: boolean;
          hlsUrl: string | null;
          clockEvents: ClockEventInput[];
          questions: Question[];
          talkRequests: TalkRequest[];
        };
        // don't clobber a newer `state` control event that landed mid-fetch
        if (lastStateTsRef.current === tsBefore) setRoomState(s.state);
        setSliderAgg(s.sliderAgg);
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
      if (hasConnectedRef.current) void rehydrate();
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
    // a talk request leaving "pending" (dismiss/accept/complete) — listeners
    // only hold this channel, so it's how the requester re-enables their button
    // (M-10). No status is carried; we only react when it targets this viewer.
    control.subscribe("talk_resolved", (msg) => {
      const { userId } = msg.data as { userId: string; requestId: string };
      if (viewer?.userId && userId === viewer.userId) {
        setTalkResolvedSignal((n) => n + 1);
      }
    });
    // commentator pushed a stats tab to everyone (Phase 7); bump the nonce on
    // every push so re-pushing the same tab still re-applies
    control.subscribe("stats_tab", (msg) => {
      const { tab } = msg.data as { tab: StatTab; ts?: string };
      setPushedStatsTab(tab);
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

    const refreshPresence = async () => {
      const members = await chat.presence.get();
      setWatching(members.length);
    };
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
  const { stats: matchStats } = useFixtureStats({ fixtureId: room.fixtureId, live: isLive });
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

  type TabId = "chat" | "stats" | "links" | "questions";
  const mobileTabs: { id: TabId; label: string; badge: number }[] = [
    { id: "chat", label: "Chat", badge: 0 },
    ...(isRoomCommentator
      ? [{ id: "questions" as const, label: "Questions", badge: newQuestionCount }]
      : []),
    { id: "stats", label: "Stats", badge: 0 },
    { id: "links", label: "Links", badge: 0 },
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
      homeScore={room.homeScore}
      awayScore={room.awayScore}
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
      messages={messages}
      myVotes={props.myMessageVotes}
      watching={watching}
      conn={conn}
      onSent={appendMessage}
      sliderAgg={sliderAgg}
      mySliderValue={props.mySliderValue}
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

  const expandedView = deskLayout === "expanded";
  // in expanded mode only the chosen companion occupies the right column on desktop
  const chatDesktopHidden = expandedView && companion === "links";
  const linksDesktopHidden = expandedView && companion === "chat";

  // desktop-only control bar shown atop whichever panel is the companion (right column)
  const companionBar = (
    <div className="hidden items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:flex">
      <div className="flex rounded-lg border-[0.75px] border-line p-0.5 text-xs font-semibold">
        {(["chat", "links"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCompanion(c)}
            aria-pressed={companion === c}
            className={`rounded-md px-3 py-1 capitalize transition-colors ${
              companion === c ? "bg-raised text-primary" : "text-secondary hover:text-primary"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDeskLayout("default")}
        className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-secondary hover:bg-raised hover:text-primary"
      >
        Minimize <span aria-hidden>»«</span>
      </button>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:pb-[80px]">
      {/* detached LiveKit audio elements live here */}
      <div ref={audio.setAudioContainer} className="hidden" aria-hidden="true" />
      <MatchHeader
        home={room.home}
        away={room.away}
        homeScore={room.homeScore}
        awayScore={room.awayScore}
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

      <div
        className={`flex min-h-0 flex-1 flex-col lg:mx-auto lg:grid lg:w-full lg:max-w-7xl ${
          expandedView ? GRID_EXPANDED : GRID_DEFAULT
        }`}
      >
        <aside
          aria-label="Stats"
          className={`${tab === "stats" ? "block" : "hidden"} min-h-0 overflow-y-auto lg:block lg:border-r lg:border-line`}
        >
          {/* desktop expand/minimize control — personal layout choice */}
          <div className="hidden items-center justify-end px-2 pt-2 lg:flex">
            {expandedView ? (
              <button
                type="button"
                onClick={() => setDeskLayout("default")}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-secondary hover:bg-raised hover:text-primary"
              >
                Minimize <span aria-hidden>»«</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCompanion("chat");
                  setDeskLayout("expanded");
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-secondary hover:bg-raised hover:text-primary"
              >
                Expand stats <span aria-hidden>«»</span>
              </button>
            )}
          </div>
          <StatsPanel
            data={matchStats}
            radio={audio.radioActive}
            isRoomCommentator={isRoomCommentator}
            roomId={room.id}
            pushedTab={pushedStatsTab}
            pushNonce={statsPushNonce}
            onPushTab={pushStatsTab}
            expanded={expandedView}
          />
        </aside>

        <section
          aria-label="Chat"
          className={`${tab === "chat" || tab === "questions" ? "flex" : "hidden"} min-h-0 flex-1 flex-col ${
            chatDesktopHidden ? "lg:hidden" : "lg:flex"
          }`}
        >
          {expandedView && companionBar}
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

        <aside
          aria-label="Links"
          className={`${tab === "links" ? "block" : "hidden"} min-h-0 overflow-y-auto ${
            linksDesktopHidden ? "lg:hidden" : "lg:block"
          } lg:border-l lg:border-line`}
        >
          {/* expanded + companion=links: links is the right column, gets the swap bar.
              default: a desktop entry point to expand straight into stats+links. */}
          {expandedView ? (
            companionBar
          ) : (
            <div className="hidden justify-end px-2 pt-2 lg:flex">
              <button
                type="button"
                onClick={() => {
                  setCompanion("links");
                  setDeskLayout("expanded");
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-secondary hover:bg-raised hover:text-primary"
              >
                Expand links <span aria-hidden>«»</span>
              </button>
            </div>
          )}
          <LiveLinks
            roomId={room.id}
            viewer={viewer}
            roomState={roomState}
            isRoomCommentator={isRoomCommentator}
            linksOpen={linksOpen}
            links={links}
            myVotes={props.myLinkVotes}
            onSubmitted={appendLink}
          />
        </aside>
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

function LiveChat({
  room,
  roomState,
  viewer,
  messages,
  myVotes,
  watching,
  conn,
  onSent,
  sliderAgg,
  mySliderValue,
  talkConsentGiven,
  hasPendingTalk,
  talkResolvedSignal,
  broadcastStart,
  chatOpen,
}: {
  room: RoomInfo;
  roomState: RoomState;
  viewer: Viewer;
  messages: ChatMessage[];
  myVotes: Record<string, 1 | -1>;
  watching: number | null;
  conn: ConnState;
  onSent: (m: ChatMessage) => void;
  sliderAgg: SliderAggregate;
  mySliderValue: number | null;
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
  const listRef = useRef<HTMLUListElement>(null);
  const pinnedRef = useRef(true); // user is at/near the bottom
  const prevLenRef = useRef(messages.length);
  const [unread, setUnread] = useState(0);
  const NEAR_BOTTOM_PX = 64;

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
    prevLenRef.current = messages.length;
    if (!el || messages.length <= prevLen) return; // only react to growth
    const newest = messages[messages.length - 1];
    const isOwn = newest?.user_id === viewer?.userId;
    const visible = el.clientHeight > 0; // chat tab hidden on mobile -> 0
    if (isOwn || (visible && pinnedRef.current)) {
      requestAnimationFrame(() => {
        const e = listRef.current;
        if (e) e.scrollTop = e.scrollHeight;
      });
      setUnread(0);
    } else {
      setUnread((n) => n + (messages.length - prevLen));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, viewer?.userId]);

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
    setVotes((prev) => {
      const next = { ...prev };
      if (value === 0) delete next[messageId];
      else next[messageId] = value;
      return next;
    });
    await fetch("/api/chat/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, value }),
    });
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

  const inputsOpen = INPUTS_OPEN.includes(roomState);
  const isRoomCommentator = viewer?.isRoomCommentator ?? false;
  const canType =
    viewer !== null &&
    (inputsOpen ||
      (roomState === "waiting" && (isRoomCommentator || chatOpen)));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="text-xs text-secondary tabular-nums">
          {watching !== null
            ? `${watching} watching`
            : conn === "connecting"
              ? "connecting…"
              : conn === "broken"
                ? "live updates unavailable — refresh to retry"
                : "…"}
        </span>
      </div>

      {roomState === "waiting" && <Countdown targetIso={broadcastStart} />}

      <ul
        ref={listRef}
        onScroll={onChatScroll}
        className="flex-1 space-y-1 overflow-y-auto p-2"
      >
        {messages.map((m) => {
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
        {messages.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-secondary">
            {roomState === "waiting"
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
            <p className="text-sm">
              That&apos;s full time on the show.{" "}
              {!isRoomCommentator && (
                <>
                  Follow{" "}
                  <a
                    href={`/u/${room.commentatorUsername}`}
                    className="font-semibold text-gold hover:underline"
                  >
                    {room.commentatorUsername}
                  </a>{" "}
                  to catch the next one.
                </>
              )}
            </p>
          </div>
        </div>
      ) : !canType ? (
        <div className="border-t border-line p-3">
          <p className="rounded-xl border-[0.75px] border-line bg-raised p-4 text-center text-sm text-secondary">
            Waiting room — chat opens when the commentator opens it or the
            broadcast starts.
          </p>
        </div>
      ) : (
        <div className="border-t border-line p-3">
          {notice && (
            <p role="alert" className="mb-2 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs text-secondary">
              {notice}
            </p>
          )}
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
            <div className="mt-3">
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

function LiveLinks({
  roomId,
  viewer,
  roomState,
  isRoomCommentator,
  linksOpen,
  links,
  myVotes,
  onSubmitted,
}: {
  roomId: string;
  viewer: Viewer;
  roomState: RoomState;
  isRoomCommentator: boolean;
  linksOpen: boolean;
  links: Link[];
  myVotes: Record<string, 1 | -1>;
  onSubmitted: (l: Link) => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [votes, setVotes] = useState(myVotes);

  const canSubmit =
    viewer !== null &&
    (INPUTS_OPEN.includes(roomState) ||
      (roomState === "waiting" && (isRoomCommentator || linksOpen)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, url: draft.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.link) onSubmitted(body.link);
      setDraft("");
    } else {
      const body = await res.json().catch(() => ({}));
      setNotice(body.error ?? "Couldn't submit that link.");
    }
  }

  async function vote(linkId: string, value: 1 | -1 | 0) {
    setVotes((prev) => {
      const next = { ...prev };
      if (value === 0) delete next[linkId];
      else next[linkId] = value;
      return next;
    });
    await fetch("/api/links/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId, value }),
    });
  }

  return (
    <div className="space-y-3 p-3">
      {canSubmit && (
        <form onSubmit={submit} className="flex gap-2">
          <input
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste a link"
            aria-label="Submit a link"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="h-11 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm font-semibold hover:bg-raised disabled:opacity-60"
          >
            {busy ? "…" : "Add"}
          </button>
        </form>
      )}
      {notice && (
        <p role="alert" className="rounded-lg border border-red/40 bg-surface px-3 py-2 text-xs text-red">
          {notice}
        </p>
      )}
      <ul className="space-y-3">
        {links
          .filter((l) => !l.hidden)
          .map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              myVote={votes[link.id]}
              canVote={viewer !== null}
              onVote={(v) => vote(link.id, v)}
            />
          ))}
        {links.filter((l) => !l.hidden).length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-secondary">
            No links yet{canSubmit ? " — paste the first one." : "."}
          </li>
        )}
      </ul>
    </div>
  );
}
