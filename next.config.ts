import type { NextConfig } from "next";

// Baseline security headers (audit M-D). A full Content-Security-Policy is
// deferred to Phase 10 — it needs a nonce for the inline theme-init script
// (app/layout.tsx) and an explicit allowlist for Supabase/Ably/LiveKit/
// Sportmonks origins. These four are safe to ship now and cover clickjacking,
// MIME sniffing, referrer leakage, and transport downgrade.
const securityHeaders = [
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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
