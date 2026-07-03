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

const nextConfig: NextConfig = {
  // ffmpeg-static ships a real binary; keep it out of the server bundle so
  // its __dirname-relative path resolves to node_modules, not .next.
  serverExternalPackages: ["ffmpeg-static"],
  // Avatars are user-supplied https URLs rendered through next/image, so the
  // BROWSER only ever hits /_next/image on our origin — the optimizer fetches
  // the upstream server-side and caches it, killing the tracking-pixel vector
  // (a hostile avatar host would otherwise log every room participant's IP;
  // audit 2026-07-02). The URL itself is validated at write time in
  // /api/profile; any https host is permitted here on purpose.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
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
