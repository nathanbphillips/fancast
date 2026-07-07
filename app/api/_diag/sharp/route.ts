import { NextResponse, type NextRequest } from "next/server";

/**
 * TEMPORARY diagnostic (remove after fixing avatar uploads). Reports whether
 * sharp's native binary loads on the Vercel Linux runtime and, if not, the
 * exact error. sharp's own load error names precisely which @img/* platform
 * package it couldn't find, which is all we need to craft the fix. No user
 * data; leaks only a library/runtime error string. Gated behind ?probe=1.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 20;

function info(err: unknown) {
  return err instanceof Error
    ? {
        name: err.name,
        message: err.message,
        stack: err.stack?.split("\n").slice(0, 8),
      }
    : { message: String(err) };
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("probe") !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const out: Record<string, unknown> = {
    build: "trace-fix",
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
  };

  try {
    const mod = await import("sharp");
    const sharp = mod.default;
    out.import = { ok: true, versions: sharp.versions };
    try {
      // exercise the native pipeline end to end on a 2x2 PNG
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQz0AEYBxVSFsUAP9nBftFEjV0AAAAAElFTkSuQmCC",
        "base64",
      );
      const webp = await sharp(png).resize(2, 2).webp().toBuffer();
      out.encode = { ok: true, bytes: webp.length };
    } catch (err) {
      out.encode = { ok: false, error: info(err) };
    }
  } catch (err) {
    out.import = { ok: false, error: info(err) };
  }

  return NextResponse.json(out);
}
