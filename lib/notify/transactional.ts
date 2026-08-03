import { brand } from "@/lib/brand";
import { siteUrl } from "@/lib/notify/urls";
import { sendEmail } from "@/lib/notify/email";
import { waitlistUnsubToken } from "@/lib/notify/tokens";

/**
 * One-off transactional emails (welcome on account signup, confirmation on
 * matchday-alert signup). Separate from the room-notification outbox — these
 * aren't per-room, prefs-gated, or deduped. Build functions are pure (render +
 * subject/text) so they can be previewed/tested; the send wrappers add sendEmail
 * (which no-ops until RESEND_API_KEY + EMAIL_FROM are set). Copy: no em-dashes;
 * "watch" only ever means the reader's own stream.
 */

export type BuiltEmail = { subject: string; html: string; text: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(opts: {
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerHtml: string;
}): string {
  return `<!doctype html><html><body style="margin:0;background:#0d0d0f;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#e9e9ea">
  <p style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;font-weight:700;margin:0 0 20px"><span style="color:#ef0107">ARSE</span><span style="color:#f2f2f4">RADIO</span></p>
  <h1 style="font-size:23px;line-height:1.3;margin:0 0 14px;color:#fff">${opts.title}</h1>
  ${opts.bodyHtml}
  <a href="${opts.ctaUrl}" style="display:inline-block;background:#ef0107;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:10px;margin-top:8px">${opts.ctaLabel}</a>
  <p style="font-size:12px;color:#7a7a7e;margin:32px 0 0;line-height:1.6">${opts.footerHtml}</p>
</div></body></html>`;
}

const P = `style="font-size:15px;line-height:1.62;color:#c7c7c9;margin:0 0 18px"`;
const A = `style="color:#9a9a9e"`;

export function buildWelcomeEmail(username: string): BuiltEmail {
  const url = `${siteUrl()}/matches`;
  const name = escapeHtml(username);
  const html = shell({
    title: `Welcome to ${brand.name}, ${name}`,
    bodyHtml:
      `<p ${P}>You're in. ${brand.name} is the matchday room for Arsenal fans: turn the pundits off and listen along with real supporters, in sync with your own stream.</p>` +
      `<p ${P}>Listening is always free. Pick a match, tap "Count me in" so we can remind you before it starts, and jump in when the room opens. Fancy hosting your own? Any account can.</p>`,
    ctaLabel: "See what's on",
    ctaUrl: url,
    footerHtml: `You created an account at ${brand.domain}. Manage your emails anytime in your <a href="${siteUrl()}/settings" ${A}>settings</a>.`,
  });
  const text = `Welcome to ${brand.name}, ${username}!

You're in. ${brand.name} is the matchday room for Arsenal fans: turn the pundits off and listen along with real supporters, in sync with your own stream.

Listening is always free. Pick a match, RSVP so we can remind you, and jump in when the room opens.

See what's on: ${url}
Manage emails: ${siteUrl()}/settings`;
  return { subject: `Welcome to ${brand.name}`, html, text };
}

export function buildWaitlistEmail(to: string): BuiltEmail {
  const url = `${siteUrl()}/matches`;
  const unsub = `${siteUrl()}/api/waitlist/unsubscribe?token=${waitlistUnsubToken(to)}`;
  const html = shell({
    title: "You're on the list",
    bodyHtml:
      `<p ${P}>Thanks for signing up for matchday alerts. We'll email you the moment the first ${brand.name} rooms open, so you can listen along to live fan commentary for Arsenal, in sync with your own stream.</p>` +
      `<p ${P}>Nothing to do for now. Meanwhile, you can browse the upcoming schedule below.</p>`,
    ctaLabel: "Browse the schedule",
    ctaUrl: url,
    footerHtml: `You signed up for matchday alerts at ${brand.domain}. <a href="${unsub}" ${A}>Unsubscribe</a>.`,
  });
  const text = `You're on the list!

Thanks for signing up for matchday alerts. We'll email you the moment the first ${brand.name} rooms open, so you can listen along to live fan commentary for Arsenal, in sync with your own stream.

Browse the schedule: ${url}

Unsubscribe: ${unsub}`;
  return { subject: `You're on the ${brand.name} list`, html, text };
}

export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  const m = buildWelcomeEmail(username);
  await sendEmail({ to, subject: m.subject, html: m.html, text: m.text });
}

export async function sendWaitlistConfirmation(to: string): Promise<void> {
  const m = buildWaitlistEmail(to);
  await sendEmail({ to, subject: m.subject, html: m.html, text: m.text });
}
