import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";
import { sendEmail } from "@/lib/notify/email";
import { brand } from "@/lib/brand";

const schema = z.object({
  // optional override recipient; defaults to the admin's own account email
  to: z.string().email().optional(),
});

/**
 * Admin-only "send a test email" (ops tool). Calls sendEmail() directly and
 * returns Resend's raw outcome plus a redacted config snapshot, so the founder
 * can verify the Resend domain/key end-to-end after each config change without
 * having to trigger a real RSVP/cancel. Never exposes the API key value; the
 * EMAIL_FROM header is shown (admin-only, not a secret) because its domain is
 * exactly what Resend checks for verification.
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const service = createServiceClient();

  // default recipient = the admin's own account email
  let to = parsed.data.to;
  if (!to) {
    const { data: userRes } = await service.auth.admin.getUserById(caller.userId);
    to = userRes?.user?.email ?? undefined;
    if (!to) {
      return NextResponse.json(
        { error: "No email on your account; pass an explicit recipient." },
        { status: 400 },
      );
    }
  }

  const from = process.env.EMAIL_FROM ?? null;
  const config = {
    hasApiKey: Boolean(process.env.RESEND_API_KEY),
    hasFrom: Boolean(from),
    from, // full "Name <addr>" header — admin-only, safe to surface
  };

  const stamp = new Date().toISOString();
  const result = await sendEmail({
    to,
    subject: `${brand.name} test email`,
    html: `<p>This is a test email from ${brand.name} admin tools.</p><p style="color:#888;font-size:12px">Sent ${stamp}</p>`,
    text: `This is a test email from ${brand.name} admin tools.\n\nSent ${stamp}`,
  });

  // shape a clear verdict for the UI
  if (result.ok && "skipped" in result && result.skipped) {
    return NextResponse.json({
      status: "skipped",
      to,
      config,
      detail:
        "sendEmail no-op: RESEND_API_KEY and/or EMAIL_FROM are not set in this environment.",
    });
  }
  if (!result.ok) {
    return NextResponse.json({
      status: "error",
      to,
      config,
      error: result.error,
    });
  }
  return NextResponse.json({ status: "sent", to, config });
}
