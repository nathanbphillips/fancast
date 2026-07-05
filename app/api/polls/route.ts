import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { loadActivePoll } from "@/lib/polls";
import { isAdmin } from "@/lib/roles";
import { isRoomHost } from "@/lib/roomHosts";
import type { RoomState } from "@/lib/db/types";

// the commentator can pose a poll any time the broadcast is live (FR-12.2 frames
// it as a halftime poll, but it's commentator-driven, not state-locked)
const OPEN_STATES: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    roomId: z.uuid(),
    question: z.string().trim().min(1).max(140),
    options: z.array(z.string().trim().min(1).max(60)).min(2).max(4),
  }),
  z.object({ action: z.literal("close"), pollId: z.uuid() }),
  z.object({
    action: z.literal("vote"),
    pollId: z.uuid(),
    optionIdx: z.number().int().min(0).max(3),
  }),
]);

/** Poll lifecycle (FR-12.2): commentator create/close; listener vote. Same
 *  write model as the slider — validate → service write → recompute → publish
 *  the full PollState on the control channel. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const body = parsed.data;
  const service = createServiceClient();

  if (body.action === "create") {
    const { data: room } = await service
      .from("rooms")
      .select("id, state, commentator_id")
      .eq("id", body.roomId)
      .maybeSingle();
    if (!room) {
      return NextResponse.json({ error: "Room not found." }, { status: 404 });
    }
    if (!(await isRoomHost(service, caller.userId, room.id)) && !isAdmin(caller.userId, caller.profile)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    if (!OPEN_STATES.includes(room.state as RoomState)) {
      return NextResponse.json(
        { error: "Open a poll once the broadcast has started." },
        { status: 403 },
      );
    }
    // only one active poll per room — retire any still-open one first
    await service
      .from("polls")
      .update({ status: "closed" })
      .eq("room_id", room.id)
      .eq("status", "open");
    const { error } = await service.from("polls").insert({
      room_id: room.id,
      question: body.question,
      options: body.options,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const poll = await loadActivePoll(service, room.id);
    await publish(channels.control(room.id), "poll", poll);
    return NextResponse.json(poll);
  }

  if (body.action === "close") {
    const { data: poll } = await service
      .from("polls")
      .select("id, room_id")
      .eq("id", body.pollId)
      .maybeSingle<{ id: string; room_id: string }>();
    if (!poll) {
      return NextResponse.json({ error: "Poll not found." }, { status: 404 });
    }
    if (!(await isRoomHost(service, caller.userId, poll.room_id)) && !isAdmin(caller.userId, caller.profile)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    await service.from("polls").update({ status: "closed" }).eq("id", poll.id);
    const next = await loadActivePoll(service, poll.room_id);
    await publish(channels.control(poll.room_id), "poll", next);
    return NextResponse.json(next);
  }

  // action === "vote"
  const { data: poll } = await service
    .from("polls")
    .select("id, room_id, status, options")
    .eq("id", body.pollId)
    .maybeSingle<{ id: string; room_id: string; status: string; options: string[] }>();
  if (!poll) {
    return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  }
  if (poll.status !== "open") {
    return NextResponse.json({ error: "This poll is closed." }, { status: 403 });
  }
  if (body.optionIdx >= poll.options.length) {
    return NextResponse.json({ error: "No such option." }, { status: 400 });
  }
  const { error } = await service.from("poll_votes").upsert({
    poll_id: poll.id,
    user_id: caller.userId,
    option_idx: body.optionIdx,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const next = await loadActivePoll(service, poll.room_id);
  await publish(channels.control(poll.room_id), "poll", next);
  return NextResponse.json(next);
}
