import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  RealtimeRoom,
  type RoomInfo,
  type Viewer,
} from "@/components/room/RealtimeRoom";
import { Countdown } from "@/components/room/Countdown";
import {
  createServiceClient,
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type {
  ChatMessage,
  Fixture,
  Link,
  Question,
  Room,
  TalkRequest,
} from "@/lib/db/types";
import { isAdmin } from "@/lib/roles";

type RoomWithJoins = Room & {
  fixture: Fixture;
  commentator: { username: string };
};

async function loadRoom(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("rooms")
    .select(
      "*, fixture:fixtures(*), commentator:profiles!rooms_commentator_id_fkey(username)",
    )
    .eq("id", id)
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
  return {
    title: `${room.fixture.home_team} vs ${room.fixture.away_team}`,
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

  // FR-3.1/3.5: a scheduled room is listed but not enterable — and never 404s
  if (room.state === "scheduled") {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-xl font-bold">
          {room.fixture.home_team} vs {room.fixture.away_team}
        </h1>
        <p className="mt-2 text-sm text-secondary">
          Doors aren&apos;t open yet — {room.commentator.username} hasn&apos;t
          opened the waiting room. Check back closer to kickoff.
        </p>
        <Countdown targetIso={room.scheduled_kickoff} heading="Kickoff in" />
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserAndProfile();

  const [{ data: messages }, { data: links }] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("*, author:profiles!chat_messages_user_id_fkey(username, role)")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(200)
      .returns<ChatMessage[]>(),
    supabase
      .from("links")
      .select("*, author:profiles!links_user_id_fkey(username, role)")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<Link[]>(),
  ]);

  const myMessageVotes: Record<string, 1 | -1> = {};
  const myLinkVotes: Record<string, 1 | -1> = {};
  if (user) {
    const messageIds = (messages ?? []).map((m) => m.id);
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

  const admin = isAdmin(user?.id, profile);
  const isRoomCommentator = user?.id === room.commentator_id;
  const isModerator = isRoomCommentator || admin;

  const viewer: Viewer =
    user && profile
      ? {
          userId: user.id,
          username: profile.username,
          role: profile.role,
          isModerator,
          isRoomCommentator,
        }
      : null;

  // commentator-only initial data (questions + pending talk requests)
  const service = createServiceClient();
  let initialQuestions: Question[] = [];
  let initialTalkRequests: TalkRequest[] = [];
  if (isModerator) {
    const [{ data: qs }, { data: trs }] = await Promise.all([
      service
        .from("questions")
        .select("*, author:profiles!questions_user_id_fkey(username, role)")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<Question[]>(),
      service
        .from("talk_requests")
        .select("*, author:profiles!talk_requests_user_id_fkey(username, role)")
        .eq("room_id", room.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .returns<TalkRequest[]>(),
    ]);
    initialQuestions = qs ?? [];
    initialTalkRequests = trs ?? [];
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

  let mySliderValue: number | null = null;
  let talkConsentGiven = false;
  let hasPendingTalk = false;
  if (user) {
    const [{ data: mySlider }, { data: anyConsent }, { data: pending }] =
      await Promise.all([
        supabase
          .from("slider_votes")
          .select("value")
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
    talkConsentGiven = anyConsent !== null;
    hasPendingTalk = pending !== null;
  }

  const roomInfo: RoomInfo = {
    id: room.id,
    state: room.state,
    scheduledKickoff: room.scheduled_kickoff,
    home: room.fixture.home_team,
    away: room.fixture.away_team,
    homeScore: room.fixture.home_score ?? 0,
    awayScore: room.fixture.away_score ?? 0,
    commentatorUsername: room.commentator.username,
    commentatorId: room.commentator_id,
  };

  return (
    <RealtimeRoom
      room={roomInfo}
      viewer={viewer}
      initialMessages={messages ?? []}
      initialLinks={links ?? []}
      myMessageVotes={myMessageVotes}
      myLinkVotes={myLinkVotes}
      initialQuestions={initialQuestions}
      initialTalkRequests={initialTalkRequests}
      sliderAgg={sliderAgg}
      mySliderValue={mySliderValue}
      talkConsentGiven={talkConsentGiven}
      hasPendingTalk={hasPendingTalk}
      initialBroadcastStart={room.broadcast_start}
      initialChatOpen={room.chat_open}
      initialLinksOpen={room.links_open}
    />
  );
}
