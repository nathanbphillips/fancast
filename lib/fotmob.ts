import "server-only";

/**
 * Fotmob player-profile resolution (Phase 11). Sportmonks gives us player names;
 * Fotmob's public suggest endpoint maps a name (+ team, to disambiguate common
 * names) to a profile id. We resolve once per player and cache in `player_fotmob`
 * — see app/api/fotmob/resolve. Linking out to Fotmob is fine; we never embed
 * their content. The endpoint is unofficial and best-effort: any failure just
 * yields no profile link, and the UI falls back to a Fotmob search URL.
 */

const SUGGEST = "https://apigw.fotmob.com/searchapi/suggest";

export type FotmobResolved = { fotmobId: number; url: string };

const COMBINING = new RegExp("[\\u0300-\\u036f]", "g"); // diacritic marks
const stripDiacritics = (s: string) => s.normalize("NFD").replace(COMBINING, "");

const norm = (s: string) => stripDiacritics(s).toLowerCase().trim();

function slugify(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A Fotmob search URL — the always-works fallback when we can't resolve a
 *  confident profile match. */
export function fotmobSearchUrl(name: string): string {
  return `https://www.fotmob.com/search?q=${encodeURIComponent(name.trim())}`;
}

type SuggestOption = {
  text?: string;
  score?: number;
  payload?: { id?: string; teamName?: string; isCoach?: boolean };
};

/** Resolve a player name (optionally disambiguated by club) to their Fotmob
 *  profile. Network-only and best-effort; returns null on any miss/error so the
 *  caller can cache the negative and the UI can fall back to search. */
export async function resolveFotmobPlayer(
  name: string,
  team?: string | null,
): Promise<FotmobResolved | null> {
  const term = name.trim();
  if (!term) return null;

  let json: { squadMemberSuggest?: { options?: SuggestOption[] }[] };
  try {
    const res = await fetch(`${SUGGEST}?term=${encodeURIComponent(term)}&lang=en`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Arseradio/1.0)" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    json = (await res.json()) as typeof json;
  } catch {
    return null;
  }

  const opts: SuggestOption[] = [];
  for (const g of json.squadMemberSuggest ?? [])
    for (const o of g.options ?? []) if (!o.payload?.isCoach) opts.push(o);
  if (opts.length === 0) return null;

  // prefer a same-club match (disambiguates "Gabriel", "Rodrigo", etc.); else
  // take the highest-scored suggestion.
  let best: SuggestOption | null = null;
  if (team) {
    const t = norm(team);
    best =
      opts.find((o) => o.payload?.teamName && norm(o.payload.teamName) === t) ??
      opts.find((o) => {
        const tn = o.payload?.teamName ? norm(o.payload.teamName) : "";
        return tn && (tn.includes(t) || t.includes(tn));
      }) ??
      null;
  }
  if (!best) {
    best = opts.slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;
  }

  const id = best?.payload?.id;
  const fotmobId = id != null ? Number(id) : NaN;
  if (!Number.isFinite(fotmobId)) return null;

  // text is "Display Name|id" — slug is cosmetic (id alone resolves), but a
  // pretty URL is nicer.
  const display = (best!.text ?? name).split("|")[0] ?? name;
  return { fotmobId, url: `https://www.fotmob.com/players/${fotmobId}/${slugify(display)}` };
}
