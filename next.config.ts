import type { NextConfig } from "next";

// Content-Security-Policy (Phase 10 security closeout). The directives that
// can't break the cert-gated audio path are enforced strictly — frame-ancestors
// (clickjacking), object-src, base-uri, form-action. The transport/media
// directives are deliberately permissive so they never block Ably, LiveKit
// HLS/WebRTC, Supabase realtime, the AudioWorklet, or link-preview images:
//   - script-src keeps 'unsafe-inline' because the theme-init script
//     (app/layout.tsx) interpolates the per-user theme pref, so neither a
//     static hash nor a no-middleware nonce fits. blob: covers AudioWorklet.
//   - connect-src / media-src allow any https:/wss: rather than enumerating
//     Ably's fallback hosts and LiveKit's regional + egress CDN domains, which
//     can't be exhaustively verified without a live broadcast. They still block
//     cleartext http:.
// FUTURE (tighten after a live audio test): nonce-based script-src via
// middleware, and an explicit connect-src/media-src origin allowlist.
//
// script-src is mode-aware: `next dev` (Fast Refresh/HMR) needs full
// 'unsafe-eval'; production gets only the narrow 'wasm-unsafe-eval' so
// LiveKit's audio WASM can still compile without permitting JS eval().
const scriptSrc =
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:";
const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "media-src 'self' blob: https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// X-Frame-Options is kept alongside frame-ancestors for pre-CSP3 browsers.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

// Avatars now upload to our own Supabase Storage `avatars` bucket, so next/image
// is locked to that host instead of any-https. The optimizer already meant the
// browser only ever hit /_next/image on our origin (killing the tracking-pixel
// IP-harvest vector; audit 2026-07-02), but pinning the upstream host removes
// the SSRF-ish "optimizer fetches an arbitrary attacker URL" surface too. The
// `*.supabase.{co,in}` wildcards cover any Supabase project; the derived host
// covers a custom storage domain. Path is pinned to public storage objects.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || null;
  } catch {
    return null;
  }
})();
const avatarRemotePatterns: NonNullable<
  NextConfig["images"]
>["remotePatterns"] = [
  {
    protocol: "https",
    hostname: "*.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
  {
    protocol: "https",
    hostname: "*.supabase.in",
    pathname: "/storage/v1/object/public/**",
  },
];
if (
  supabaseHost &&
  !supabaseHost.endsWith(".supabase.co") &&
  !supabaseHost.endsWith(".supabase.in")
) {
  avatarRemotePatterns.push({
    protocol: "https",
    hostname: supabaseHost,
    pathname: "/storage/v1/object/public/**",
  });
}

const nextConfig: NextConfig = {
  // ffmpeg-static ships a real binary; keep it out of the server bundle so
  // its __dirname-relative path resolves to node_modules, not .next.
  serverExternalPackages: ["ffmpeg-static"],
  images: {
    remotePatterns: avatarRemotePatterns,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // FR-18.3: profiles moved from /u/{username} to root /{username};
      // old links redirect permanently (true 301, not 308)
      {
        source: "/u/:username",
        destination: "/:username",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
