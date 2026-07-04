import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";

/**
 * Unfriend (FR-23.2): either side, instant, silent (no notification). Removes
 * the accepted friendship for the pair. A pending request the caller SENT is
 * also withdrawn here (cancel my own request); an incoming pending request is
 * left alone (use respond/decline for that).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) {
    return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  }

  const service = createServiceClient();
  // remove the accepted friendship (either direction) and any pending request
  // the caller themselves sent
  await service
    .from("friendships")
    .delete()
    .eq("status", "accepted")
    .or(
      `and(requester_id.eq.${caller.userId},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${caller.userId})`,
    );
  await service
    .from("friendships")
    .delete()
    .eq("status", "pending")
    .eq("requester_id", caller.userId)
    .eq("addressee_id", userId);

  return NextResponse.json({ ok: true, state: "none" });
}
