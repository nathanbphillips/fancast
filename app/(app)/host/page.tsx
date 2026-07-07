import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getCurrentUserAndProfile,
} from "@/lib/db/server";
import type { RoomState } from "@/lib/db/types";
import {
  HostRoomsDashboard,
  type DashboardRoom,
  type DashboardSubscription,
} from "@/components/host/HostRoomsDashboard";
import {
  CohostInvites,
  type CohostInvite,
} from "@/components/host/CohostInvites";
import { Button } from "@/components/ui/Button";
import { HostLanding } from "@/components/marketing/HostLanding";

export const metadata: Metadata = { title: "Host a room" };

/**
 * /host is role-aware (front-end review item 12): commentators get the "My
 * rooms" dashboard (FR-20.4); everyone else (signed-out or listener) gets the
 * HostLanding marketing pitch instead of being redirected away, so every "host
 * a room" CTA across the site has one real destination.
 *
 * Dashboard: upcoming hosted rooms grouped by month with subscription
 * provenance + collision warnings + bulk cancel, plus active subscriptions.
 */

const UPCOMING_STATES: RoomState[] = [
  "scheduled",
  "waiting",
  "pregame",
  "live_1h",
  "halftime",
  "live_2h",
  "extra_time",
  "postgame",
];

type HostedRoom = {
  room: {
    id: string;
    slug: string | null;
    state: RoomState;
    scheduled_kickoff: string;
    blurb: string | null;
    postponed: boolean;
    subscription_id: string | null;
    fixture: { home_team: string; away_team: string; competition: string | null };
  };
};

export default async function HostDashboardPage() {
  const { user, profile } = await getCurrentUserAndProfile();
  // Non-commentators get the marketing pitch (not a redirect). Signed-out visitors
  // are sent through sign-in back to the upgrade flow; listeners go straight to it.
  if (!user) {
    return (
      <HostLanding
        ctaHref="/signin?next=%2Fsettings"
        ctaLabel="Sign in to host"
        note="New here? Signing in and upgrading to a commentator takes about a minute."
      />
    );
  }
  if (!profile) redirect("/welcome");
  if (profile.role === "listener") {
    return (
      <HostLanding
        ctaHref="/settings"
        ctaLabel="Become a commentator"
        note="You are signed in. Upgrade from settings and you can host today."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: hostRows }, { data: subs }] = await Promise.all([
    supabase
      .from("room_hosts")
      .select(
        "room:rooms(id, slug, state, scheduled_kickoff, blurb, postponed, subscription_id, fixture:fixtures(home_team, away_team, competition))",
      )
      .eq("user_id", user.id)
      .eq("status", "accepted"),
    supabase
      .from("host_team_subscriptions")
      .select("id, team_name, competition")
      .eq("user_id", user.id)
      .eq("active", true)
      .order("created_at", { ascending: true }),
  ]);

  const hostedRooms = ((hostRows ?? []) as unknown as HostedRoom[]).filter(
    (h) => h.room && UPCOMING_STATES.includes(h.room.state),
  );
  const roomIds = hostedRooms.map((h) => h.room.id);

  // accepted hosts of these rooms (for co-host chips) + pending invites TO the
  // caller (FR-25.1/25.4)
  const [{ data: allHosts }, { data: myInvites }] = await Promise.all([
    roomIds.length
      ? supabase
          .from("room_hosts")
          .select(
            "room_id, status, host:profiles!room_hosts_user_id_fkey(user_id, username)",
          )
          .in("room_id", roomIds)
          .eq("status", "accepted")
      : Promise.resolve({ data: [] as unknown[] }),
    supabase
      .from("room_hosts")
      .select(
        "room_id, inviter:profiles!room_hosts_invited_by_fkey(username), room:rooms(state, fixture:fixtures(home_team, away_team))",
      )
      .eq("user_id", user.id)
      .eq("status", "invited"),
  ]);

  const coHostsByRoom = new Map<string, string[]>();
  for (const h of (allHosts ?? []) as unknown as {
    room_id: string;
    host: { user_id: string; username: string } | null;
  }[]) {
    if (!h.host || h.host.user_id === user.id) continue;
    const list = coHostsByRoom.get(h.room_id) ?? [];
    list.push(h.host.username);
    coHostsByRoom.set(h.room_id, list);
  }

  const rooms: DashboardRoom[] = hostedRooms
    .map((h) => {
      const coHosts = coHostsByRoom.get(h.room.id) ?? [];
      const invitable = h.room.state === "scheduled" || h.room.state === "waiting";
      return {
        id: h.room.id,
        slug: h.room.slug,
        state: h.room.state,
        scheduled_kickoff: h.room.scheduled_kickoff,
        blurb: h.room.blurb,
        postponed: h.room.postponed,
        subscription_id: h.room.subscription_id,
        home_team: h.room.fixture.home_team,
        away_team: h.room.fixture.away_team,
        competition: h.room.fixture.competition,
        coHosts,
        canInvite: invitable && coHosts.length < 1, // cap 2 hosts total
      };
    })
    .sort((a, b) => a.scheduled_kickoff.localeCompare(b.scheduled_kickoff));

  const invites: CohostInvite[] = (
    (myInvites ?? []) as unknown as {
      room_id: string;
      inviter: { username: string } | null;
      room: {
        state: string;
        fixture: { home_team: string; away_team: string } | null;
      } | null;
    }[]
  )
    .filter((i) => i.room && (i.room.state === "scheduled" || i.room.state === "waiting"))
    .map((i) => ({
      roomId: i.room_id,
      matchLabel: i.room?.fixture
        ? `${i.room.fixture.home_team} vs ${i.room.fixture.away_team}`
        : "a match",
      inviterName: i.inviter?.username ?? "someone",
    }));

  const subscriptions = (subs ?? []) as DashboardSubscription[];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-gold uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-gold" />
            Hosting
          </p>
          <h1 className="display text-4xl">My rooms</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button href="/host/guide" variant="ghost" size="sm">
            Host handbook
          </Button>
          <Button href="/host/new" variant="red">
            Create room →
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <CohostInvites invites={invites} />
        {rooms.length === 0 && subscriptions.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-secondary">
            No upcoming rooms yet. Pick a fixture, create your own room for any
            game, or host a whole season in one click.
          </p>
        ) : (
          <HostRoomsDashboard rooms={rooms} subscriptions={subscriptions} />
        )}
      </div>
    </div>
  );
}
