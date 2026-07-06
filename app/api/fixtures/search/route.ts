import { NextResponse, type NextRequest } from "next/server";
import { requireParticipant } from "@/lib/api";
import { isAdmin } from "@/lib/roles";
import { rateLimit } from "@/lib/ratelimit";
import { searchUpcomingFixtures } from "@/lib/fixtureSearch";

/**
 * Fixture suggest for the custom-room create flow (founder 2026-07-06):
 * commentators type a matchup and get upcoming games from the data feed's
 * covered competitions. Commentator-gated (it exists only for /host/new) and
 * rate-limited: every miss is a metered Sportmonks call (60s result cache in
 * lib/fixtureSearch.ts). Failures degrade to an empty list, never an error the
 * form has to handle: no suggestions simply means "create it unlinked".
 */
export async function GET(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (
    caller.profile.role !== "commentator" &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json({ error: "Commentators only." }, { status: 403 });
  }

  // tighter than a typical write limit: each miss fans out to metered
  // Sportmonks calls against a shared plan (review 2026-07-06)
  if (!rateLimit(`fxsearch:${caller.userId}`, 12, 60_000)) {
    return NextResponse.json({ results: [] }, { status: 200 });
  }

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3 || q.length > 60) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchUpcomingFixtures(q);
    return NextResponse.json({ results });
  } catch {
    // feed hiccup or missing token: the form just shows no suggestions
    return NextResponse.json({ results: [] });
  }
}
