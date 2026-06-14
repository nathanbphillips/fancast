import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static ships a real binary; keep it out of the server bundle so
  // its __dirname-relative path resolves to node_modules, not .next.
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
