import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/server";
import { rateLimit, clientIp } from "@/lib/ratelimit";

/**
 * Public pre-launch email capture (front-end review item 7). Open + anonymous,
 * so it's IP rate-limited and writes through the service role into a table with
 * no anon-readable policy (the address list can't be harvested; see migration
 * 0036). Idempotent: a repeat address is a no-op, not an error.
 */

// email kept deliberately loose (one @, a dot in the domain); we normalize case
const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const schema = z.object({
  email: z.string().trim().max(254).refine((v) => emailRe.test(v), {
    message: "Enter a valid email.",
  }),
  source: z.string().trim().max(40).optional(),
});

export async function POST(request: NextRequest) {
  if (!rateLimit(`waitlist:${clientIp(request)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many tries. Try again later." },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { error } = await service.from("waitlist").upsert(
    {
      email: parsed.data.email.toLowerCase(),
      source: parsed.data.source ?? null,
    },
    { onConflict: "email", ignoreDuplicates: true },
  );
  if (error) {
    return NextResponse.json(
      { error: "Couldn't save that. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
