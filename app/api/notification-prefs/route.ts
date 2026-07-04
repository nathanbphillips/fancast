import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { channelDefault, isNotificationType } from "@/lib/notify/types";

/**
 * Update a notification preference (FR-21.5). One type + one channel toggle per
 * call; the other channel keeps its stored/default value. An absent row means
 * the registry default, so this upserts the deviation.
 */
const schema = z.object({
  type: z.string().refine(isNotificationType, "Unknown type"),
  channel: z.enum(["email", "push"]),
  enabled: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const type = parsed.data.type;
  if (!isNotificationType(type)) {
    return NextResponse.json({ error: "Unknown type." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("notification_prefs")
    .select("email_enabled, push_enabled")
    .eq("user_id", caller.userId)
    .eq("type", type)
    .maybeSingle();

  const email =
    parsed.data.channel === "email"
      ? parsed.data.enabled
      : existing
        ? (existing.email_enabled as boolean)
        : channelDefault(type, "email");
  const push =
    parsed.data.channel === "push"
      ? parsed.data.enabled
      : existing
        ? (existing.push_enabled as boolean)
        : channelDefault(type, "push");

  const { error } = await service.from("notification_prefs").upsert(
    {
      user_id: caller.userId,
      type,
      email_enabled: email,
      push_enabled: push,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,type" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, email_enabled: email, push_enabled: push });
}
