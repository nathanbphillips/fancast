import { createHmac, timingSafeEqual } from "crypto";
import { isNotificationType, type NotificationType } from "@/lib/notify/types";

/**
 * Signed one-click unsubscribe tokens (FR-21.5). A token encodes (userId, type)
 * with an HMAC so the unsubscribe link works with no login and can't be forged
 * or retargeted to another user or type. Server-only.
 */

function secret(): string {
  return (
    process.env.NOTIFY_TOKEN_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "insecure-dev-secret"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
}

export function unsubscribeToken(
  userId: string,
  type: NotificationType,
): string {
  const payload = `${userId}.${type}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(
  token: string,
): { userId: string; type: NotificationType } | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const sep = payload.indexOf(".");
  if (sep < 0) return null;
  const userId = payload.slice(0, sep);
  const type = payload.slice(sep + 1);
  if (!isNotificationType(type)) return null;
  return { userId, type };
}
