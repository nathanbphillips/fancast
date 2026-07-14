"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFixtureStats } from "@/lib/hooks/useFixtureStats";
import { useMatchHistory } from "@/lib/hooks/useMatchHistory";
import { useFotmobLinks } from "@/lib/hooks/useFotmobLinks";
import { applyStatOverrides, type StatOverrides } from "@/lib/statOverrides";
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
  RoomKind,
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Avatar } from "@/components/Avatar";
import { ProfilePopover } from "@/components/ProfilePopover";
import { ShareButton } from "@/components/room/ShareButton";
import NextLink from "next/link";

/**
 * Live room: chat + links + lifecycle over Ably, DB as source of truth.
 * Control-channel `state` events drive lock/unlock on every client with
 * no reload (FR-3.3); the commentator's private channel carries questions
 * and talk requests. Clients are subscribe-only; writes go to API routes.
 */

export type Viewer = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  role: "listener" | "commentator" | "admin";
  isModerator: boolean; // room commentator or admin
  isRoomCommentator: boolean;
} | null;

export type RoomInfo = {
  id: string;
  state: RoomState;
  scheduledKickoff: string;
  /** 'match' or 'discussion' (anytime rooms, migration 0038) */
  kind: RoomKind;
  /** display name: a discussion room's own title, else "Home vs Away" */
  title: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  commentatorUsername: string;
  /** all accepted hosts, creator first (FR-25.4 both-badge display) */
  hosts: { username: string; avatarUrl: string | null }[];
  commentatorId: string;
  competition: string; // league/competition name for the match-bar chip
  fixtureId: number; // the room's fixture id (PK; negative for dev seeds, epoch-ms for admin games)
  comingSoon: boolean; // admin game with no Sportmonks data yet → "Information coming soon"
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
  initialStatOverrides: StatOverrides | null;
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

/** The five floating-reaction emoji (Cloud Design). Kept in sync with the
 *  allow-list in app/api/reactions/route.ts. */
const REACTION_EMOJI = ["⚽", "🔥", "👏", "😱", "🙌"] as const;

type ReactionFloat = {
  id: number;
  emoji: string;
  left: number;
  dur: number;
  rot: number;
};

export function RealtimeRoom(props: Props) {
  const { room, viewer } = props;
  // Anytime rooms (migration 0038): a discussion room with no linked fixture
  // hides the stats panel and gives the chat full width; a linked discussion
  // room shows the linked game's stats (RoomInfo.fixtureId is the linked id).
  const isDiscussion = room.kind === "discussion";
  const showStats = !isDiscussion || room.fixtureId > 0;
  const [roomState, setRoomState] = useState<RoomState>(room.state);
  // Desktop is a two-column split — chat LEFT (2fr) / stats RIGHT (1fr) via
  // lg:grid-cols-[2fr_1fr] with order-1/order-2. When showStats is false the
  // stats column drops and chat fills the full width. On mobile `tab` switches
  // Chat / Stats (only when showStats) / Call in; links live inside the stream.
  const [tab, setTab] = useState<"chat" | "stats" | "questions" | "callin">("chat");
  // desktop chat-column tabs: Room chat | Polls (+ Questions for the
  // commentator). Polls hosts the interactive widgets so they stop consuming
  // permanent chat-column height (founder 2026-07-02, Cloud Design).
  const [centerTab, setCenterTab] = useState<"chat" | "questions" | "polls">("chat");
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
  const [statOverrides, setStatOverrides] = useState<StatOverrides | null>(
    props.initialStatOverrides,
  );
  const [chatOpen, setChatOpen] = useState(props.initialChatOpen);
  const [linksOpen, setLinksOpen] = useState(props.initialLinksOpen);
  const [hlsUrl, setHlsUrl] = useState(props.initialHlsUrl);
  const [clockEvents, setClockEvents] = useState<ClockEventInput[]>(
    props.initialClockEvents,
  );
  const [clockText, setClockText] = useState<string | undefined>(undefined);
  // clock shifted by the listener's sync delay (what they're hearing)
  const [syncedClockText, setSyncedClockText] = useState<string | undefined>(undefined);
  const [syncSheetOpen, setSyncSheetOpen] = useState(false);

  // floating reaction emoji (Phase 5a) — ephemeral, capped at 12 in flight,
  // reduced-motion neutralised via the fcfloat keyframe wildcard. spawnFloat
  // only touches setFloats(prev=>…), so the realtime effect can call it through
  // a stable closure without re-subscribing.
  const [floats, setFloats] = useState<ReactionFloat[]>([]);
  const floatIdRef = useRef(0);
  const spawnFloat = useCallback((emoji: string) => {
    const id = (floatIdRef.current += 1);
    const dur = 2.4 + Math.random() * 1.2;
    const f: ReactionFloat = {
      id,
      emoji,
      left: 6 + Math.random() * 84,
      dur,
      rot: -20 + Math.random() * 40,
    };
    setFloats((prev) => [...prev.slice(-11), f]);
    window.setTimeout(
      () => setFloats((prev) => prev.filter((x) => x.id !== id)),
      (dur + 0.3) * 1000,
    );
  }, []);
  const sendReaction = useCallback(
    (emoji: string) => {
      spawnFloat(emoji); // optimistic — show it instantly, publish in the background
      void fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id, emoji }),
      }).catch(() => {});
    },
    [room.id, spawnFloat],
  );
  // bumped when THIS viewer's talk request is resolved, so their button clears
  const [talkResolvedSignal, setTalkResolvedSignal] = useState(0);
  // call-in queue position (#N), pushed to this viewer on their own per-user
  // channel — the requester roster is never broadcast (FR-4.2). (Phase 5c)
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const lastTalkResolvedTsRef = useRef(0); // newest talk_resolved Ably timestamp
  const [leavingQueue, setLeavingQueue] = useState(false);
  const leaveQueue = useCallback(async () => {
    setLeavingQueue(true);
    try {
      const res = await fetch("/api/talk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: room.id }),
      });
      // 404 = already resolved elsewhere; either way nothing is pending now
      if (res.ok || res.status === 404) setQueuePosition(null);
    } catch {
      /* leave the card up; the user can retry */
    } finally {
      setLeavingQueue(false);
    }
  }, [room.id]);
  // commentator-pushed stats tab (Phase 7); nonce re-applies repeated pushes
  const [pushedStatsTab, setPushedStatsTab] = useState<StatTab | null>(null);
  const [statsPushNonce, setStatsPushNonce] = useState(0);
  // reconnect resilience (M-4): rehydrate room state from the DB on a *re*connect
  const lastStateTsRef = useRef(""); // newest `state` event ts seen
  const lastOverrideTsRef = useRef(""); // newest `stat_overrides` event ts seen
  const pendingOverrideRef = useRef(false); // an optimistic override save is in flight
  const hasConnectedRef = useRef(false); // skip rehydrate on the first connect
  const rehydratingRef = useRef(false); // guard against overlapping rehydrates

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

  // tick locally; derivation resyncs whenever an event arrives (FR-7.3).
  // syncedClockText = the commentator's clock MINUS this listener's sync delay:
  // the game time the listener is actually HEARING — it should match their
  // telly once they've synced (founder 2026-07-02).
  useEffect(() => {
    const tick = () => {
      const d = deriveClock(clockEvents, Date.now());
      setClockText(d.running ? formatClock(d.elapsedSeconds) : undefined);
      setSyncedClockText(
        d.running
          ? formatClock(Math.max(0, d.elapsedSeconds - audio.syncRequested))
          : undefined,
      );
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [clockEvents, audio.syncRequested]);

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
      const ovTsBefore = lastOverrideTsRef.current;
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
          statOverrides: StatOverrides | null;
        };
        // don't clobber a newer `state` control event that landed mid-fetch
        if (lastStateTsRef.current === tsBefore) setRoomState(s.state);
        // restore commentator Info/Line-up corrections, unless a fresher
        // `stat_overrides` push arrived during the fetch or our own save is still
        // in flight (its write may not have committed before the snapshot read)
        if (!pendingOverrideRef.current && lastOverrideTsRef.current === ovTsBefore)
          setStatOverrides(s.statOverrides ?? null);
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

    // ephemeral floating reactions (Phase 5a): no rewind — a reaction that
    // happened before you joined shouldn't replay. client.close() (cleanup
    // below) tears this down with the rest.
    const reactionsCh = client.channels.get(`room:${room.id}:reactions`);
    reactionsCh.subscribe("reaction", (msg) => {
      const emoji = (msg.data as { emoji?: string } | null)?.emoji;
      if (emoji && REACTION_EMOJI.includes(emoji as (typeof REACTION_EMOJI)[number])) {
        spawnFloat(emoji);
      }
    });

    chat.subscribe("message", (msg) => appendMessage(msg.data as ChatMessage));
    chat.subscribe("vote", (msg) => {
      const { messageId, up, down, score } = msg.data as {
        messageId: string;
        up: number;
        down: number;
        score: number;
      };
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, up_count: up, down_count: down, score }
            : m,
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
      const { linkId, up, down, score, hidden } = msg.data as {
        linkId: string;
        up: number;
        down: number;
        score: number;
        hidden: boolean;
      };
      setLinks((prev) =>
        prev.map((l) =>
          l.id === linkId
            ? { ...l, up_count: up, down_count: down, score, hidden }
            : l,
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
      mine.subscribe("talk_resolved", (msg) => {
        setTalkResolvedSignal((n) => n + 1);
        setQueuePosition(null); // left pending (accepted/dismissed) → no longer queued
        // remember when we left the queue so a racing/stale queue_position
        // (concurrent accept+withdraw, or rewind replay) can't flip the UI
        // back to "In line #N" (audit 2026-07-02)
        lastTalkResolvedTsRef.current = msg.timestamp ?? Date.now();
      });
      mine.subscribe("queue_position", (msg) => {
        if ((msg.timestamp ?? 0) < lastTalkResolvedTsRef.current) return; // stale
        const pos = (msg.data as { position?: number } | null)?.position;
        setQueuePosition(typeof pos === "number" ? pos : null);
      });
    }
    // commentator pushed a stats tab to everyone (Phase 7); bump the nonce on
    // every push so re-pushing the same tab still re-applies
    control.subscribe("stats_tab", (msg) => {
      // rename out of the outer mobile-nav `tab` state to avoid shadowing
      const { tab: pushedTab } = msg.data as { tab: StatTab; ts?: string };
      setPushedStatsTab(pushedTab);
      setStatsPushNonce((n) => n + 1);
    });

    // commentator corrected the Info / Line-ups panels (Phase 11)
    control.subscribe("stat_overrides", (msg) => {
      const { overrides, ts } = msg.data as { overrides: StatOverrides | null; ts?: string };
      if (ts && ts < lastOverrideTsRef.current) return; // ignore an out-of-order push
      if (ts) lastOverrideTsRef.current = ts;
      setStatOverrides(overrides);
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

  // Phase 11: pre-game league table + form (slow-changing, separate cached proxy)
  const { history: matchHistory, loading: historyLoading } = useMatchHistory(
    room.fixtureId,
  );

  // Phase 11: Fotmob profile links for lineup players, resolved once the lineup
  // appears (background, cached server-side per player).
  const fotmobLinks = useFotmobLinks(room.id, room.fixtureId, matchStats?.lineups);

  // Phase 11: apply the commentator's Info / Line-up corrections on top of the
  // live Sportmonks data before anything renders or rates them.
  const displayStats = useMemo(
    () => (matchStats ? applyStatOverrides(matchStats, statOverrides) : matchStats),
    [matchStats, statOverrides],
  );
  const saveStatOverrides = (next: StatOverrides) => {
    setStatOverrides(next); // optimistic; the control echo confirms for everyone
    pendingOverrideRef.current = true; // guard against a mid-save reconnect clobbering this
    void fetch(`/api/rooms/${room.id}/overrides`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .catch(() => {})
      .finally(() => {
        pendingOverrideRef.current = false;
      });
  };

  // live scoreline from the stats poll, falling back to the page-load value so a
  // goal during the session updates the header. The CLOCK stays event-sourced
  // (golden rule 6) — only the score tracks the provider here.
  const liveHome = matchStats?.score.home ?? room.homeScore;
  const liveAway = matchStats?.score.away ?? room.awayScore;

  // rateable players (FR-12.3): starters + subs from the (corrected) lineup
  const ratingPlayers = useMemo<RatingPlayer[]>(() => {
    const out: RatingPlayer[] = [];
    const lu = displayStats?.lineups;
    for (const side of ["home", "away"] as const) {
      const s = lu?.[side];
      if (!s) continue;
      for (const p of s.starters)
        if (p.playerId != null) out.push({ playerId: p.playerId, name: p.name, side, starter: true });
      for (const p of s.bench)
        if (p.playerId != null) out.push({ playerId: p.playerId, name: p.name, side, starter: false });
    }
    return out;
  }, [displayStats]);
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

  type TabId = "chat" | "stats" | "questions" | "callin";
  // Mobile room sections (Cloud Design): CHAT / STATS / CALL IN in a bottom
  // segmented bar, swipeable. The commentator swaps CALL IN (they're already
  // on air) for their QUESTIONS inbox.
  const tabIcon = (paths: React.ReactNode) => (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[22px] w-[22px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths}
    </svg>
  );
  const mobileTabs: { id: TabId; label: string; badge: number; icon: React.ReactNode }[] = [
    {
      id: "chat",
      label: "Chat",
      badge: 0,
      icon: tabIcon(
        <path d="M21 11.5a8.5 8.5 0 01-8.5 8.5 8.4 8.4 0 01-3.6-.8L3 21l1.8-5.1A8.5 8.5 0 1121 11.5z" />,
      ),
    },
    ...(isRoomCommentator
      ? [
          {
            id: "questions" as const,
            label: "Questions",
            badge: newQuestionCount,
            icon: tabIcon(
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9.3a2.5 2.5 0 115 .4c0 1.6-2.5 2-2.5 3.5" />
                <line x1="12" y1="16.5" x2="12" y2="16.55" />
              </>,
            ),
          },
        ]
      : []),
    ...(showStats
      ? [
          {
            id: "stats" as const,
            label: "Stats",
            badge: 0,
            icon: tabIcon(
              <>
                <line x1="6" y1="20" x2="6" y2="14" />
                <line x1="12" y1="20" x2="12" y2="8" />
                <line x1="18" y1="20" x2="18" y2="4" />
              </>,
            ),
          },
        ]
      : []),
    ...(!isRoomCommentator
      ? [
          {
            id: "callin" as const,
            label: "Call in",
            badge: 0,
            icon: tabIcon(
              <>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0014 0" />
                <line x1="12" y1="18" x2="12" y2="21" />
              </>,
            ),
          },
        ]
      : []),
  ];

  // horizontal swipe between mobile sections (|dx|>55 and clearly horizontal)
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const onPanelTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY };
  };
  const onPanelTouchEnd = (e: React.TouchEvent) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      const order = mobileTabs.map((m) => m.id);
      const i = Math.max(0, order.indexOf(tab));
      const next = dx < 0 ? Math.min(i + 1, order.length - 1) : Math.max(i - 1, 0);
      if (order[next] !== tab) setTab(order[next]);
    }
  };

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
        roomState === "wrapped" || isDiscussion ? null : (
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
      commentator={room.hosts.map((h) => h.username).join(" & ")}
      home={room.home}
      away={room.away}
      discussion={isDiscussion}
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
      syncedClock={syncedClockText}
      speakers={audio.speakers}
    />
  );

  // wrapped + room commentator: the center becomes the downloads panel
  const showDownloads = roomState === "wrapped" && isRoomCommentator;

  // manual chat refresh (founder 2026-06-29): re-pull complete threads from the
  // DB snapshot and merge — a fallback if a realtime message was missed.
  const refreshChat = async () => {
    try {
      const res = await fetch(`/api/rooms/${room.id}/snapshot`, { cache: "no-store" });
      if (!res.ok) return;
      const s = (await res.json()) as { messages?: ChatMessage[] };
      if (!s.messages) return;
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const m of s.messages!) byId.set(m.id, m);
        return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    } catch {
      /* best-effort */
    }
  };

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
      onRefresh={refreshChat}
      watching={watching}
      conn={conn}
      onSent={appendMessage}
      sliderAgg={sliderAgg}
      mySliderValue={props.mySliderValue}
      predictionAgg={predictionAgg}
      myPrediction={props.myPrediction}
      activePoll={activePoll}
      myPollVote={props.myPollVote}
      talkConsentGiven={props.talkConsentGiven}
      hasPendingTalk={props.hasPendingTalk}
      talkResolvedSignal={talkResolvedSignal}
      queuePosition={queuePosition}
      broadcastStart={broadcastStart}
      chatOpen={chatOpen}
      floats={floats}
      onReact={sendReaction}
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

  // Interactive widgets (founder 2026-07-02): desktop gets a dedicated Polls
  // tab so the widgets stop consuming permanent chat-column height; mobile
  // keeps predictor + poll in chat and gets ratings under STATS. Ratings open
  // at HALF-TIME (first half) and again POSTGAME (whole game, revisable).
  const ratingsWindow = roomState === "halftime" || roomState === "postgame";
  const predictorRelevant =
    audioLive && (roomState === "pregame" || predictionAgg.total > 0);
  const pollRelevant = !!activePoll || (audioLive && isRoomCommentator);
  const ratingsRelevant =
    (ratingsWindow || ratingsAgg.length > 0) && ratingPlayers.length > 0;
  const pollsBadge =
    (activePoll ? 1 : 0) +
    (ratingsWindow && ratingPlayers.length > 0 ? 1 : 0) +
    (roomState === "pregame" && audioLive ? 1 : 0);

  const ratingsWidget = ratingsRelevant ? (
    <PlayerRatings
      roomId={room.id}
      players={ratingPlayers}
      agg={ratingsAgg}
      myRatings={props.myRatings}
      open={ratingsWindow && !!viewer && !isRoomCommentator}
      hint={
        roomState === "halftime"
          ? "Rating the first half. Revise your scores at full time."
          : roomState === "postgame"
            ? "Rate the full 90."
            : undefined
      }
      homeName={room.home}
      awayName={room.away}
    />
  ) : null;

  const pollsPanel = (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {pollRelevant && (
        <div>
          {activePoll && (
            <PollWidget
              poll={activePoll}
              myVote={props.myPollVote}
              canVote={!!viewer && !isRoomCommentator}
              isCommentator={isRoomCommentator}
            />
          )}
          {audioLive && isRoomCommentator && <PollComposer roomId={room.id} />}
        </div>
      )}
      {predictorRelevant && (
        <ScorePredictor
          roomId={room.id}
          myValue={props.myPrediction}
          agg={predictionAgg}
          open={roomState === "pregame" && !!viewer && !isRoomCommentator}
          homeName={room.home}
          awayName={room.away}
        />
      )}
      {ratingsWidget}
      {!pollRelevant && !predictorRelevant && !ratingsRelevant && (
        <p className="px-1 py-6 text-center text-sm text-secondary">
          Nothing to vote on right now. Polls and player ratings appear here
          when the host opens them.
        </p>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col">
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
        competition={room.competition || undefined}
        showOnMobile={isRoomCommentator}
        discussion={isDiscussion}
        title={room.title}
        live={audioLive}
        themeToggle={<ThemeToggle />}
        share={<ShareButton />}
        userMenu={
          viewer ? (
            <UserMenu
              username={viewer.username}
              avatarUrl={viewer.avatarUrl}
              admin={viewer.role === "admin"}
            />
          ) : (
            <NextLink
              href="/signin"
              className="flex h-11 items-center rounded-lg px-3 text-sm font-semibold hover:bg-raised"
            >
              Sign in
            </NextLink>
          )
        }
      />

      {/* mobile: the sync transport sits at the very top (the desktop match bar
          is lg-only). The listener transport paints its own surface; the
          commentator bar keeps the plain strip. */}
      <div
        className={`lg:hidden ${isRoomCommentator ? "border-b border-line bg-surface" : ""}`}
      >
        {bar}
      </div>

      <div
        onTouchStart={onPanelTouchStart}
        onTouchEnd={onPanelTouchEnd}
        className={`flex min-h-0 flex-1 flex-col ${showStats ? "lg:grid lg:w-full lg:grid-cols-[2fr_1fr]" : ""}`}
      >
        {showStats && (
        <aside
          aria-label="Stats"
          className={`${tab === "stats" ? "block" : "hidden"} min-h-0 overflow-y-auto lg:order-2 lg:block`}
        >
          <StatsPanel
            data={displayStats}
            radio={audio.radioActive}
            isRoomCommentator={isRoomCommentator}
            roomId={room.id}
            overrides={statOverrides}
            onSaveOverrides={saveStatOverrides}
            rawLineups={matchStats?.lineups}
            pushedTab={pushedStatsTab}
            pushNonce={statsPushNonce}
            onPushTab={pushStatsTab}
            expanded
            outage={statsOutage}
            history={matchHistory}
            historyLoading={historyLoading}
            comingSoon={room.comingSoon}
            fotmob={fotmobLinks}
            defaultTab={roomState === "waiting" || roomState === "pregame" ? "info" : "stats"}
          />
          {/* mobile: RATE THE PLAYERS lives under STATS (Cloud Design); the
              desktop copy renders in the chat column's Polls tab */}
          {ratingsWidget && <div className="px-3 pb-3 lg:hidden">{ratingsWidget}</div>}
        </aside>
        )}

        <section
          aria-label="Chat"
          className={`${tab === "chat" || tab === "questions" ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:order-1 lg:flex ${showStats ? "lg:border-r lg:border-line" : ""}`}
        >
          <div className="hidden border-b border-line bg-surface lg:flex">
            {[
              { id: "chat" as const, label: "Room chat", badge: 0 },
              { id: "polls" as const, label: "Polls", badge: pollsBadge },
              ...(isRoomCommentator
                ? [
                    {
                      id: "questions" as const,
                      label: "Questions",
                      badge: newQuestionCount,
                    },
                  ]
                : []),
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCenterTab(t.id)}
                aria-current={centerTab === t.id ? "page" : undefined}
                className={`relative h-10 px-4 text-sm font-extrabold ${
                  centerTab === t.id
                    ? "border-b-2 border-red text-primary"
                    : "text-secondary hover:text-primary"
                }`}
              >
                {t.label}
                {t.badge > 0 && (
                  <span className="absolute top-0.5 right-0 flex h-4 min-w-[1rem] animate-fcpulse items-center justify-center rounded-full bg-red px-1 font-mono text-[9px] font-bold text-white tabular-nums">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* mobile: driven by the tab bar; desktop: by centerTab */}
          <div className={`min-h-0 flex-1 ${tab === "questions" ? "overflow-y-auto" : "flex flex-col"} lg:hidden`}>
            {tab === "questions" ? questionsPanel : chatPanel}
          </div>
          <div className={`hidden min-h-0 flex-1 ${centerTab === "questions" ? "overflow-y-auto" : ""} lg:flex lg:flex-col`}>
            {centerTab === "questions" && isRoomCommentator
              ? questionsPanel
              : centerTab === "polls"
                ? pollsPanel
                : chatPanel}
          </div>
        </section>

        {/* CALL IN (mobile listeners only — the commentator is already on air;
            desktop keeps request-to-talk inline in chat) */}
        {!isRoomCommentator && (
          <section
            aria-label="Call in"
            className={`${tab === "callin" ? "block" : "hidden"} min-h-0 flex-1 overflow-y-auto lg:hidden`}
          >
            <div className="mx-auto max-w-md px-5 py-8">
              <div className="mb-6 text-center">
                <span className="mx-auto mb-3.5 flex h-16 w-16 items-center justify-center rounded-full border border-red/40 bg-red/10 text-red">
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="h-[30px] w-[30px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0014 0" />
                    <line x1="12" y1="18" x2="12" y2="21" />
                  </svg>
                </span>
                <h2 className="display mb-2 text-[26px] leading-none">Go on air</h2>
                <p className="mx-auto max-w-[280px] text-[13.5px] leading-normal text-secondary">
                  Request the mic and {room.commentatorUsername} can bring you
                  into the show live during a break in play.
                </p>
              </div>

              {!viewer ? (
                <div className="rounded-xl border-[0.75px] border-line bg-raised p-4 text-center">
                  <p className="text-sm text-secondary">
                    Sign in to request the mic and join the show.
                  </p>
                  <a
                    href="/signin"
                    className="mt-3 inline-flex h-11 items-center rounded-lg bg-red px-5 text-sm font-semibold text-white"
                  >
                    Sign in
                  </a>
                </div>
              ) : queuePosition != null ? (
                <div className="rounded-[14px] border border-red/40 bg-surface p-5 text-center">
                  <p className="mb-2 font-mono text-[9.5px] tracking-[0.12em] text-red uppercase">
                    You&apos;re in the queue
                  </p>
                  <p className="display text-[44px] leading-none tabular-nums">
                    #{queuePosition}
                  </p>
                  <p className="mt-2 text-[12.5px] text-secondary">
                    Keep listening. {room.commentatorUsername} brings you on
                    between plays.
                  </p>
                  <button
                    type="button"
                    onClick={() => void leaveQueue()}
                    disabled={leavingQueue}
                    className="mt-3.5 inline-block rounded-[9px] border border-line px-4 py-2 text-[12.5px] font-bold text-secondary transition-colors hover:border-red/50 hover:text-red disabled:opacity-60"
                  >
                    {leavingQueue ? "Leaving…" : "Leave queue"}
                  </button>
                </div>
              ) : (
                <InteractionButtons
                  roomId={room.id}
                  consentGiven={props.talkConsentGiven}
                  hasPendingTalk={props.hasPendingTalk}
                  resolvedSignal={talkResolvedSignal}
                  queuePosition={queuePosition}
                />
              )}

              <p className="mt-7 mb-2.5 font-mono text-[10px] tracking-[0.1em] text-secondary uppercase">
                On air now
              </p>
              <div className="space-y-2">
                {room.hosts.map((h) => (
                  <div
                    key={h.username}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-raised px-3 py-2.5"
                  >
                    <Avatar src={h.avatarUrl} name={h.username} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[13px] font-extrabold">
                        <span className="truncate">{h.username}</span>
                        <span className="shrink-0 rounded-[3px] border border-red/50 px-1 py-0.5 font-mono text-[8px] tracking-[0.1em] text-red uppercase">
                          Host
                        </span>
                      </p>
                      <p className="font-mono text-[9px] text-secondary">
                        {audioLive ? "speaking" : "show hasn't started"}
                      </p>
                    </div>
                  </div>
                ))}
                {audio.speakers
                  .filter((s) => !s.isCommentator && s.name !== "you")
                  .map((s) => (
                    <div
                      key={s.identity}
                      className="flex items-center gap-2.5 rounded-xl border border-line bg-raised px-3 py-2.5"
                    >
                      <Avatar name={s.name} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold">{s.name}</p>
                        <p className="font-mono text-[9px] text-secondary">on air</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* mobile: bottom segmented bar (Cloud Design) — CHAT / STATS / CALL IN */}
      <nav
        aria-label="Room sections"
        className="flex flex-none items-stretch border-t border-line bg-canvas/90 px-2 pt-2 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {mobileTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-1 py-1 transition-colors ${
              tab === t.id ? "text-primary" : "text-secondary"
            }`}
          >
            {t.icon}
            <span className="font-mono text-[9px] tracking-[0.06em] uppercase">
              {t.label}
            </span>
            {t.badge > 0 && (
              <span className="absolute top-0 right-[22%] flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red px-1 font-mono text-[9px] font-bold text-white tabular-nums">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* desktop: in-flow audio dock at the base of the h-dvh flex column */}
      <div className="hidden flex-none border-t border-line bg-surface lg:block">
        {bar}
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
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 leading-none text-secondary">
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={myVote === 1}
        disabled={disabled}
        onClick={() => onVote(myVote === 1 ? 0 : 1)}
        className={`flex h-4 w-6 items-center justify-center hover:text-green ${myVote === 1 ? "text-green" : ""}`}
      >
        <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 fill-current"><path d="M6 0l6 8H0z" /></svg>
      </button>
      <span className="text-[11px] font-semibold tabular-nums">{up - down}</span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={myVote === -1}
        disabled={disabled}
        onClick={() => onVote(myVote === -1 ? 0 : -1)}
        className={`flex h-4 w-6 items-center justify-center hover:text-red ${myVote === -1 ? "text-red" : ""}`}
      >
        <svg aria-hidden="true" viewBox="0 0 12 8" className="h-2 w-3 fill-current"><path d="M6 8L0 0h12z" /></svg>
      </button>
    </span>
  );
}

/** Compact relative time for chat message stamps (e.g. "now", "2m", "3h"). */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Small square thumbnail for an inline chat-message link preview; hides itself
 *  if the image 404s. */
function LinkThumb({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-12 w-12 shrink-0 rounded-md border border-line object-cover"
    />
  );
}

/** One item in the merged chat+links stream (Phase 11). Both carry id +
 *  created_at; the stream interleaves them chronologically and a local filter
 *  narrows to chat-only / links-only / blended (default). */
type StreamItem =
  | { kind: "message"; id: string; createdAt: string; msg: ChatMessage }
  | { kind: "link"; id: string; createdAt: string; lnk: Link };

type StreamFilter = "blended" | "chat" | "links";
type SortMode = "new" | "top" | "controversial";

// how many reply levels nest inline before a "Continue this thread →" jump into
// the focused overlay (Reddit's permalink pattern); keeps a 50%/phone column legible
const MAX_INLINE_DEPTH = 4;

/** Reddit-style controversy: high only when up and down are both large and close
 *  (lots of engagement, evenly split). Zero unless there are both up and downvotes. */
function controversyScore(up: number, down: number): number {
  if (up <= 0 || down <= 0) return 0;
  return (up + down) * (Math.min(up, down) / Math.max(up, down));
}

/** Compare two values for a descending ranked sort, newest-first as the tiebreak. */
function rankCompare(
  aVal: number,
  bVal: number,
  aCreated: string,
  bCreated: string,
): number {
  if (bVal !== aVal) return bVal - aVal;
  return aCreated < bCreated ? 1 : aCreated > bCreated ? -1 : 0;
}

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
  onRefresh,
  watching,
  conn,
  onSent,
  sliderAgg,
  mySliderValue,
  predictionAgg,
  myPrediction,
  activePoll,
  myPollVote,
  talkConsentGiven,
  hasPendingTalk,
  talkResolvedSignal,
  queuePosition,
  broadcastStart,
  chatOpen,
  floats,
  onReact,
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
  onRefresh: () => void;
  watching: number | null;
  conn: ConnState;
  onSent: (m: ChatMessage) => void;
  sliderAgg: SliderAggregate;
  mySliderValue: number | null;
  predictionAgg: PredictionAggregate;
  myPrediction: MyPrediction;
  activePoll: PollState;
  myPollVote: MyPollVote;
  talkConsentGiven: boolean;
  hasPendingTalk: boolean;
  talkResolvedSignal: number;
  queuePosition: number | null;
  broadcastStart: string | null;
  chatOpen: boolean;
  floats: ReactionFloat[];
  onReact: (emoji: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // "Ask the host" pill on the reactions row → opens the question form inside
  // InteractionButtons (one implementation; founder 2026-07-02)
  const [askSignal, setAskSignal] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [votes, setVotes] = useState(myVotes);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const toast = useToast();
  const [linkVotes, setLinkVotes] = useState(myLinkVotes);
  const [streamFilter, setStreamFilter] = useState<StreamFilter>("blended");
  const [sortMode, setSortMode] = useState<SortMode>("new");
  // frozen top-level display order for the ranked (non-"new") modes — so live
  // votes/inserts don't re-rank under the reader; new items batch behind a pill
  const [frozenIds, setFrozenIds] = useState<string[] | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [submittingLink, setSubmittingLink] = useState(false);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  // threading (Phase 11 Slice 3): which node has its reply box open, the draft,
  // the set of collapsed roots, and a node focused full-depth in the overlay
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [focusRoot, setFocusRoot] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const pinnedRef = useRef(true); // user is at/near the bottom
  const prevLenRef = useRef(0); // length of the merged stream last render
  const filterRef = useRef<StreamFilter>("blended");
  const [unread, setUnread] = useState(0);
  const NEAR_BOTTOM_PX = 64;

  // saved filter + sort (localStorage, per-device); load after mount to avoid an SSR mismatch
  useEffect(() => {
    try {
      const s = localStorage.getItem("fc:streamFilter");
      if (s === "chat" || s === "links" || s === "blended") setStreamFilter(s);
      const sm = localStorage.getItem("fc:sortMode");
      if (sm === "new" || sm === "top" || sm === "controversial") setSortMode(sm);
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
  function changeSort(mode: SortMode) {
    setSortMode(mode);
    setUnread(0); // the chronological unread count is meaningless in ranked modes
    try {
      localStorage.setItem("fc:sortMode", mode);
    } catch {
      /* ignore */
    }
  }

  const messageIds = useMemo(() => new Set(messages.map((m) => m.id)), [messages]);

  // the merged stream is TOP-LEVEL items only (roots + links) interleaved by
  // created_at; replies hang off their root via childrenByParent (Phase 11). A
  // reply whose parent isn't loaded (root past the fetch window, or an ancestor
  // hidden by RLS) is surfaced as a top-level item rather than silently dropped.
  const streamItems = useMemo<StreamItem[]>(() => {
    // links are retired (they render inline in chat now) — the stream is chat
    // top-level items only; replies hang off their root via childrenByParent.
    const items: StreamItem[] = [];
    for (const m of messages)
      if (!m.parent_id || !messageIds.has(m.parent_id))
        items.push({ kind: "message", id: m.id, createdAt: m.created_at, msg: m });
    items.sort((a, b) =>
      a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0,
    );
    return items;
  }, [messages, messageIds]);

  // parent id -> its direct replies, each list chronological (Slice 3; vote-sort
  // comes in Slice 4). Rebuilt whenever a message/reply arrives.
  const childrenByParent = useMemo(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const m of messages) {
      if (!m.parent_id) continue;
      const arr = map.get(m.parent_id);
      if (arr) arr.push(m);
      else map.set(m.parent_id, [m]);
    }
    for (const arr of map.values())
      arr.sort((a, b) => {
        if (sortMode === "top")
          return rankCompare(Number(a.score), Number(b.score), a.created_at, b.created_at);
        if (sortMode === "controversial")
          return rankCompare(
            controversyScore(a.up_count, a.down_count),
            controversyScore(b.up_count, b.down_count),
            a.created_at,
            b.created_at,
          );
        return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
      });
    return map;
  }, [messages, sortMode]);

  const itemRank = (it: StreamItem, mode: Exclude<SortMode, "new">) => {
    const up = it.kind === "message" ? it.msg.up_count : it.lnk.up_count;
    const down = it.kind === "message" ? it.msg.down_count : it.lnk.down_count;
    // score is a Postgres numeric, which hydrates as a string on the SSR path
    const score = Number(it.kind === "message" ? it.msg.score : it.lnk.score);
    return mode === "top" ? score : controversyScore(up, down);
  };

  // streamItems sorted by the active mode ("new" stays chronological asc — the
  // pin-to-bottom default; top/controversial rank highest-first)
  const sortedItems = useMemo(() => {
    if (sortMode === "new") return streamItems;
    return [...streamItems].sort((a, b) =>
      rankCompare(itemRank(a, sortMode), itemRank(b, sortMode), a.createdAt, b.createdAt),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamItems, sortMode]);

  const itemById = useMemo(() => {
    const m = new Map<string, StreamItem>();
    for (const it of streamItems) m.set(it.id, it);
    return m;
  }, [streamItems]);

  // (re)freeze the order on entering a ranked mode AND when the filter changes
  // (so a stale cross-filter snapshot never drops items / inflates the pill);
  // NOT on data change — that's the whole point of freezing
  useEffect(() => {
    if (sortMode === "new") setFrozenIds(null);
    else setFrozenIds(sortedItems.map((i) => i.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode, streamFilter]);

  // what renders: live in "new"; the frozen snapshot (live data looked up per id)
  // in ranked modes, so order holds steady while counts still update
  const displayItems = useMemo(() => {
    if (sortMode === "new" || !frozenIds) return sortedItems;
    const out: StreamItem[] = [];
    for (const id of frozenIds) {
      const it = itemById.get(id);
      if (it) out.push(it);
    }
    return out;
  }, [sortMode, frozenIds, sortedItems, itemById]);

  const pendingCount = useMemo(() => {
    if (sortMode === "new" || !frozenIds) return 0;
    const frozen = new Set(frozenIds);
    return streamItems.reduce((n, it) => n + (frozen.has(it.id) ? 0 : 1), 0);
  }, [sortMode, frozenIds, streamItems]);

  function refreshSort() {
    setFrozenIds(sortedItems.map((i) => i.id));
  }

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
    // ranked modes (top/controversial) freeze the order + batch new items, so no
    // pin-to-bottom there; only the chronological "new" mode follows live inserts
    if (sortMode !== "new") {
      prevLenRef.current = streamItems.length;
      filterRef.current = streamFilter;
      return;
    }
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
  }, [streamItems.length, streamFilter, sortMode, viewer?.userId]);

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

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendReply(e: React.FormEvent, parentId: string) {
    e.preventDefault();
    if (!replyDraft.trim() || replyBusy) return;
    setReplyBusy(true);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: room.id, body: replyDraft.trim(), parentId }),
    });
    setReplyBusy(false);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body.message) onSent(body.message); // appendMessage → tree rebuilds
      setReplyDraft("");
      setReplyTo(null);
      setCollapsed((prev) => {
        // make sure the parent is expanded so the new reply is visible
        if (!prev.has(parentId)) return prev;
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    } else {
      const body = await res.json().catch(() => ({}));
      toast(body.error ?? "Couldn't post your reply.");
    }
  }

  // one message + its reply subtree. Indents inline up to MAX_INLINE_DEPTH, then
  // offers a "Continue this thread →" jump into the focused overlay.
  function renderNode(m: ChatMessage, depth: number): React.ReactNode {
    const kids = childrenByParent.get(m.id) ?? [];
    const isCollapsed = collapsed.has(m.id);
    const isCommentator = m.author?.role === "commentator";
    const isOwn = viewer?.userId === m.user_id;
    // links live in chat now: strip the URL from the visible text (it renders as
    // the card below). A link-only message shows just the card.
    const displayBody = m.link_url
      ? m.body.replace(/https?:\/\/[^\s]+/i, "").replace(/\s+/g, " ").trim()
      : m.body;
    return (
      <li
        key={m.id}
        className={depth === 0 ? "border-t border-line/60 py-2.5 first:border-t-0" : ""}
      >
        {m.hidden_by ? (
          <div className="rounded-lg px-3 py-2 text-xs text-secondary italic">
            Message hidden{m.hidden_by === "flags" ? " by community flags" : ""}
          </div>
        ) : (
          <div
            className={`group rounded-lg px-2 py-1.5 ${
              isCommentator
                ? "border-l-2 border-red bg-inset"
                : isOwn
                  ? "bg-raised/50"
                  : ""
            }`}
          >
            <div className="flex gap-2.5">
              {/* FR-26: tapping a chat avatar opens a profile popover */}
              {m.author?.username ? (
                <ProfilePopover
                  username={m.author.username}
                  className="mt-0.5 shrink-0 self-start"
                >
                  <Avatar
                    src={m.author?.avatar_url}
                    name={m.author?.username}
                    size={30}
                  />
                </ProfilePopover>
              ) : (
                <Avatar
                  src={m.author?.avatar_url}
                  name={m.author?.username}
                  size={30}
                  className="mt-0.5 self-start"
                />
              )}
              <div className="min-w-0 flex-1">
                {/* header: name · host badge · time · (mod actions) */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[13px] font-extrabold ${isCommentator ? "text-red" : ""}`}
                  >
                    {m.author?.username ?? "…"}
                  </span>
                  {isCommentator && (
                    <span className="rounded-[3px] border border-red/50 px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.1em] text-red uppercase">
                      Host
                    </span>
                  )}
                  <span
                    suppressHydrationWarning
                    className="font-mono text-[10px] text-secondary tabular-nums"
                  >
                    {timeAgo(m.created_at)}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1 text-xs">
                    {viewer && !isOwn && !flagged.has(m.id) && (
                      <button
                        type="button"
                        aria-label="Flag message"
                        title="Flag message"
                        onClick={() => flag(m.id)}
                        className="px-1 text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:text-red focus-visible:opacity-100"
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
                        className="px-1 text-secondary hover:text-red"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                </div>
                {/* body */}
                <p className="mt-0.5 text-[13px] leading-relaxed">{displayBody}</p>
                {/* inline link card */}
                {m.link_url && (
                  <a
                    href={m.link_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-2 flex gap-2 rounded-lg border-[0.75px] border-line bg-surface/70 p-1.5 shadow-card hover:bg-surface"
                  >
                    <span className="flex min-w-0 flex-1 flex-col justify-center">
                      <span className="line-clamp-2 text-xs font-semibold leading-snug hover:underline">
                        {m.link_title ?? m.link_url}
                      </span>
                      <span className="mt-0.5 truncate text-[11px] text-secondary">
                        {m.link_domain ?? ""}
                      </span>
                    </span>
                    {m.link_image && <LinkThumb src={m.link_image} />}
                  </a>
                )}
                {/* actions: vote · reply */}
                <div className="mt-1.5 flex items-center gap-3">
                  <VoteArrows
                    up={m.up_count}
                    down={m.down_count}
                    myVote={votes[m.id]}
                    disabled={!viewer}
                    onVote={(v) => vote(m.id, v)}
                  />
                  {canType && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(replyTo === m.id ? null : m.id);
                        setReplyDraft("");
                      }}
                      className="text-[11.5px] font-semibold text-secondary hover:text-primary"
                    >
                      Reply
                    </button>
                  )}
                </div>
                {/* replies toggle */}
                {kids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => toggleCollapse(m.id)}
                    aria-expanded={!isCollapsed}
                    className="mt-1 text-xs font-semibold text-secondary hover:text-primary"
                  >
                    {isCollapsed
                      ? `▸ ${kids.length} ${kids.length === 1 ? "reply" : "replies"}`
                      : "▾ hide replies"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {replyTo === m.id && canType && (
          <form onSubmit={(e) => sendReply(e, m.id)} className="mt-1 ml-7 flex gap-2">
            <input
              type="text"
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              maxLength={500}
              placeholder="Reply…"
              aria-label="Reply"
              autoFocus
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-secondary"
            />
            <button
              type="submit"
              disabled={replyBusy || !replyDraft.trim()}
              className="h-9 shrink-0 rounded-lg bg-red px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              Reply
            </button>
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setReplyDraft("");
              }}
              aria-label="Cancel reply"
              className="h-9 shrink-0 px-1 text-sm text-secondary hover:text-primary"
            >
              ✕
            </button>
          </form>
        )}

        {/* a hidden node never renders its replies — matches the reload path
            (RLS drops a hidden root's whole thread) and stops moderated content
            from carrying a visible reply pile live */}
        {!m.hidden_by &&
          kids.length > 0 &&
          !isCollapsed &&
          (depth < MAX_INLINE_DEPTH ? (
            <ul className="mt-1 ml-3 space-y-1 border-l border-line pl-2">
              {kids.map((k) => renderNode(k, depth + 1))}
            </ul>
          ) : (
            <button
              type="button"
              onClick={() => setFocusRoot(m.id)}
              className="mt-1 ml-7 text-xs font-semibold text-red hover:underline"
            >
              Continue this thread ({kids.length}) →
            </button>
          ))}
      </li>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* one compact bar: refresh (left) + sort (right). The Chat/Links filter is
          gone — links live inline in chat now (founder 2026-06-29). A connection
          problem still surfaces here; the "N new" pill drops below. */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {conn !== "connected" && (
            <span
              title={conn === "broken" ? "Live updates unavailable — refresh to retry" : "Connecting…"}
              className={`shrink-0 text-[11px] ${conn === "broken" ? "text-red" : "text-secondary"}`}
            >
              {conn === "broken" ? "⚠ offline" : "…"}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh chat"
            title="Refresh chat"
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1 font-mono text-[10px] tracking-[0.04em] text-secondary uppercase transition-colors hover:border-red hover:text-primary"
          >
            <span aria-hidden="true">↻</span> Refresh
          </button>
        </div>
        <div
          className="flex shrink-0 items-center gap-1 font-mono text-[10px] tracking-[0.04em]"
          role="tablist"
          aria-label="Sort order"
        >
          {(["new", "top", "controversial"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sortMode === s}
              onClick={() => changeSort(s)}
              className={`rounded-md px-2 py-1 uppercase transition-colors ${
                sortMode === s
                  ? "bg-inverted font-bold text-inverted-fg"
                  : "text-secondary hover:text-primary"
              }`}
            >
              {s === "new" ? "New" : s === "top" ? "Top" : "Controversial"}
            </button>
          ))}
        </div>
      </div>
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={refreshSort}
          className="block w-full border-b border-line bg-red/15 py-1 text-center text-xs font-semibold text-red tabular-nums"
        >
          {pendingCount} new — tap to refresh
        </button>
      )}

      {roomState === "waiting" && <Countdown targetIso={broadcastStart} />}

      <ul
        ref={listRef}
        onScroll={onChatScroll}
        className="flex-1 overflow-y-auto px-1.5"
      >
        {displayItems.map((item) =>
          item.kind === "link" ? (
            <LinkCard
              key={item.id}
              link={item.lnk}
              myVote={linkVotes[item.id]}
              canVote={viewer !== null}
              onVote={(v) => linkVote(item.id, v)}
            />
          ) : (
            renderNode(item.msg, 0)
          ),
        )}
        {displayItems.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-secondary">
            {roomState === "waiting"
              ? "The commentator will be along shortly."
              : "Nothing here yet — say hello."}
          </li>
        )}
      </ul>

      {/* new-messages affordance — chronological mode only; ranked modes use the
          "N new — refresh" pill instead (mutually exclusive) */}
      {sortMode === "new" && unread > 0 && (
        <button
          type="button"
          onClick={scrollChatToBottom}
          className="z-10 mx-auto -mt-9 mb-1 block rounded-full bg-red px-3 py-1 text-xs font-semibold text-white shadow tabular-nums"
        >
          {unread} new {unread === 1 ? "message" : "messages"} ↓
        </button>
      )}

      {/* score predictor: distribution visible to everyone; the form opens for
          signed-in listeners during pregame (FR-12.1) */}
      {inputsOpen && (roomState === "pregame" || predictionAgg.total > 0) && (
        <div className="border-t border-line px-3 pt-3 lg:hidden">
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
        <div className="border-t border-line px-3 pt-3 lg:hidden">
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

      {/* player ratings moved out of chat (founder 2026-07-02): desktop →
          Polls tab, mobile → under STATS */}

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
                    href={`/${room.commentatorUsername}`}
                    className="font-semibold text-red hover:underline"
                  >
                    {room.commentatorUsername}
                  </a>
                  . See you next time.
                </p>
              ) : (
                <div className="mt-3 flex flex-col items-center gap-2">
                  <p className="text-xs text-secondary">
                    Enjoyed it? Follow{" "}
                    <a
                      href={`/${room.commentatorUsername}`}
                      className="font-semibold text-red hover:underline"
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
      ) : !canType ? (
        <div className="border-t border-line p-3">
          <p className="rounded-xl border-[0.75px] border-line bg-raised p-4 text-center text-sm text-secondary">
            Waiting room — the commentator opens chat when the show starts.
          </p>
        </div>
      ) : (
        <div className="relative space-y-2 border-t border-line p-2">
          {/* floating reactions rise over the composer (Phase 5a); the fcfloat
              keyframe is neutralised under prefers-reduced-motion */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 bottom-full h-44 overflow-hidden"
          >
            {floats.map((f) => (
              <span
                key={f.id}
                className="animate-fcfloat absolute bottom-0"
                style={{ left: `${f.left}%`, animationDuration: `${f.dur}s` }}
              >
                <span
                  className="inline-block text-[22px]"
                  style={{ transform: `rotate(${f.rot}deg)` }}
                >
                  {f.emoji}
                </span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {REACTION_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact(e)}
                aria-label={`Send ${e} reaction`}
                className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-line bg-raised text-base transition-colors hover:border-red/60"
              >
                {e}
              </button>
            ))}
            {inputsOpen && !isRoomCommentator && (
              <button
                type="button"
                onClick={() => setAskSignal((s) => s + 1)}
                className="ml-auto shrink-0 rounded-full border border-line px-3 py-1.5 font-mono text-[10px] tracking-[0.04em] text-secondary transition-colors hover:border-red hover:text-primary"
              >
                Ask the host
              </button>
            )}
          </div>
          {notice && (
            <p role="alert" className="rounded-lg border border-line bg-raised px-3 py-1 text-xs text-secondary">
              {notice}
            </p>
          )}
          {/* one compact row — links go straight in the message (they unfurl into
              an inline card); no separate link compose any more (founder 2026-06-29) */}
          <form onSubmit={send} className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder={
                roomState === "waiting"
                  ? "Warm the room up"
                  : "Say something to the room…"
              }
              aria-label="Chat message"
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-inset px-3.5 text-sm placeholder:text-secondary focus:border-red focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-red text-white transition-colors hover:bg-red-hover disabled:opacity-60"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ↑
              </span>
            </button>
          </form>
          {inputsOpen && !isRoomCommentator && (
            <>
              <InteractionButtons
                roomId={room.id}
                consentGiven={talkConsentGiven}
                hasPendingTalk={hasPendingTalk}
                resolvedSignal={talkResolvedSignal}
                queuePosition={queuePosition}
                askSignal={askSignal}
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

      {/* focused single-thread overlay for chains past MAX_INLINE_DEPTH */}
      {focusRoot &&
        (() => {
          const root = messages.find((m) => m.id === focusRoot);
          if (!root) return null;
          return (
            <div
              className="fixed inset-0 z-50 flex flex-col bg-canvas/95 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label="Thread"
            >
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <button
                  type="button"
                  onClick={() => setFocusRoot(null)}
                  className="text-sm font-semibold text-secondary hover:text-primary"
                >
                  ← Back
                </button>
                <span className="text-sm font-semibold">Thread</span>
              </div>
              <ul className="flex-1 space-y-1 overflow-y-auto p-3">
                {renderNode(root, 0)}
              </ul>
            </div>
          );
        })()}
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

  // compact card (founder 2026-06-29, supersedes the 2026-06-11 "rich preview"
  // wide-image decision): title + domain + votes on the left, a small square
  // thumbnail on the right — keeps link cards from dwarfing the chat.
  return (
    <li className="rounded-xl border-[0.75px] border-line bg-surface p-3">
      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="min-w-0"
          >
            <p className="line-clamp-2 text-sm font-semibold leading-snug hover:underline">
              {link.og_title ?? link.url}
            </p>
            <p className="mt-0.5 truncate text-xs text-secondary">{link.domain}</p>
          </a>
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              aria-label="Upvote link"
              aria-pressed={myVote === 1}
              disabled={!canVote}
              onClick={() => onVote(myVote === 1 ? 0 : 1)}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold hover:bg-raised ${myVote === 1 ? "text-green" : "text-secondary hover:text-green"}`}
            >
              ▲
            </button>
            <span className="min-w-4 text-center text-xs font-semibold tabular-nums">
              {link.up_count - link.down_count}
            </span>
            <button
              type="button"
              aria-label="Downvote link"
              aria-pressed={myVote === -1}
              disabled={!canVote}
              onClick={() => onVote(myVote === -1 ? 0 : -1)}
              className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold hover:bg-raised ${myVote === -1 ? "text-red" : "text-secondary hover:text-red"}`}
            >
              ▼
            </button>
          </div>
        </div>
        {showImage && (
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="relative block h-20 w-20 shrink-0 self-start"
            aria-label={`Open ${link.og_title ?? link.url}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={link.og_image!}
              alt=""
              loading="lazy"
              onError={() => setImgBroken(true)}
              className="h-20 w-20 rounded-lg border border-line object-cover"
            />
            <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded bg-black/55 text-[10px] leading-none text-white">
              ↗
            </span>
          </a>
        )}
      </div>
    </li>
  );
}
