import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/db/server";
import { verifyWaitlistUnsubToken } from "@/lib/notify/tokens";
import { brand } from "@/lib/brand";
import { siteUrl } from "@/lib/notify/urls";

/**
 * One-click unsubscribe for the matchday-alert waitlist. A signed token identifies
 * the email (no login); removes it from the list and renders a confirmation page.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const email = verifyWaitlistUnsubToken(token);
  if (!email) {
    return htmlPage(
      "Link expired",
      "This unsubscribe link isn't valid anymore.",
    );
  }

  const service = createServiceClient();
  await service.from("waitlist").delete().eq("email", email.toLowerCase());

  return htmlPage(
    "Unsubscribed",
    `You've been removed from the ${brand.name} matchday-alert list. No more emails.`,
  );
}

function htmlPage(title: string, body: string): Response {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#0d0d0f;color:#e9e9ea;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center">
  <p style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin:0 0 16px"><span style="color:#ef0107">ARSE</span><span style="color:#f2f2f4">RADIO</span></p>
  <h1 style="font-size:24px;color:#fff;margin:0 0 12px">${title}</h1>
  <p style="font-size:15px;line-height:1.6;color:#c7c7c9;margin:0 0 28px">${body}</p>
  <a href="${siteUrl()}" style="display:inline-block;background:#ef0107;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">Go to ${brand.name}</a>
</div></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
