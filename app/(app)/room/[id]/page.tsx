import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { looksLikeUuid } from "@/lib/slug";
import { roomTitle, statsFixtureId } from "@/lib/rooms";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import {
  RealtimeRoom,
  type RoomInfo,
  type Viewer,
} from "@/components/room/RealtimeRoom";
import { Countdown } from "@/components/room/Countdown";
import { OpenWaitingButton } from "@/components/OpenWaitingButton";
import { callerFlagSummary } from "@/lib/callers";
import {
  createServiceClient,
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type {
  ChatMessage,
  Fixture,
  Link,
  MyPollVote,
  MyPrediction,
  MyRatings,
  Question,
  Room,
  TalkRequest,
} from "@/lib/db/types";
import { predictionAggregate } from "@/lib/predictions";
import { loadActivePoll } from "@/lib/polls";
import { ratingsAggregate } from "@/lib/ratings";
import { loadRoomThreadMessages } from "@/lib/db/threads";
import { isAdmin } from "@/lib/roles";
import { isRoomHost } from "@/lib/roomHosts";
import type { StatOverrides } from "@/lib/statOverrides";

type RoomWithJoins = Room & {
  fixture: Fixture | null;
  commentator: { username: string };
};

// FR-19.3: the canonical room URL is /room/{slug}; old /room/{uuid} links
// resolve too and the page permanently redirects them to the slug.
async function loadRoom(param: string) {
  const byId = looksLikeUuid(param);
  if (!byId && !/^[a-z0-9-]{1,120}$/.test(param)) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("rooms")
    .select(
      "*, fixture:fixtures(*), commentator:profiles!rooms_commentator_id_fkey(username)",
    )
    .eq(byId ? "id" : "slug", param)
    .maybeSingle<RoomWithJoins>();
  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const room = await loadRoom((await params).id);
  if (!room) return { title: "Room" };
  const title = roomTitle(room);
  const host = room.commentator?.username;
  // Compliance: describe the LISTENING room, never a broadcast of the match
  // ("your own stream", "listen alongside"). Rich preview for shared room links.
  const description = room.blurb
    ? room.blurb
    : `Live fan commentary for ${title}${host ? `, hosted by @${host}` : ""}. Listen alongside the match on your own stream, with chat and live stats. Free to listen.`;
  const canonical = room.slug ? `/room/${room.slug}` : undefined;
  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title: `${title} · ${brand.name}`,
      description,
      ...(canonical ? { url: canonical } : {}),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${brand.name}`,
      description,
    },
  };
}

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const room = await loadRoom(id);
  if (!room) notFound();

  // old id URLs move permanently to the slug (FR-19.3; Next's permanentRedirect
  // sends 308, the method-preserving 301 equivalent)
  if (looksLikeUuid(id) && room.slug) {
    permanentRedirect(`/room/${room.slug}`);
  }

  // FR-19.7: a canceled room's URL stays truthful, never 404s
  if (room.state === "canceled") {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-line px-4 py-3">
          <NextLink href="/" aria-label={brand.name}>
            <Logo />
          </NextLink>
        </header>
        <div className="mx-auto max-w-md px-4 py-10 text-center">
          <h1 className="text-xl font-bold">
            {roomTitle(room)}
          </h1>
          <p className="mt-2 text-sm text-secondary">
            This room was canceled. Check the schedule for other rooms on this
            fixture.
          </p>
          <p className="mt-4">
            <NextLink
              href="/matches"
              className="text-sm font-semibold text-red hover:underline"
            >
              See the schedule →
            </NextLink>
          </p>
        </div>
      </div>
    );
  }

  // FR-3.1/3.5: a scheduled room is listed but not enterable by listeners — and
  // never 404s. A HOST of the room, however, gets the "Open waiting room"
  // control here (this is the only surface that flips scheduled -> waiting).
  if (room.state === "scheduled") {
    const { user: schedUser } = await getCurrentUserAndProfile();
    const schedService = createServiceClient();
    const viewerIsHost =
      !!schedUser && (await isRoomHost(schedService, schedUser.id, room.id));
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-line px-4 py-3">
          <NextLink href="/" aria-label={brand.name}>
            <Logo />
          </NextLink>
        </header>
        <div className="mx-auto max-w-md px-4 py-10 text-center">
          <h1 className="text-xl font-bold">
            {roomTitle(room)}
          </h1>
          {viewerIsHost ? (
            <>
              <p className="mt-2 text-sm text-secondary">
                You&apos;re hosting this room. Open the waiting room whenever
                you&apos;re ready and your listeners can start arriving.
              </p>
              {room.fixture_id != null && (
                <div className="mt-5 flex justify-center">
                  <OpenWaitingButton fixtureId={room.fixture_id} />
                </div>
              )}
              <div className="mt-6">
                <Countdown
                  targetIso={room.broadcast_start ?? room.scheduled_kickoff}
                  heading="Your show starts in"
                />
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-secondary">
                Doors aren&apos;t open yet. {room.commentator.username}{" "}
                hasn&apos;t opened the waiting room. Check back closer to
                kickoff.
              </p>
              <Countdown targetIso={room.scheduled_kickoff} heading="Kickoff in" />
            </>
          )}
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserAndProfile();

  // chat as COMPLETE threads (Phase 11): the N most recent roots + all their
  // replies, so reconnect/first-paint never split a thread across the cap
  const [messages, { data: links }, { data: clockEvents }] = await Promise.all([
    loadRoomThreadMessages(supabase, room.id),
    supabase
      .from("links")
      .select("*, author:profiles!links_user_id_fkey(username, role, avatar_url)")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<Link[]>(),
    supabase
      .from("clock_events")
      .select("action, server_ts, offset_seconds")
      .eq("room_id", room.id)
      .order("server_ts", { ascending: true }),
  ]);

  const myMessageVotes: Record<string, 1 | -1> = {};
  const myLinkVotes: Record<string, 1 | -1> = {};
  if (user) {
    const messageIds = messages.map((m) => m.id);
    const linkIds = (links ?? []).map((l) => l.id);
    const [{ data: mv }, { data: lv }] = await Promise.all([
      messageIds.length
        ? supabase
            .from("message_votes")
            .select("message_id, value")
            .eq("user_id", user.id)
            .in("message_id", messageIds)
        : Promise.resolve({ data: [] as { message_id: string; value: number }[] }),
      linkIds.length
        ? supabase
            .from("link_votes")
            .select("link_id, value")
            .eq("user_id", user.id)
            .in("link_id", linkIds)
        : Promise.resolve({ data: [] as { link_id: string; value: number }[] }),
    ]);
    mv?.forEach((v) => (myMessageVotes[v.message_id] = v.value as 1 | -1));
    lv?.forEach((v) => (myLinkVotes[v.link_id] = v.value as 1 | -1));
  }

  const service = createServiceClient();
  const admin = isAdmin(user?.id, profile);
  // a co-host gets the full moderator UI too (FR-25.2): gate on isRoomHost, not
  // the single creator
  const isRoomCommentator =
    !!user && (await isRoomHost(service, user.id, room.id));
  const isModerator = isRoomCommentator || admin;

  const viewer: Viewer =
    user && profile
      ? {
          userId: user.id,
          username: profile.username,
          avatarUrl: profile.avatar_url,
          role: profile.role,
          isModerator,
          isRoomCommentator,
        }
      : null;

  // commentator-only initial data (questions + pending talk requests)
  let initialQuestions: Question[] = [];
  let initialTalkRequests: TalkRequest[] = [];
  if (isModerator) {
    const [{ data: qs }, { data: trs }] = await Promise.all([
      service
        .from("questions")
        .select("*, author:profiles!questions_user_id_fkey(username, role, avatar_url)")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<Question[]>(),
      service
        .from("talk_requests")
        .select("*, author:profiles!talk_requests_user_id_fkey(username, role, avatar_url)")
        .eq("room_id", room.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .returns<TalkRequest[]>(),
    ]);
    initialQuestions = qs ?? [];
    initialTalkRequests = await Promise.all(
      (trs ?? []).map(async (tr) => ({
        ...tr,
        caller_flags: await callerFlagSummary(service, tr.user_id),
      })),
    );
  }

  // slider: public aggregate (service — individual rows are RLS-private),
  // own value + talk-consent state for the viewer
  const { data: sliderRows } = await service
    .from("slider_votes")
    .select("value")
    .eq("room_id", room.id);
  const sliderCount = sliderRows?.length ?? 0;
  const sliderAgg = {
    avg:
      sliderCount === 0
        ? 50
        : Math.round(sliderRows!.reduce((s, v) => s + v.value, 0) / sliderCount),
    count: sliderCount,
  };

  // score-predictor distribution (service — individual scorelines are private)
  const { data: predRows } = await service
    .from("predictions")
    .select("home_score, away_score")
    .eq("room_id", room.id);
  const predictionAgg = predictionAggregate(predRows ?? []);

  // the room's latest poll + live tallies (question/options are public)
  const activePoll = await loadActivePoll(service, room.id);

  // player-rating averages (service — individual ratings are private)
  const { data: ratingRows } = await service
    .from("player_ratings")
    .select("player_id, rating")
    .eq("room_id", room.id);
  const ratingsAgg = ratingsAggregate(ratingRows ?? []);

  let mySliderValue: number | null = null;
  let myPrediction: MyPrediction = null;
  let myPollVote: MyPollVote = null;
  let myRatings: MyRatings = {};
  let talkConsentGiven = false;
  let hasPendingTalk = false;
  if (user) {
    const [{ data: mySlider }, { data: myPred }, { data: anyConsent }, { data: pending }] =
      await Promise.all([
        supabase
          .from("slider_votes")
          .select("value")
          .eq("room_id", room.id)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("predictions")
          .select("home_score, away_score")
          .eq("room_id", room.id)
          .eq("user_id", user.id)
          .maybeSingle(),
        service
          .from("talk_requests")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
        service
          .from("talk_requests")
          .select("id")
          .eq("user_id", user.id)
          .eq("room_id", room.id)
          .eq("status", "pending")
          .maybeSingle(),
      ]);
    mySliderValue = mySlider?.value ?? null;
    myPrediction = myPred ? { home: myPred.home_score, away: myPred.away_score } : null;
    talkConsentGiven = anyConsent !== null;
    hasPendingTalk = pending !== null;
    if (activePoll) {
      const { data: pv } = await supabase
        .from("poll_votes")
        .select("option_idx")
        .eq("poll_id", activePoll.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (pv) myPollVote = { pollId: activePoll.id, optionIdx: pv.option_idx };
    }
    const { data: myRatingRows } = await supabase
      .from("player_ratings")
      .select("player_id, rating")
      .eq("room_id", room.id)
      .eq("user_id", user.id);
    for (const r of myRatingRows ?? []) myRatings[r.player_id] = r.rating;
  }

  // does this viewer already follow the commentator? (post-match follow prompt)
  let viewerFollowsCommentator = false;
  if (user && !isRoomCommentator) {
    const { data: f } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("commentator_id", room.commentator_id)
      .maybeSingle();
    viewerFollowsCommentator = f !== null;
  }

  // commentator's Info/Line-up corrections, merged onto Sportmonks data (public)
  const { data: ovRow } = await supabase
    .from("room_stat_overrides")
    .select("overrides")
    .eq("room_id", room.id)
    .maybeSingle<{ overrides: StatOverrides }>();
  const initialStatOverrides = ovRow?.overrides ?? null;

  // accepted hosts for both-badge display (FR-25.4), creator first
  const { data: hostRows } = await service
    .from("room_hosts")
    .select(
      "created_at, host:profiles!room_hosts_user_id_fkey(username, avatar_url)",
    )
    .eq("room_id", room.id)
    .eq("status", "accepted")
    .order("created_at", { ascending: true });
  const hosts = (hostRows ?? [])
    .map((r) => {
      const h = r.host as unknown as {
        username: string;
        avatar_url: string | null;
      } | null;
      return h ? { username: h.username, avatarUrl: h.avatar_url } : null;
    })
    .filter((h): h is { username: string; avatarUrl: string | null } => !!h);

  const roomInfo: RoomInfo = {
    id: room.id,
    state: room.state,
    scheduledKickoff: room.scheduled_kickoff,
    // fixture-derived fields are null-safe for discussion rooms (no fixture);
    // Part C hides the scoreboard/stats for them. statsFixtureId points the
    // stats panel at the room's own fixture (match) or its linked fixture
    // (discussion); 0 = "no stats" (useFixtureStats skips fixtureId <= 0).
    home: room.fixture?.home_team ?? "",
    away: room.fixture?.away_team ?? "",
    homeScore: room.fixture?.home_score ?? 0,
    awayScore: room.fixture?.away_score ?? 0,
    commentatorUsername: room.commentator.username,
    hosts:
      hosts.length > 0
        ? hosts
        : [{ username: room.commentator.username, avatarUrl: null }],
    commentatorId: room.commentator_id,
    competition: room.fixture?.competition ?? "",
    fixtureId: statsFixtureId(room) ?? 0,
    // an admin game with no Sportmonks match yet (or in an uncovered comp) has
    // no upstream data — the stats/info/history panels show "coming soon"
    comingSoon: room.fixture ? room.fixture.sportmonks_fixture_id == null : false,
  };

  return (
    <RealtimeRoom
      room={roomInfo}
      viewer={viewer}
      viewerFollowsCommentator={viewerFollowsCommentator}
      initialMessages={messages}
      initialLinks={links ?? []}
      myMessageVotes={myMessageVotes}
      myLinkVotes={myLinkVotes}
      initialQuestions={initialQuestions}
      initialTalkRequests={initialTalkRequests}
      sliderAgg={sliderAgg}
      mySliderValue={mySliderValue}
      predictionAgg={predictionAgg}
      myPrediction={myPrediction}
      activePoll={activePoll}
      myPollVote={myPollVote}
      ratingsAgg={ratingsAgg}
      myRatings={myRatings}
      talkConsentGiven={talkConsentGiven}
      hasPendingTalk={hasPendingTalk}
      initialStatOverrides={initialStatOverrides}
      initialBroadcastStart={room.broadcast_start}
      initialChatOpen={room.chat_open}
      initialLinksOpen={room.links_open}
      initialHlsUrl={room.hls_url}
      initialClockEvents={
        (clockEvents ?? []) as import("@/lib/clock").ClockEventInput[]
      }
    />
  );
}
