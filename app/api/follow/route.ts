import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createSupabaseServerClient,
  createServiceClient,
} from "@/lib/db/server";

const bodySchema = z.object({ commentatorId: z.uuid() });

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Follow a commentator. */
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { commentatorId } = parsed.data;
  if (commentatorId === user.id) {
    return NextResponse.json(
      { error: "You can't follow yourself." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: target } = await service
    .from("profiles")
    .select("role")
    .eq("user_id", commentatorId)
    .maybeSingle();
  if (!target || target.role !== "commentator") {
    return NextResponse.json(
      { error: "You can only follow commentators." },
      { status: 400 },
    );
  }

  const { error } = await service
    .from("follows")
    .upsert(
      { follower_id: user.id, commentator_id: commentatorId },
      { onConflict: "follower_id,commentator_id", ignoreDuplicates: true },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Unfollow a commentator. */
export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("commentator_id", parsed.data.commentatorId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
