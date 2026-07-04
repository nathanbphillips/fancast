import type { SupabaseClient } from "@supabase/supabase-js";
import { insertRoomWithHost } from "@/lib/createRoom";

/**
 * Season hosting (FR-20): a subscription is one team in one competition for
 * the current season. Subscribing (and each later sync, FR-20.2) auto-creates
 * a scheduled room for every matching FUTURE fixture the commentator does not
 * already host. Default broadcast start (kickoff minus 15 min), no blurb.
 *
 * Notification batching (FR-20.7): this returns aggregate counts so callers
 * emit exactly one confirmation/summary; it never fires per-room notifications.
 */

export type HostSubscription = {
  id: string;
  user_id: string;
  team_id: number;
  league_id: number;
  season: number;
  team_name: string;
  competition: string;
};

/** A future fixture in this team+league+season the subscription should cover. */
type MatchFixture = {
  id: number;
  home_team: string;
  away_team: string;
  home_team_id: number | null;
  away_team_id: number | null;
  kickoff_utc: string;
};

const DEFAULT_LEAD_MS = 15 * 60 * 1000;

/**
 * Create rooms for every future fixture matching the subscription that the
 * user does not already host. Idempotent: re-runnable each sync (FR-20.2),
 * skipping already-hosted fixtures. Returns how many rooms were created.
 */
export async function createSubscriptionRooms(
  service: SupabaseClient,
  subscription: HostSubscription,
  creatorUsername: string,
): Promise<{ created: number; skipped: number; error: string | null }> {
  const nowIso = new Date().toISOString();

  const { data: fixtures, error: fxErr } = await service
    .from("fixtures")
    .select("id, home_team, away_team, home_team_id, away_team_id, kickoff_utc")
    .eq("league_id", subscription.league_id)
    .eq("season", subscription.season)
    .gt("kickoff_utc", nowIso)
    .or(
      `home_team_id.eq.${subscription.team_id},away_team_id.eq.${subscription.team_id}`,
    )
    .order("kickoff_utc", { ascending: true })
    .returns<MatchFixture[]>();
  if (fxErr) return { created: 0, skipped: 0, error: fxErr.message };
  if (!fixtures || fixtures.length === 0) {
    return { created: 0, skipped: 0, error: null };
  }

  const fixtureIds = fixtures.map((f) => f.id);

  // Fixtures already COVERED by a non-canceled room this user hosts (their own
  // OR one they co-host): skip, never duplicate (FR-20.1). Membership is read
  // from room_hosts, not commentator_id, per the epic host-check rule.
  const { data: coveredRows } = await service
    .from("rooms")
    .select("fixture_id, room_hosts!inner(user_id, status)")
    .in("fixture_id", fixtureIds)
    .neq("state", "canceled")
    .eq("room_hosts.user_id", subscription.user_id)
    .eq("room_hosts.status", "accepted");
  const covered = new Set(
    (coveredRows ?? []).map((r) => r.fixture_id as number),
  );

  // This user's OWN rooms (any state) on these fixtures: the collision domain
  // for unique(fixture_id, commentator_id). A canceled own room must be
  // REVIVED, not re-inserted, or the insert collides and the fixture is
  // silently dropped forever (adversarial review 2026-07-03).
  const { data: ownRooms } = await service
    .from("rooms")
    .select("id, fixture_id, state")
    .eq("commentator_id", subscription.user_id)
    .in("fixture_id", fixtureIds);
  const ownByFixture = new Map<number, { id: string; state: string }>();
  for (const r of ownRooms ?? []) {
    ownByFixture.set(r.fixture_id as number, {
      id: r.id as string,
      state: r.state as string,
    });
  }

  let created = 0;
  let skipped = 0;
  for (const f of fixtures) {
    if (covered.has(f.id)) {
      skipped++;
      continue;
    }
    const broadcastStart = new Date(
      new Date(f.kickoff_utc).getTime() - DEFAULT_LEAD_MS,
    ).toISOString();

    const own = ownByFixture.get(f.id);
    if (own) {
      // an own room exists but isn't covered, so it's canceled: revive it in
      // place (the unique constraint forbids a fresh insert)
      const { error } = await service
        .from("rooms")
        .update({
          state: "scheduled",
          subscription_id: subscription.id,
          broadcast_start: broadcastStart,
          blurb: null,
          postponed: false,
        })
        .eq("id", own.id);
      if (error) {
        console.error("subscription room revive failed for fixture", f.id, error);
        skipped++;
        continue;
      }
      // the accepted host row survives a cancel, but assert it defensively
      await service.from("room_hosts").upsert(
        {
          room_id: own.id,
          user_id: subscription.user_id,
          status: "accepted",
          responded_at: new Date().toISOString(),
        },
        { onConflict: "room_id,user_id" },
      );
      created++;
      continue;
    }

    const { error } = await insertRoomWithHost(service, {
      fixtureId: f.id,
      creatorId: subscription.user_id,
      creatorUsername,
      homeTeam: f.home_team,
      awayTeam: f.away_team,
      kickoffUtc: f.kickoff_utc,
      state: "scheduled",
      broadcastStart,
      subscriptionId: subscription.id,
    });
    if (error) {
      // one bad row shouldn't abort the whole season; log and continue
      console.error("subscription room create failed for fixture", f.id, error);
      skipped++;
      continue;
    }
    created++;
  }

  return { created, skipped, error: null };
}

/**
 * Sync hook (FR-20.2): for every active subscription, create rooms for newly
 * appearing matching fixtures. Runs from the daily cron after the fixture sync.
 * Returns per-subscription creation counts for the cron log.
 */
export async function autoCreateSubscriptionRooms(
  service: SupabaseClient,
): Promise<{ ok: true; totalCreated: number; subscriptions: number }> {
  const { data: subs } = await service
    .from("host_team_subscriptions")
    .select("id, user_id, team_id, league_id, season, team_name, competition")
    .eq("active", true)
    .returns<HostSubscription[]>();
  if (!subs || subs.length === 0) {
    return { ok: true, totalCreated: 0, subscriptions: 0 };
  }

  // resolve usernames once (slug generation needs them)
  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const { data: profiles } = await service
    .from("profiles")
    .select("user_id, username")
    .in("user_id", userIds);
  const usernameById = new Map(
    (profiles ?? []).map((p) => [p.user_id as string, p.username as string]),
  );

  let totalCreated = 0;
  for (const sub of subs) {
    const username = usernameById.get(sub.user_id);
    if (!username) continue;
    const { created } = await createSubscriptionRooms(service, sub, username);
    totalCreated += created;
  }

  return { ok: true, totalCreated, subscriptions: subs.length };
}
