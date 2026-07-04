import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db/server";
import { channelDefault, NOTIFICATION_TYPES } from "@/lib/notify/types";
import { verifyUnsubscribeToken } from "@/lib/notify/tokens";
import { brand } from "@/lib/brand";
import { siteUrl } from "@/lib/notify/urls";

/**
 * One-click unsubscribe (FR-21.5). A signed token identifies (user, type); no
 * login. Disables that type's EMAIL channel only (push is unchanged, managed in
 * settings). Renders a plain confirmation page.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) {
    return htmlPage(
      "Link expired",
      "This unsubscribe link isn't valid anymore. You can manage notifications in your settings.",
    );
  }

  const service = createServiceClient();
  // upsert the pref row with email off; keep push at its stored/default value
  const { data: existing } = await service
    .from("notification_prefs")
    .select("push_enabled")
    .eq("user_id", parsed.userId)
    .eq("type", parsed.type)
    .maybeSingle();
  const push = existing
    ? (existing.push_enabled as boolean)
    : channelDefault(parsed.type, "push");
  await service.from("notification_prefs").upsert(
    {
      user_id: parsed.userId,
      type: parsed.type,
      email_enabled: false,
      push_enabled: push,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,type" },
  );

  const label = NOTIFICATION_TYPES[parsed.type].label.toLowerCase();
  return htmlPage(
    "Unsubscribed",
    `You will no longer get "${label}" emails from ${brand.name}. Manage all notifications in your settings.`,
  );
}

function htmlPage(title: string, body: string): Response {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#0d0d0f;color:#e9e9ea;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center">
  <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#e8b54a;margin:0 0 16px">${brand.name}</p>
  <h1 style="font-size:24px;color:#fff;margin:0 0 12px">${title}</h1>
  <p style="font-size:15px;line-height:1.6;color:#c7c7c9;margin:0 0 28px">${body}</p>
  <a href="${siteUrl()}/settings" style="display:inline-block;background:#f1232b;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Notification settings</a>
</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
