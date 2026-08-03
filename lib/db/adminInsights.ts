import { createServiceClient } from "@/lib/db/server";

/**
 * Admin insights: a snapshot of registrations, engagement, and growth, merged
 * from profiles + profile_stats + auth.users (email/last-login) + the raw
 * listener_segments + rooms/room_hosts. Admin-only (service role); the page
 * that renders it gates on isAdmin. Sized for the pre-launch/early scale — it
 * fetches and aggregates in memory rather than via SQL rollups.
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

export type GrowthPoint = { date: string; signups: number; cumulative: number };

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
  };
  growth: GrowthPoint[];
  users: UserInsight[];
  notes: { moreUsers: boolean; truncatedSegments: boolean };
};

const DAY = 24 * 60 * 60 * 1000;
const SEG_LIMIT = 50000;

export async function loadAdminInsights(): Promise<AdminInsights> {
  const service = createServiceClient();

  const [
    { data: profiles },
    { data: stats },
    { data: rooms },
    { data: hostRows },
    { data: segs },
    authRes,
  ] = await Promise.all([
    service.from("profiles").select("user_id, username, role, standing, created_at"),
    service.from("profile_stats").select("user_id, fan_score, matches_attended, comments_count"),
    service.from("rooms").select("id, commentator_id"),
    service.from("room_hosts").select("room_id, user_id").eq("status", "accepted"),
    service
      .from("listener_segments")
      .select("user_id, started_at, last_seen_at, ended_at")
      .limit(SEG_LIMIT),
    service.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  type Stat = { user_id: string; fan_score: number; matches_attended: number; comments_count: number };
  const statByUser = new Map<string, Stat>(
    (stats ?? []).map((s) => [s.user_id as string, s as Stat]),
  );

  const authUsers = authRes.data?.users ?? [];
  const authById = new Map(authUsers.map((u) => [u.id, u]));
  const moreUsers = authUsers.length >= 1000;

  // listening seconds: total (incl. anon) + per registered user, from raw
  // intervals (open segments count up to their last heartbeat, not "now")
  let listeningSecondsAll = 0;
  const secsByUser = new Map<string, number>();
  for (const s of segs ?? []) {
    const start = Date.parse(s.started_at as string);
    const end = Date.parse((s.ended_at as string) ?? (s.last_seen_at as string));
    const secs = Math.max(0, (end - start) / 1000);
    listeningSecondsAll += secs;
    const uid = s.user_id as string | null;
    if (uid) secsByUser.set(uid, (secsByUser.get(uid) ?? 0) + secs);
  }
  const truncatedSegments = (segs?.length ?? 0) >= SEG_LIMIT;

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

  // KPIs
  const now = Date.now();
  const kpis = {
    totalUsers: users.length,
    new7d: users.filter((u) => now - Date.parse(u.joinedAt) < 7 * DAY).length,
    new30d: users.filter((u) => now - Date.parse(u.joinedAt) < 30 * DAY).length,
    active7d: users.filter(
      (u) => u.lastSignInAt && now - Date.parse(u.lastSignInAt) < 7 * DAY,
    ).length,
    totalHosts: users.filter((u) => u.hostedRooms > 0).length,
    totalRooms: rooms?.length ?? 0,
    listeningSecondsAll: Math.round(listeningSecondsAll),
    listeningSecondsRegistered: Math.round(
      [...secsByUser.values()].reduce((a, b) => a + b, 0),
    ),
    totalMatchesAttended: users.reduce((a, u) => a + u.matchesAttended, 0),
    totalComments: users.reduce((a, u) => a + u.comments, 0),
  };

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
    growth,
    users,
    notes: { moreUsers, truncatedSegments },
  };
}
