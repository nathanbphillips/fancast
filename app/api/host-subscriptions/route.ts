import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import {
  createSubscriptionRooms,
  type HostSubscription,
} from "@/lib/seasonHosting";

export const maxDuration = 60;

const schema = z.object({
  fixtureId: z.number().int(),
  teamId: z.number().int(),
});

/**
 * Season subscribe (FR-20.1): "Host all {team} games in {competition} this
 * season." Derives team + competition + season from a fixture the user is
 * looking at, creates the subscription, and immediately auto-creates rooms for
 * every matching future fixture. Returns one aggregate result (FR-20.7): the
 * caller shows a single "N rooms scheduled" confirmation.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (
    caller.profile.role !== "commentator" &&
    !isAdmin(caller.userId, caller.profile)
  ) {
    return NextResponse.json(
      { error: "Only commentators can host a season." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: fixture } = await service
    .from("fixtures")
    .select(
      "id, league_id, season, competition, home_team, away_team, home_team_id, away_team_id",
    )
    .eq("id", parsed.data.fixtureId)
    .maybeSingle();
  if (!fixture) {
    return NextResponse.json({ error: "Fixture not found." }, { status: 404 });
  }
  // the subscription scope must come from real, API-listed fixture data
  if (fixture.league_id == null || fixture.season == null) {
    return NextResponse.json(
      { error: "This competition can't be season-hosted yet." },
      { status: 400 },
    );
  }

  const isHome = fixture.home_team_id === parsed.data.teamId;
  const isAway = fixture.away_team_id === parsed.data.teamId;
  if (!isHome && !isAway) {
    return NextResponse.json(
      { error: "That team isn't in this fixture." },
      { status: 400 },
    );
  }
  const teamName = isHome ? fixture.home_team : fixture.away_team;

  // one active subscription per team+league+season (FR-20.3). Reactivate a
  // previously-deactivated one rather than colliding on the unique index.
  const { data: existing } = await service
    .from("host_team_subscriptions")
    .select("id, active")
    .eq("user_id", caller.userId)
    .eq("team_id", parsed.data.teamId)
    .eq("league_id", fixture.league_id)
    .eq("season", fixture.season)
    .maybeSingle();
  if (existing?.active) {
    return NextResponse.json(
      { error: `You already host all ${teamName} games this season.` },
      { status: 409 },
    );
  }

  let subscription: HostSubscription;
  if (existing) {
    const { data, error } = await service
      .from("host_team_subscriptions")
      .update({ active: true, deactivated_at: null })
      .eq("id", existing.id)
      .select("id, user_id, team_id, league_id, season, team_name, competition")
      .single<HostSubscription>();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    subscription = data;
  } else {
    const { data, error } = await service
      .from("host_team_subscriptions")
      .insert({
        user_id: caller.userId,
        team_id: parsed.data.teamId,
        league_id: fixture.league_id,
        season: fixture.season,
        team_name: teamName,
        competition: fixture.competition,
      })
      .select("id, user_id, team_id, league_id, season, team_name, competition")
      .single<HostSubscription>();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    subscription = data;
  }

  const result = await createSubscriptionRooms(
    service,
    subscription,
    caller.profile.username,
  );

  return NextResponse.json(
    {
      subscription: { id: subscription.id, teamName, competition: fixture.competition },
      roomsCreated: result.created,
      roomsSkipped: result.skipped,
    },
    { status: 201 },
  );
}
