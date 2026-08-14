/**
 * One-device-on-air claim (founder 2026-08-05: "one account should only be on
 * the air from one device at a time").
 *
 * The accept is delivered on the per-user Ably channel, which EVERY tab and
 * device of that account subscribes to — so without a claim they would all open
 * a microphone at once. This is the fast, same-browser half: a localStorage
 * mutex with a heartbeat, so a crashed tab can't hold the claim forever. The
 * cross-DEVICE half is enforced server-side by /api/talk/claim-air, which
 * revokes publish on the account's other connections.
 *
 * Fails OPEN: if storage is unavailable we let them on air rather than block a
 * legitimate caller.
 */

const TTL_MS = 15_000; // holder re-stamps every ~5s while live
const key = (roomId: string) => `fc_onair_${roomId}`;

let tabId: string | null = null;
function myTabId(): string {
  if (!tabId) {
    tabId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Math.random()).slice(2);
  }
  return tabId;
}

/** Try to become the on-air tab. True if we hold it (or already did). */
export function claimOnAir(roomId: string): boolean {
  try {
    const raw = localStorage.getItem(key(roomId));
    const now = Date.now();
    if (raw) {
      const held = JSON.parse(raw) as { id: string; ts: number };
      const fresh = now - held.ts < TTL_MS;
      if (fresh && held.id !== myTabId()) return false; // another tab is live
    }
    localStorage.setItem(
      key(roomId),
      JSON.stringify({ id: myTabId(), ts: now }),
    );
    return true;
  } catch {
    return true; // storage blocked — don't stop someone going on air
  }
}

/** Keep the claim alive while actually publishing. */
export function refreshOnAirClaim(roomId: string): void {
  try {
    const raw = localStorage.getItem(key(roomId));
    if (raw) {
      const held = JSON.parse(raw) as { id: string; ts: number };
      if (held.id !== myTabId()) return; // not ours to refresh
    }
    localStorage.setItem(
      key(roomId),
      JSON.stringify({ id: myTabId(), ts: Date.now() }),
    );
  } catch {}
}

/** Give it up on leaving air / unmount so the next device can take it. */
export function releaseOnAirClaim(roomId: string): void {
  try {
    const raw = localStorage.getItem(key(roomId));
    if (!raw) return;
    const held = JSON.parse(raw) as { id: string };
    if (held.id === myTabId()) localStorage.removeItem(key(roomId));
  } catch {}
}
