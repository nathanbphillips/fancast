import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Avatar upload constants + guards. Uploads are re-encoded server-side to a
 * fixed small WebP (that single step strips metadata, normalizes the format,
 * and neutralizes embedded payloads), so the stored file is tiny and safe
 * regardless of what came in. SVG is never accepted (it can carry scripts).
 */

export const AVATAR_BUCKET = "avatars";
/** hard cap on the uploaded body before we even decode it */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
/** stored avatar edge length */
export const OUTPUT_SIZE = 256;
/** decompression-bomb guard: refuse to fully decode past this pixel count */
export const MAX_INPUT_PIXELS = 30_000_000; // ~5477 x 5477

/** Sniff the real image type from magic bytes (never trust the extension or
 *  the client Content-Type). Returns null for anything we won't accept,
 *  including SVG. */
export function sniffRasterImage(
  buf: Buffer,
): "png" | "jpeg" | "webp" | null {
  if (buf.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  // WebP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

let ensured = false;
/** Create the public avatars bucket if missing (once per server instance).
 *  fileSizeLimit + allowedMimeTypes are bucket-level defense in depth. */
export async function ensureAvatarBucket(
  service: SupabaseClient,
): Promise<void> {
  if (ensured) return;
  const { data } = await service.storage.getBucket(AVATAR_BUCKET);
  if (!data) {
    await service.storage.createBucket(AVATAR_BUCKET, {
      public: true,
      fileSizeLimit: MAX_UPLOAD_BYTES,
      allowedMimeTypes: ["image/webp"],
    });
  } else if (!data.public) {
    await service.storage.updateBucket(AVATAR_BUCKET, { public: true });
  }
  ensured = true;
}
