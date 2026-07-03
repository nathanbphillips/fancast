import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

const schema = z.object({ userId: z.uuid() });

/**
 * Admin suspend (FR-18.2): revert a commentator to listener. Their SCHEDULED
 * rooms are removed (scheduled rooms hold no chat or content per FR-3.1, so
 * deletion is clean; PRD-02 introduces a proper `canceled` state and this
 * switches to it). Waiting/live/wrapped rooms are untouched. RSVP holders and
 * followers get a cancellation notification once FR-21 exists; until then the
 * cancellation is silent, and the suspension itself is never announced.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: target } = await service
    .from("profiles")
    .select("user_id, role")
    .eq("user_id", parsed.data.userId)
    .maybeSingle<{ user_id: string; role: string }>();
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (target.role !== "commentator") {
    return NextResponse.json(
      { error: "That account isn't a commentator." },
      { status: 409 },
    );
  }

  const { error: roleErr } = await service
    .from("profiles")
    .update({ role: "listener" })
    .eq("user_id", target.user_id);
  if (roleErr) {
    return NextResponse.json({ error: roleErr.message }, { status: 500 });
  }

  // remove their not-yet-opened rooms (scheduled only; see doc comment)
  const { data: removed, error: roomErr } = await service
    .from("rooms")
    .delete()
    .eq("commentator_id", target.user_id)
    .eq("state", "scheduled")
    .select("id");
  if (roomErr) {
    return NextResponse.json({ error: roomErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, roomsCanceled: removed?.length ?? 0 });
}
