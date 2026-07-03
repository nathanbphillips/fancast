import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { config } from "@/lib/config";
import { isReservedUsername } from "@/lib/reserved-usernames";
import {
  createSupabaseServerClient,
  createServiceClient,
} from "@/lib/db/server";
import type { Profile } from "@/lib/db/types";
import { adminUserIds } from "@/lib/roles";
import { THEME_COOKIE, themeCookieOptions } from "@/lib/theme";

const usernameSchema = z
  .string()
  .regex(
    config.usernamePattern,
    "Username must be 3-20 characters: letters, numbers, underscore.",
  )
  // FR-18.3: profiles live at root /{username}, so route names can never be
  // usernames (enforced at create AND change; migration 0026 asserted no
  // existing collision)
  .refine((u) => !isReservedUsername(u), {
    message: "That username isn't available.",
  });

const createSchema = z.object({ username: usernameSchema });

// Avatar is a free-text image URL for the MVP (no upload bucket yet). Require
// https to avoid mixed content; empty string clears it back to the initial-circle
// fallback. Bare-bones profile fields (FR-2.x); file upload is a later slice.
const avatarSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), {
    message: "Avatar must be an https:// image URL.",
  });

const updateSchema = z
  .object({
    username: usernameSchema.optional(),
    avatar_url: avatarSchema.optional(),
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

  if (parsed.data.avatar_url !== undefined) {
    update.avatar_url = parsed.data.avatar_url === "" ? null : parsed.data.avatar_url;
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

  // Mirror the account theme into the readable cookie so the pre-paint script
  // picks it up on the next load with no flash (M-11). Delete it when cleared.
  if (parsed.data.theme_pref !== undefined) {
    const jar = await cookies();
    if (parsed.data.theme_pref) {
      jar.set(THEME_COOKIE, parsed.data.theme_pref, themeCookieOptions);
    } else {
      jar.delete({ name: THEME_COOKIE, path: "/" });
    }
  }

  return NextResponse.json({ profile: data });
}
