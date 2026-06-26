const ESTABLISHED_AFTER_MS = 48 * 60 * 60 * 1000;

type Standing = { created_at: string; standing: string };

/**
 * Established = good standing AND account at least 48h old (mirrors the flag
 * system, CLAUDE.md). Used to weight votes/flags so a few freshly-created
 * sock-puppets can't drive the vote ranking or hide content.
 */
export function isEstablished(profile: Standing): boolean {
  return (
    profile.standing === "good" &&
    Date.now() - new Date(profile.created_at).getTime() >= ESTABLISHED_AFTER_MS
  );
}

/** Vote weight toward the ranked `score`: established 1.0, otherwise 0.3 — so a
 *  new account still registers some signal but can't brigade the "top" sort. */
export function voteWeight(profile: Standing): number {
  return isEstablished(profile) ? 1.0 : 0.3;
}

/** Flag weight toward the hide threshold: established 1.0, otherwise 0.5. */
export function flagWeight(profile: Standing): number {
  return isEstablished(profile) ? 1.0 : 0.5;
}
