import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { areBlockedEitherWay } from "@/lib/friends";
import { flushRows } from "@/lib/notify/outbox";
import { enqueueFriendRequest } from "@/lib/notify/producers";

const schema = z.object({ userId: z.uuid() });
const DAILY_LIMIT = 20;

/**
 * Send a friend request (FR-23.1/23.3). Double opt-in: creates a pending
 * friendship. Silent no-ops (to preserve invisibility / silent decline) when
 * either user has blocked the other, or the requester was previously declined
 * by this addressee. Rate-limited to 20 requests per day.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const target = parsed.data.userId;
  if (target === caller.userId) {
    return NextResponse.json({ error: "That's you." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: exists } = await service
    .from("profiles")
    .select("user_id, username")
    .eq("user_id", target)
    .maybeSingle();
  if (!exists) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // rate limit: 20 requests per rolling day (DB-counted, instance-independent)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .eq("requester_id", caller.userId)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: "You've hit the daily friend-request limit. Try again tomorrow." },
      { status: 429 },
    );
  }

  // block invisibility (FR-23.4) + no-re-request-after-decline (FR-23.1): both
  // appear to succeed but create nothing, so neither state leaks
  if (await areBlockedEitherWay(service, caller.userId, target)) {
    return NextResponse.json({ ok: true, state: "requested" });
  }
  const { data: pair } = await service
    .from("friendships")
    .select("requester_id, addressee_id, status")
    .or(
      `and(requester_id.eq.${caller.userId},addressee_id.eq.${target}),and(requester_id.eq.${target},addressee_id.eq.${caller.userId})`,
    );
  const rows = pair ?? [];
  if (rows.some((r) => r.status === "accepted")) {
    return NextResponse.json({ ok: true, state: "friends" });
  }
  // already pending in some direction, or the caller was declined before: no-op
  if (
    rows.some(
      (r) =>
        r.status === "pending" ||
        (r.status === "declined" && r.requester_id === caller.userId),
    )
  ) {
    return NextResponse.json({ ok: true, state: "requested" });
  }

  const { error } = await service.from("friendships").insert({
    requester_id: caller.userId,
    addressee_id: target,
    status: "pending",
  });
  if (error) {
    // lost a race to a concurrent request/accept; treat as already-requested
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, state: "requested" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  after(async () => {
    const svc = createServiceClient();
    const ids = await enqueueFriendRequest(svc, {
      addresseeId: target,
      requesterId: caller.userId,
      requesterName: caller.profile.username,
    });
    await flushRows(svc, ids);
  });

  return NextResponse.json({ ok: true, state: "requested" }, { status: 201 });
}
