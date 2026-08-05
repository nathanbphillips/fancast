/**
 * LiveKit identity helpers, shared by server and client.
 *
 * Identity is "<accountId>#<per-connection nonce>". LiveKit disconnects an
 * existing participant when a new connection arrives with the SAME identity, so
 * a bare account id meant one account open in two places (second tab, or phone
 * + laptop) silently killed the earlier session — signed-in listeners saw the
 * play button "do nothing" while anonymous listeners were unaffected, because
 * their ids were already unique (founder report 2026-08-05).
 *
 * Kept free of the server SDK so client components can import it.
 */

/** Mint a per-connection identity for an account (user id, or "anon:xxx"). */
export function livekitIdentity(base: string): string {
  return `${base}#${Math.random().toString(36).slice(2, 8)}`;
}

/** Recover the account behind an identity (strips the per-connection nonce). */
export function identityUserId(identity: string): string {
  const i = identity.lastIndexOf("#");
  return i === -1 ? identity : identity.slice(0, i);
}
