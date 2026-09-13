import { brand } from "@/lib/brand";
import { roomUrl, siteUrl } from "@/lib/notify/urls";
import type { NotificationType } from "@/lib/notify/types";

/**
 * Turn (type, payload) into the email + push content. Copy follows the project
 * rule: no em-dashes. Kept deliberately plain; the point is reliable delivery,
 * not marketing.
 */

export type NotificationPayload = {
  roomSlug?: string;
  matchLabel?: string;
  hostName?: string;
  actorName?: string;
  /** batched summary text, e.g. "38 rooms this season" (FR-20.7 / FR-21.3) */
  summary?: string;
  /** what changed, for room_change: "moved" | "postponed" | "canceled" */
  change?: string;
  profileUsername?: string;
};

export type Rendered = {
  subject: string;
  title: string;
  body: string;
  url: string;
};

export function renderNotification(
  type: NotificationType,
  p: NotificationPayload,
): Rendered {
  const match = p.matchLabel ?? "a match";
  const host = p.hostName ? `@${p.hostName}` : "a commentator";
  const actor = p.actorName ? `@${p.actorName}` : "someone";
  const url = p.roomSlug ? roomUrl(p.roomSlug) : siteUrl();

  switch (type) {
    case "room_scheduled":
      return p.summary
        ? {
            subject: `${p.hostName ?? "A commentator you follow"} scheduled ${p.summary}`,
            title: `${host} scheduled ${p.summary}`,
            body: "Tap to see the schedule.",
            url: p.profileUsername ? `${siteUrl()}/${p.profileUsername}` : url,
          }
        : {
            subject: `${host} scheduled a room for ${match}`,
            title: `New room: ${match}`,
            body: `${host} is hosting ${match}. Count yourself in.`,
            url,
          };
    case "pre_start_reminder":
      return {
        subject: `${match} starts in 15 minutes`,
        title: `Starting soon: ${match}`,
        body: `${host} goes on air in 15 minutes.`,
        url,
      };
    case "go_live":
      return {
        subject: `${host} is live now: ${match}`,
        title: `Live now: ${match}`,
        body: `${host} just opened the room. Come listen.`,
        url,
      };
    case "rsvp_reminder":
      return {
        subject: `Your room starts in 30 minutes: ${match}`,
        title: `Starting soon: ${match}`,
        body: `The room you RSVP'd to goes on air in 30 minutes.`,
        url,
      };
    case "room_change": {
      const what =
        p.change === "canceled"
          ? "was canceled"
          : p.change === "postponed"
            ? "was postponed"
            : "moved to a new time";
      return {
        subject: `Room update: ${match} ${what}`,
        title: `Room ${what}: ${match}`,
        body: `The room for ${match} ${what}.`,
        url,
      };
    }
    case "cohost_invite":
      return {
        subject: `${actor} invited you to co-host ${match}`,
        title: `Co-host invite: ${match}`,
        body: `${actor} wants you to co-host ${match}. Respond from your dashboard.`,
        url: `${siteUrl()}/host`,
      };
    case "cohost_response":
      return {
        subject: `${actor} responded to your co-host invite`,
        title: `Co-host update: ${match}`,
        body: `${actor} responded to your co-host invite for ${match}.`,
        url: `${siteUrl()}/host`,
      };
    case "friend_request":
      return {
        subject: `${actor} sent you a friend request`,
        title: "New friend request",
        body: `${actor} wants to be friends on ${brand.name}.`,
        url: `${siteUrl()}/settings`,
      };
    case "friend_accept":
      return {
        subject: `${actor} accepted your friend request`,
        title: "Friend request accepted",
        body: `${actor} accepted your friend request.`,
        url: p.profileUsername
          ? `${siteUrl()}/${p.profileUsername}`
          : `${siteUrl()}/settings`,
      };
  }
}

/** Minimal, inlined-CSS HTML email with the mandatory unsubscribe footer. */
export function emailHtml(r: Rendered, unsubscribeUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F7F1E2;font-family:Georgia,'Times New Roman',serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#1B1A15">
  <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#A8241A;margin:0 0 16px;border-top:3px solid #1B1A15;padding-top:10px">${brand.name}</p>
  <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#1B1A15">${escapeHtml(r.title)}</h1>
  <p style="font-size:15px;line-height:1.6;color:#4a463c;margin:0 0 24px">${escapeHtml(r.body)}</p>
  <a href="${r.url}" style="display:inline-block;background:#1B1A15;color:#F7F1E2;text-decoration:none;font-weight:700;padding:12px 22px">Open ${brand.name}</a>
  <p style="font-size:12px;color:#6b675c;margin:32px 0 0;line-height:1.6">
    You are getting this because of your ${brand.name} notification settings.
    <a href="${unsubscribeUrl}" style="color:#6b675c">Unsubscribe from these emails</a>.
  </p>
</div></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
