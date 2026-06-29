import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { resolveFotmobPlayer } from "@/lib/fotmob";

export const maxDuration = 30;

/**
 * Resolve lineup players to their Fotmob profiles (Phase 11). The room POSTs
 * the players the moment a lineup appears; we serve cached rows from
 * `player_fotmob` and resolve the rest in the background, caching the result
 * (including negatives) so a player is only ever looked up once. Best-effort:
 * an unresolved player simply gets no link and the UI falls back to a search
 * URL. Bounded by a per-IP rate limit + a hard cap on players per request.
 */
const bodySchema = z.object({
  players: z
    .array(
      z.object({
        playerId: z.number().int(),
        name: z.string().trim().min(1).max(80),
        team: z.string().trim().max(80).optional(),
      }),
    )
    .min(1)
    .max(60), // both full squads (starters + benches) fit under this
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
  const players = parsed.data.players;
  const service = createServiceClient();

  // serve cached rows (positive or negative) first
  const ids = players.map((p) => p.playerId);
  const { data: cached } = await service
    .from("player_fotmob")
    .select("sportmonks_player_id, fotmob_url")
    .in("sportmonks_player_id", ids);
  const known = new Map<number, string | null>();
  for (const row of cached ?? []) {
    known.set(Number(row.sportmonks_player_id), (row.fotmob_url as string | null) ?? null);
  }

  const links: Record<number, string | null> = {};
  for (const p of players) if (known.has(p.playerId)) links[p.playerId] = known.get(p.playerId) ?? null;

  const toResolve = players.filter((p) => !known.has(p.playerId));
  await mapLimit(toResolve, 6, async (p) => {
    const resolved = await resolveFotmobPlayer(p.name, p.team);
    links[p.playerId] = resolved?.url ?? null;
    await service.from("player_fotmob").upsert(
      {
        sportmonks_player_id: p.playerId,
        name: p.name,
        fotmob_id: resolved?.fotmobId ?? null,
        fotmob_url: resolved?.url ?? null,
        resolved_at: new Date().toISOString(),
      },
      { onConflict: "sportmonks_player_id" },
    );
  });

  return NextResponse.json({ links });
}
