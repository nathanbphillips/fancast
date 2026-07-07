import { NextResponse, type NextRequest } from "next/server";
import { requireParticipant } from "@/lib/api";
import { createServiceClient } from "@/lib/db/server";
import { rateLimit } from "@/lib/ratelimit";
import {
  AVATAR_BUCKET,
  MAX_INPUT_PIXELS,
  MAX_UPLOAD_BYTES,
  OUTPUT_SIZE,
  ensureAvatarBucket,
  sniffRasterImage,
} from "@/lib/avatars";

// image processing needs a bit of headroom
export const maxDuration = 30;

/**
 * Avatar upload (owner-only). Every image is sniffed by magic bytes, decoded
 * under a pixel cap (decompression-bomb guard), and re-encoded to a fixed 256px
 * WebP before storage. The re-encode strips metadata and neutralizes embedded
 * payloads, so the stored file is always small and safe. SVG is rejected.
 *
 * sharp is imported lazily (not at module top) so a load failure surfaces as a
 * clean handled error rather than crashing the whole route module. Its native
 * Linux binary is force-included in the function trace via
 * `outputFileTracingIncludes` in next.config.ts (nft otherwise drops the
 * separate @img/sharp-libvips-linux-x64 package and the route 500s on Vercel).
 */
export async function POST(request: NextRequest) {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  if (!rateLimit(`avatar:${caller.userId}`, 12, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many uploads. Try again later." },
      { status: 429 },
    );
  }

  // early reject an oversize body before buffering it
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared && declared > MAX_UPLOAD_BYTES + 4096) {
    return NextResponse.json(
      { error: "That image is too large (4 MB max)." },
      { status: 413 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image sent." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "That image is too large (4 MB max)." },
      { status: 413 },
    );
  }

  const input = Buffer.from(await file.arrayBuffer());
  // magic-byte check: never trust the extension or the Content-Type; SVG and
  // anything non-raster are rejected here
  if (!sniffRasterImage(input)) {
    return NextResponse.json(
      { error: "Upload a PNG, JPEG, or WebP image." },
      { status: 415 },
    );
  }

  let output: Buffer;
  try {
    const sharp = (await import("sharp")).default;
    output = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate() // apply EXIF orientation before it is stripped
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "Couldn't process that image. Try another." },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  await ensureAvatarBucket(service);

  const path = `${caller.userId}.webp`;
  const { error: upErr } = await service.storage
    .from(AVATAR_BUCKET)
    .upload(path, output, { contentType: "image/webp", upsert: true });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = service.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // cache-bust: the object path is stable across changes, so version the URL
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await service
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("user_id", caller.userId);
  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl });
}

/** Remove the caller's avatar (deletes the stored file + clears the column). */
export async function DELETE() {
  const caller = await requireParticipant();
  if (caller.error) return caller.error;

  const service = createServiceClient();
  await service.storage
    .from(AVATAR_BUCKET)
    .remove([`${caller.userId}.webp`])
    .catch(() => null);
  await service
    .from("profiles")
    .update({ avatar_url: null })
    .eq("user_id", caller.userId);
  return NextResponse.json({ ok: true });
}
