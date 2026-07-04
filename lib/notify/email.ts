import { brand } from "@/lib/brand";

/**
 * Email sender (FR-21). Founder ruling 2026-07-03: build AROUND Resend. This
 * no-ops with a console note until RESEND_API_KEY + EMAIL_FROM (a verified
 * domain) are set, so the whole platform is drop-in ready without the domain
 * being chosen yet. When both env vars land, it sends for real, no code change.
 */

export type EmailResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true }
  | { ok: false; error: string };

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.log(
      `[notify/email] skipped (no RESEND_API_KEY/EMAIL_FROM): "${msg.subject}" to ${msg.to}`,
    );
    return { ok: true, skipped: true };
  }

  try {
    // dynamic import so the package is never loaded on the no-op path
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    // EMAIL_FROM may be a full "Name <addr>" header or a bare address
    const fromHeader = from.includes("<")
      ? from
      : `${brand.emailSenderName} <${from}>`;
    const { error } = await resend.emails.send({
      from: fromHeader,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
