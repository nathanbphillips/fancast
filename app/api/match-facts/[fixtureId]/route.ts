import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { emptyFacts, getMatchFacts } from "@/lib/matchFacts";
import { rateLimit } from "@/lib/ratelimit";
import { isAdmin } from "@/lib/roles";

export const maxDuration = 30;

/**
 * Match Facts for a fixture, by our LOCAL fixtures PK (same contract as
 * /api/stats/[fixtureId], which takes the local id and translates to the
 * Sportmonks one internally — conflating the two is an easy and silent bug).
 *
 * Unlike /api/stats this is NOT public. Two reasons: it is a paid add-on with a
 * metered quota, and it exists to give the host talking points rather than to
 * render anything a listener sees. Commentators and admins only.
 *
 * Allowlist: only fixtures already in our synced table reach Sportmonks, so an
 * id-enumeration can't amplify calls against the plan.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  const role = caller.profile.role;
  if (role !== "commentator" && role !== "admin" && !isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Hosts only." }, { status: 403 });
  }
  // The commentator role is SELF-SERVE (POST /api/commentator/upgrade), so the
  // gate above keeps this off the public internet but does not make the caller
  // trusted. This is a metered add-on, so cap it: generous for a host working
  // through a matchday, useless for anyone trying to drain the plan.
  if (!rateLimit(`matchfacts:${caller.userId}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 },
    );
  }

  const { fixtureId } = await params;
  const parsed = z.coerce.number().int().safeParse(fixtureId);
  const id = parsed.success ? parsed.data : 0;
  if (!parsed.success || id <= 0) {
    return NextResponse.json(emptyFacts(id, "unknown_fixture"), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const service = createServiceClient();
  const { data: known } = await service
    .from("fixtures")
    .select("id, sportmonks_fixture_id")
    .eq("id", id)
    .maybeSingle<{ id: number; sportmonks_fixture_id: number | null }>();
  // These two are NOT the same and must not read the same. An unknown fixture
  // is a bad id; a known fixture with no sportmonks_fixture_id will NEVER have
  // facts until somebody links it, and telling that host "they usually appear
  // closer to kickoff" is the same silent lie the Betis stats trap told.
  if (!known) {
    return NextResponse.json(emptyFacts(id, "unknown_fixture"), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (known.sportmonks_fixture_id == null) {
    return NextResponse.json(emptyFacts(id, "no_link"), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const facts = await getMatchFacts(known.sportmonks_fixture_id);
    return NextResponse.json(facts, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // talking points are non-critical: fail soft so the tab says "couldn't
    // load" rather than breaking the room
    return NextResponse.json({ error: (err as Error).message }, { status: 503 });
  }
}
