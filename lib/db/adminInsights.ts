import { createServiceClient } from "@/lib/db/server";

/**
 * Admin insights: a snapshot of registrations, engagement, retention, per-room
 * activity, and growth, merged from profiles + profile_stats + auth.users +
 * listener_segments + rooms/room_hosts + speaker_events (+ the events table for
 * product telemetry). Admin-only (service role). Sized for pre-launch/early
 * scale — fetch + aggregate in memory rather than via SQL rollups.
 */

export type UserInsight = {
  userId: string;
  username: string;
  email: string | null;
  role: string;
  standing: string;
  joinedAt: string;
  lastSignInAt: string | null;
  listeningSeconds: number;
  matchesAttended: number;
  hostedRooms: number;
  fanScore: number;
  comments: number;
};

export type RoomInsight = {
  roomId: string;
  name: string;
  whenIso: string;
  state: string;
  uniqueListeners: number;
  anonSessions: number;
  peakConcurrent: number;
  avgSessionSecs: number;
  callIns: number;
};

export type GrowthPoint = { date: string; signups: number; cumulative: number };

export type EventStat = { event: string; total: number; last7d: number };

export type AdminInsights = {
  kpis: {
    totalUsers: number;
    new7d: number;
    new30d: number;
    active7d: number;
    totalHosts: number;
    totalRooms: number;
    listeningSecondsAll: number;
    listeningSecondsRegistered: number;
    totalMatchesAttended: number;
    totalComments: number;
    alertSignups: number;
    alertSignups7d: number;
    rsvpsTotal: number;
    rsvpUsers: number;
    rsvps7d: number;
  };
  funnel: {
    authAccounts: number;
    completedProfiles: number;
    onboardingDropoff: number;
    conversionPct: number;
  };
  retention: {
    returnedCount: number;
    returnedRate: number;
    week1Count: number;
    week1Rate: number;
    activeRate: number;
  };
  growth: GrowthPoint[];
  users: UserInsight[];
  rooms: RoomInsight[];
  events: EventStat[] | null;
  notes: { moreUsers: boolean; truncatedSegments: boolean };
};

const DAY = 24 * 60 * 60 * 1000;
const SEG_LIMIT = 50000;

type Seg = {
  user_id: string | null;
  room_id: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
};

/** Max simultaneous listeners across a room's sessions (interval sweep). */
function peakConcurrent(segs: Seg[]): number {
  const events: [number, number][] = [];
  for (const s of segs) {
    const start = Date.parse(s.started_at);
    const end = Date.parse(s.ended_at ?? s.last_seen_at);
    events.push([start, 1], [Math.max(end, start), -1]);
  }
  // at an equal timestamp, process ends (-1) before starts (+1)
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let peak = 0;
  for (const [, d] of events) {
    cur += d;
    if (cur > peak) peak = cur;
  }
  return peak;
}

export async function loadAdminInsights(): Promise<AdminInsights> {
  const service = createServiceClient();

  const [
    { data: profiles },
    { data: stats },
    { data: rooms },
    { data: hostRows },
    { data: segs },
    { data: speakerRows },
    { data: waitRows },
    { data: rsvpRows },
    eventStats,
    authRes,
  ] = await Promise.all([
    service.from("profiles").select("user_id, username, role, standing, created_at"),
    service.from("profile_stats").select("user_id, fan_score, matches_attended, comments_count"),
    service
      .from("rooms")
      .select(
        "id, commentator_id, state, title, scheduled_kickoff, created_at, fixture:fixtures(home_team, away_team)",
      ),
    service.from("room_hosts").select("room_id, user_id").eq("status", "accepted"),
    service
      .from("listener_segments")
      .select("user_id, room_id, started_at, last_seen_at, ended_at")
      .limit(SEG_LIMIT),
    service.from("speaker_events").select("room_id, action").eq("action", "elevated"),
    service.from("waitlist").select("created_at"),
    service.from("room_rsvps").select("user_id, created_at"),
    loadEventStats(service),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  type Stat = { user_id: string; fan_score: number; matches_attended: number; comments_count: number };
  const statByUser = new Map<string, Stat>(
    (stats ?? []).map((s) => [s.user_id as string, s as Stat]),
  );

  const authUsers = authRes.data?.users ?? [];
  const authById = new Map(authUsers.map((u) => [u.id, u]));
  const moreUsers = authUsers.length >= 1000;

  // listening seconds: total (incl. anon) + per registered user; and each
  // registered user's activity days (for week-1 retention)
  const segList = (segs ?? []) as Seg[];
  let listeningSecondsAll = 0;
  const secsByUser = new Map<string, number>();
  const activityDaysByUser = new Map<string, Set<string>>();
  for (const s of segList) {
    const start = Date.parse(s.started_at);
    const end = Date.parse(s.ended_at ?? s.last_seen_at);
    const secs = Math.max(0, (end - start) / 1000);
    listeningSecondsAll += secs;
    if (s.user_id) {
      secsByUser.set(s.user_id, (secsByUser.get(s.user_id) ?? 0) + secs);
      const days = activityDaysByUser.get(s.user_id) ?? new Set<string>();
      days.add(s.started_at.slice(0, 10));
      activityDaysByUser.set(s.user_id, days);
    }
  }
  const truncatedSegments = segList.length >= SEG_LIMIT;

  // hosted rooms per user (created as commentator, or accepted co-host)
  const hostedByUser = new Map<string, Set<string>>();
  const addHost = (uid: string, rid: string) => {
    const set = hostedByUser.get(uid) ?? new Set<string>();
    set.add(rid);
    hostedByUser.set(uid, set);
  };
  for (const r of rooms ?? [])
    if (r.commentator_id) addHost(r.commentator_id as string, r.id as string);
  for (const h of hostRows ?? [])
    addHost(h.user_id as string, h.room_id as string);

  const users: UserInsight[] = (profiles ?? [])
    .map((p) => {
      const st = statByUser.get(p.user_id as string);
      const au = authById.get(p.user_id as string);
      return {
        userId: p.user_id as string,
        username: p.username as string,
        email: au?.email ?? null,
        role: p.role as string,
        standing: p.standing as string,
        joinedAt: p.created_at as string,
        lastSignInAt: au?.last_sign_in_at ?? null,
        listeningSeconds: Math.round(secsByUser.get(p.user_id as string) ?? 0),
        matchesAttended: st?.matches_attended ?? 0,
        hostedRooms: hostedByUser.get(p.user_id as string)?.size ?? 0,
        fanScore: st?.fan_score ?? 0,
        comments: st?.comments_count ?? 0,
      };
    })
    .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));

  const now = Date.now();
  const active7d = users.filter(
    (u) => u.lastSignInAt && now - Date.parse(u.lastSignInAt) < 7 * DAY,
  ).length;

  const kpis = {
    totalUsers: users.length,
    new7d: users.filter((u) => now - Date.parse(u.joinedAt) < 7 * DAY).length,
    new30d: users.filter((u) => now - Date.parse(u.joinedAt) < 30 * DAY).length,
    active7d,
    totalHosts: users.filter((u) => u.hostedRooms > 0).length,
    totalRooms: rooms?.length ?? 0,
    listeningSecondsAll: Math.round(listeningSecondsAll),
    listeningSecondsRegistered: Math.round(
      [...secsByUser.values()].reduce((a, b) => a + b, 0),
    ),
    totalMatchesAttended: users.reduce((a, u) => a + u.matchesAttended, 0),
    totalComments: users.reduce((a, u) => a + u.comments, 0),
    // acquisition: matchday-alert (waitlist) signups + room RSVPs
    alertSignups: waitRows?.length ?? 0,
    alertSignups7d: (waitRows ?? []).filter(
      (w) => now - Date.parse(w.created_at as string) < 7 * DAY,
    ).length,
    rsvpsTotal: rsvpRows?.length ?? 0,
    rsvpUsers: new Set((rsvpRows ?? []).map((r) => r.user_id as string)).size,
    rsvps7d: (rsvpRows ?? []).filter(
      (r) => now - Date.parse(r.created_at as string) < 7 * DAY,
    ).length,
  };

  // Funnel: auth account created (started) -> profile/username picked (completed)
  const funnel = {
    authAccounts: authUsers.length,
    completedProfiles: users.length,
    onboardingDropoff: Math.max(0, authUsers.length - users.length),
    conversionPct: authUsers.length
      ? Math.round((users.length / authUsers.length) * 100)
      : 0,
  };

  // Retention: returned = last login on a later day than signup; week1 = a
  // listening session on a day after signup within 7 days
  let returnedCount = 0;
  let week1Count = 0;
  for (const u of users) {
    const joinDay = u.joinedAt.slice(0, 10);
    if (u.lastSignInAt && u.lastSignInAt.slice(0, 10) > joinDay) returnedCount++;
    const joinMs = Date.parse(joinDay);
    const days = activityDaysByUser.get(u.userId);
    if (
      days &&
      [...days].some((d) => {
        const dm = Date.parse(d);
        return dm > joinMs && dm <= joinMs + 7 * DAY;
      })
    )
      week1Count++;
  }
  const retention = {
    returnedCount,
    returnedRate: users.length ? Math.round((returnedCount / users.length) * 100) : 0,
    week1Count,
    week1Rate: users.length ? Math.round((week1Count / users.length) * 100) : 0,
    activeRate: users.length ? Math.round((active7d / users.length) * 100) : 0,
  };

  // Per-room analytics
  const segsByRoom = new Map<string, Seg[]>();
  for (const s of segList) {
    const arr = segsByRoom.get(s.room_id) ?? [];
    arr.push(s);
    segsByRoom.set(s.room_id, arr);
  }
  const callInsByRoom = new Map<string, number>();
  for (const e of speakerRows ?? [])
    callInsByRoom.set(
      e.room_id as string,
      (callInsByRoom.get(e.room_id as string) ?? 0) + 1,
    );

  const roomInsights: RoomInsight[] = (rooms ?? [])
    .map((r) => {
      const rs = segsByRoom.get(r.id as string) ?? [];
      const durations = rs.map((s) =>
        Math.max(0, (Date.parse(s.ended_at ?? s.last_seen_at) - Date.parse(s.started_at)) / 1000),
      );
      const avg = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;
      // PostgREST types the embed as an array; a to-one FK returns an object at
      // runtime — handle both.
      const fxRaw = r.fixture as unknown;
      const fx = (Array.isArray(fxRaw) ? fxRaw[0] : fxRaw) as
        | { home_team: string; away_team: string }
        | null
        | undefined;
      const name = fx
        ? `${fx.home_team} v ${fx.away_team}`
        : ((r.title as string | null) ?? "Room");
      return {
        roomId: r.id as string,
        name,
        whenIso: (r.scheduled_kickoff as string) ?? (r.created_at as string),
        state: r.state as string,
        uniqueListeners: new Set(rs.map((s) => s.user_id).filter(Boolean)).size,
        anonSessions: rs.filter((s) => !s.user_id).length,
        peakConcurrent: peakConcurrent(rs),
        avgSessionSecs: avg,
        callIns: callInsByRoom.get(r.id as string) ?? 0,
      };
    })
    .sort((a, b) => b.whenIso.localeCompare(a.whenIso))
    .slice(0, 50);

  // growth: signups per UTC day over the last 30 days + running cumulative
  const signupsByDay = new Map<string, number>();
  for (const u of users) {
    const k = u.joinedAt.slice(0, 10);
    signupsByDay.set(k, (signupsByDay.get(k) ?? 0) + 1);
  }
  const startOfTodayUTC = Date.parse(new Date().toISOString().slice(0, 10));
  const windowStart = startOfTodayUTC - 29 * DAY;
  let cumulative = users.filter((u) => Date.parse(u.joinedAt) < windowStart).length;
  const growth: GrowthPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = new Date(startOfTodayUTC - i * DAY).toISOString().slice(0, 10);
    const signups = signupsByDay.get(key) ?? 0;
    cumulative += signups;
    growth.push({ date: key, signups, cumulative });
  }

  return {
    kpis,
    funnel,
    retention,
    growth,
    users,
    rooms: roomInsights,
    events: eventStats,
    notes: { moreUsers, truncatedSegments },
  };
}

/** Product-telemetry event counts (migration 0041). Returns null if the table
 *  isn't present yet, so the dashboard degrades gracefully. */
async function loadEventStats(
  service: ReturnType<typeof createServiceClient>,
): Promise<EventStat[] | null> {
  const { data, error } = await service
    .from("events")
    .select("event, created_at")
    .gte("created_at", new Date(Date.now() - 30 * DAY).toISOString())
    .limit(100000);
  if (error) return null;
  const now = Date.now();
  const byEvent = new Map<string, { total: number; last7d: number }>();
  for (const e of data ?? []) {
    const k = e.event as string;
    const cur = byEvent.get(k) ?? { total: 0, last7d: 0 };
    cur.total++;
    if (now - Date.parse(e.created_at as string) < 7 * DAY) cur.last7d++;
    byEvent.set(k, cur);
  }
  return [...byEvent.entries()]
    .map(([event, v]) => ({ event, ...v }))
    .sort((a, b) => b.total - a.total);
}
