import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import {
  createSupabaseServerClient,
  createServiceClient,
} from "@/lib/db/server";
import type { Profile } from "@/lib/db/types";
import { adminUserIds } from "@/lib/roles";

const usernameSchema = z
  .string()
  .regex(
    config.usernamePattern,
    "Username must be 3-20 characters: letters, numbers, underscore.",
  );

const createSchema = z.object({ username: usernameSchema });

const updateSchema = z
  .object({
    username: usernameSchema.optional(),
    theme_pref: z.enum(["dark", "light"]).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update." });

/** Create the caller's profile (first sign-in username pick). */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: existing } = await service
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Profile already exists." },
      { status: 409 },
    );
  }

  const role = adminUserIds().includes(user.id) ? "admin" : "listener";
  const { data, error } = await service
    .from("profiles")
    .insert({ user_id: user.id, username: parsed.data.username, role })
    .select()
    .single<Profile>();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That username is taken." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data }, { status: 201 });
}

/** Update the caller's own profile (username with 30-day lock, theme). */
export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Profile>();
  if (!profile) {
    return NextResponse.json({ error: "No profile yet." }, { status: 404 });
  }

  const update: Partial<Profile> = {};

  if (parsed.data.theme_pref !== undefined) {
    update.theme_pref = parsed.data.theme_pref;
  }

  if (
    parsed.data.username !== undefined &&
    parsed.data.username.toLowerCase() !== profile.username.toLowerCase()
  ) {
    if (profile.username_changed_at) {
      const lockMs = config.usernameChangeLockDays * 24 * 60 * 60 * 1000;
      const unlocksAt =
        new Date(profile.username_changed_at).getTime() + lockMs;
      if (Date.now() < unlocksAt) {
        return NextResponse.json(
          {
            error: `Username can change again on ${new Date(unlocksAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`,
          },
          { status: 403 },
        );
      }
    }
    update.username = parsed.data.username;
    update.username_changed_at = new Date().toISOString();
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ profile });
  }

  const { data, error } = await service
    .from("profiles")
    .update(update)
    .eq("user_id", user.id)
    .select()
    .single<Profile>();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That username is taken." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}
