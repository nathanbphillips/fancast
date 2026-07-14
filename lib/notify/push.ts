import { brand } from "@/lib/brand";

/**
 * Web push sender (FR-21). Uses VAPID keys from env; no-ops with a console note
 * if they are unset (same drop-in pattern as email). A 404/410 from the push
 * service means the endpoint is dead: the caller revokes that subscription.
 */

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true }
  | { ok: false; gone: boolean; error: string };

let configured = false;
function ensureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    // set lazily; the require is cheap and only hit when keys exist
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpush = require("web-push") as typeof import("web-push");
    const subject = process.env.VAPID_SUBJECT ?? "mailto:team@arseradio.com";
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  }
  return true;
}

export async function sendPush(
  sub: PushSubscriptionRow,
  payload: { title: string; body: string; url: string },
): Promise<PushResult> {
  if (!ensureVapid()) {
    console.log(`[notify/push] skipped (no VAPID keys): "${payload.title}"`);
    return { ok: true, skipped: true };
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpush = require("web-push") as typeof import("web-push");
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify({
        title: payload.title || brand.name,
        body: payload.body,
        url: payload.url,
      }),
    );
    return { ok: true };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    const gone = status === 404 || status === 410;
    return { ok: false, gone, error: String(err) };
  }
}
