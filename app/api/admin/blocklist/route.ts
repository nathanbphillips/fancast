import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { isAdmin } from "@/lib/roles";

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Enter a bare domain like example.com");

/** Admin-editable domain blocklist (FR-9.3). */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = z
    .object({ domain: domainSchema, reason: z.string().max(300).optional() })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { error } = await service.from("blocklist_domains").upsert({
    domain: parsed.data.domain,
    reason: parsed.data.reason ?? null,
    added_by: caller.userId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ blocked: parsed.data.domain }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;
  if (!isAdmin(caller.userId, caller.profile)) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const parsed = z
    .object({ domain: domainSchema })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid domain." }, { status: 400 });
  }

  const service = createServiceClient();
  await service
    .from("blocklist_domains")
    .delete()
    .eq("domain", parsed.data.domain);
  return NextResponse.json({ unblocked: parsed.data.domain });
}
