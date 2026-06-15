import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { channels, publish } from "@/lib/ably";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";

const bodySchema = z.object({ messageId: z.uuid() });

const HIDE_THRESHOLD = 3.0;
const FLAG_BUDGET_PER_MATCH = 10;
const ESTABLISHED_AFTER_MS = 48 * 60 * 60 * 1000;

/**
 * Flag-to-hide (FR-8.3), separate from votes. Weight by standing:
 * accounts under 48h old (or restricted) flag at 0.5, established at 1.0.
 * Total weight >= 3.0 hides pending review. Budget: 10 flags per user per
 * match. Every hide is logged via hidden_by/hidden_at + the flag rows.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid flag." }, { status: 400 });
  }
  const { messageId } = parsed.data;

  const service = createServiceClient();
  const { data: message } = await service
    .from("chat_messages")
    .select("id, room_id, user_id, hidden_by")
    .eq("id", messageId)
    .maybeSingle();
  if (!message) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  if (message.user_id === caller.userId) {
    return NextResponse.json(
      { error: "You can't flag your own message." },
      { status: 400 },
    );
  }

  // flag budget: count this user's flags on this room's messages. Use an
  // inner-join embed so the count is computed server-side over the full join;
  // the old id-list round-trip was silently truncated to PostgREST's 1000-row
  // default in a long match, under-counting the budget (M-8, audit).
  const { count: used, error: budgetErr } = await service
    .from("message_flags")
    .select("*, chat_messages!inner(room_id)", { count: "exact", head: true })
    .eq("user_id", caller.userId)
    .eq("chat_messages.room_id", message.room_id);
  if (budgetErr) {
    return NextResponse.json({ error: budgetErr.message }, { status: 500 });
  }
  if ((used ?? 0) >= FLAG_BUDGET_PER_MATCH) {
    return NextResponse.json(
      { error: "You've used all your flags for this match." },
      { status: 429 },
    );
  }

  const accountAge =
    Date.now() - new Date(caller.profile.created_at).getTime();
  const weight =
    caller.profile.standing === "good" && accountAge >= ESTABLISHED_AFTER_MS
      ? 1.0
      : 0.5;

  const { error } = await service.from("message_flags").insert({
    message_id: messageId,
    user_id: caller.userId,
    weight,
  });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You already flagged this message." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: flags } = await service
    .from("message_flags")
    .select("weight")
    .eq("message_id", messageId);
  const totalWeight = (flags ?? []).reduce((s, f) => s + Number(f.weight), 0);

  const crossedThreshold =
    totalWeight >= HIDE_THRESHOLD && message.hidden_by === null;

  await service
    .from("chat_messages")
    .update({
      flag_weight: totalWeight,
      ...(crossedThreshold
        ? { hidden_by: "flags", hidden_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", messageId);

  if (crossedThreshold) {
    await publish(channels.chat(message.room_id), "hide", {
      messageId,
      hiddenBy: "flags",
    });
  }

  return NextResponse.json({ flagged: true, hidden: crossedThreshold });
}
