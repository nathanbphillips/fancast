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

  // fixtures this commentator already has a live/scheduled room on: skip, never
  // duplicate (FR-20.1). A canceled room does not count, so a fixture the host
  // previously dropped can be re-hosted by the subscription.
  const fixtureIds = fixtures.map((f) => f.id);
  const { data: existing } = await service
    .from("rooms")
    .select("fixture_id, state")
    .eq("commentator_id", subscription.user_id)
    .in("fixture_id", fixtureIds);
  const alreadyHosted = new Set(
    (existing ?? [])
      .filter((r) => r.state !== "canceled")
      .map((r) => r.fixture_id as number),
  );

  let created = 0;
  let skipped = 0;
  for (const f of fixtures) {
    if (alreadyHosted.has(f.id)) {
      skipped++;
      continue;
    }
    const broadcastStart = new Date(
      new Date(f.kickoff_utc).getTime() - DEFAULT_LEAD_MS,
    ).toISOString();
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
