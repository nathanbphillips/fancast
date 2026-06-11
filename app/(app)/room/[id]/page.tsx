import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AudioBar } from "@/components/AudioBar";
import { MatchHeader } from "@/components/MatchHeader";
import { RealtimeRoom, type Viewer } from "@/components/room/RealtimeRoom";
import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type { ChatMessage, Fixture, Link, Room } from "@/lib/db/types";
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

  // the viewer's own votes, for arrow highlighting on first render
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

  const viewer: Viewer =
    user && profile
      ? {
          userId: user.id,
          username: profile.username,
          role: profile.role,
          isModerator:
            room.commentator_id === user.id || isAdmin(user.id, profile),
        }
      : null;

  const isLive = ["live_1h", "live_2h", "extra_time"].includes(room.state);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col lg:pb-[50px]">
      <MatchHeader
        home={room.fixture.home_team}
        away={room.fixture.away_team}
        homeScore={room.fixture.home_score ?? 0}
        awayScore={room.fixture.away_score ?? 0}
        state={room.state}
        clock={undefined /* event-sourced clock arrives in Phase 6 */}
      />

      <div className="border-b border-line bg-surface lg:hidden">
        <AudioBar commentator={room.commentator.username} live={isLive} />
      </div>

      <RealtimeRoom
        roomId={room.id}
        viewer={viewer}
        initialMessages={messages ?? []}
        initialLinks={links ?? []}
        myMessageVotes={myMessageVotes}
        myLinkVotes={myLinkVotes}
      />

      <div className="fixed inset-x-0 bottom-0 z-40 hidden h-[50px] border-t border-line bg-surface lg:block">
        <div className="mx-auto h-full max-w-7xl [&>div]:h-full [&>div]:py-0">
          <AudioBar commentator={room.commentator.username} live={isLive} />
        </div>
      </div>
    </div>
  );
}
