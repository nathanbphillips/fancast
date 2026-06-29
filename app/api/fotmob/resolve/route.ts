import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { resolveFotmobPlayer } from "@/lib/fotmob";
import { getFixtureStats } from "@/lib/stats";

export const maxDuration = 30;

/**
 * Resolve a room's lineup players to their Fotmob profiles (Phase 11). The room
 * POSTs its roomId + the playerIds it's showing; the SERVER derives each
 * player's name + club from the trusted Sportmonks lineup (never the client) and
 * only resolves players that are actually in that fixture's lineup. Results are
 * cached in player_fotmob and reused forever. This closes the cache-poisoning
 * vector where a caller could associate a real playerId with an arbitrary name.
 * Best-effort: an unresolved player gets no link (UI falls back to search).
 */
const bodySchema = z.object({
  roomId: z.uuid(),
  playerIds: z.array(z.number().int()).min(1).max(60),
});

/** Run async tasks with bounded concurrency so we don't fan a burst at Fotmob. */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
}

export async function POST(request: NextRequest) {
  if (!rateLimit(`fotmob:${clientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Slow down." }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomId, playerIds } = parsed.data;
  const service = createServiceClient();

  // resolve the room → its fixture → the trusted Sportmonks lineup
  const { data: room } = await service
    .from("rooms")
    .select("fixture_id")
    .eq("id", roomId)
    .maybeSingle<{ fixture_id: number }>();
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const { data: fixture } = await service
    .from("fixtures")
    .select("sportmonks_fixture_id")
    .eq("id", room.fixture_id)
    .maybeSingle<{ sportmonks_fixture_id: number | null }>();
  if (!fixture?.sportmonks_fixture_id) return NextResponse.json({ links: {} });

  // trusted name + club per playerId, straight from Sportmonks (cached upstream)
  const trusted = new Map<number, { name: string; team: string }>();
  try {
    const stats = await getFixtureStats(fixture.sportmonks_fixture_id);
    for (const side of ["home", "away"] as const) {
      const s = stats.lineups[side];
      if (!s) continue;
      const team = side === "home" ? stats.home.name : stats.away.name;
      for (const p of [...s.starters, ...s.bench]) {
        if (p.playerId != null && p.name) trusted.set(p.playerId, { name: p.name, team });
      }
    }
  } catch {
    return NextResponse.json({ links: {} });
  }

  // only resolve requested ids that genuinely belong to this lineup
  const wanted = [...new Set(playerIds)].filter((id) => trusted.has(id));
  if (wanted.length === 0) return NextResponse.json({ links: {} });

  const { data: cached } = await service
    .from("player_fotmob")
    .select("sportmonks_player_id, fotmob_url")
    .in("sportmonks_player_id", wanted);
  const known = new Map<number, string | null>();
  for (const row of cached ?? []) {
    known.set(Number(row.sportmonks_player_id), (row.fotmob_url as string | null) ?? null);
  }

  const links: Record<number, string | null> = {};
  for (const id of wanted) if (known.has(id)) links[id] = known.get(id) ?? null;

  const toResolve = wanted.filter((id) => !known.has(id));
  await mapLimit(toResolve, 6, async (id) => {
    const t = trusted.get(id)!;
    const resolved = await resolveFotmobPlayer(t.name, t.team);
    links[id] = resolved?.url ?? null;
    await service.from("player_fotmob").upsert(
      {
        sportmonks_player_id: id,
        name: t.name,
        fotmob_id: resolved?.fotmobId ?? null,
        fotmob_url: resolved?.url ?? null,
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "sportmonks_player_id" },
    );
  });

  return NextResponse.json({ links });
}
