import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import type { Question, RoomState } from "@/lib/db/types";
import { isAdmin } from "@/lib/roles";
import { isRoomHost } from "@/lib/roomHosts";

const OPEN_STATES: RoomState[] = [
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

const submitSchema = z.object({
  roomId: z.uuid(),
  body: z.string().trim().min(1).max(280),
});

const updateSchema = z.object({
  questionId: z.uuid(),
  status: z.enum(["acknowledged", "dismissed"]),
});

/** Ask a question (FR-10.1) — private to author + commentator. */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = submitSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid question." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: room } = await service
    .from("rooms")
    .select("id, state")
    .eq("id", parsed.data.roomId)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (!OPEN_STATES.includes(room.state as RoomState)) {
    return NextResponse.json(
      { error: "Questions open when the broadcast starts." },
      { status: 403 },
    );
  }

  const { data: question, error } = await service
    .from("questions")
    .insert({
      room_id: room.id,
      user_id: caller.userId,
      body: parsed.data.body,
    })
    .select("*, author:profiles!questions_user_id_fkey(username, role, avatar_url)")
    .single<Question>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await publish(`room:${room.id}:private`, "question", question);
  return NextResponse.json({ question }, { status: 201 });
}

/** Acknowledge/dismiss (commentator or admin). */
export async function PATCH(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: question } = await service
    .from("questions")
    .select("id, room_id, room:rooms!questions_room_id_fkey(commentator_id)")
    .eq("id", parsed.data.questionId)
    .maybeSingle<{
      id: string;
      room_id: string;
      room: { commentator_id: string };
    }>();
  if (!question) {
    return NextResponse.json({ error: "Question not found." }, { status: 404 });
  }
  if (
    !(await isRoomHost(service, caller.userId, question.room_id)) &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { error } = await service
    .from("questions")
    .update({ status: parsed.data.status })
    .eq("id", question.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await publish(`room:${question.room_id}:private`, "question_update", {
    questionId: question.id,
    status: parsed.data.status,
  });
  return NextResponse.json({ ok: true });
}
