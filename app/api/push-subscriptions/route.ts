import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";

/**
 * Web push device registration (FR-21.1). POST saves/refreshes the browser's
 * push subscription for the signed-in user; DELETE revokes it. Endpoints are
 * unique, so a device that re-subscribes updates its keys in place.
 */

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(500), auth: z.string().max(500) }),
});

export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = subSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service.from("push_subscriptions").upsert(
    {
      user_id: caller.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const endpoint = z
    .string()
    .url()
    .safeParse(request.nextUrl.searchParams.get("endpoint"));
  if (!endpoint.success) {
    return NextResponse.json({ error: "Invalid endpoint." }, { status: 400 });
  }

  const service = createServiceClient();
  await service
    .from("push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("endpoint", endpoint.data)
    .eq("user_id", caller.userId);
  return NextResponse.json({ ok: true });
}
