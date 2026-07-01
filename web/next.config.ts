import type { NextConfig } from "next";
import path from "path";

// Next.js blocks cross-origin requests to dev resources (HMR websocket, RSC
// payloads) unless the browsing host is in `allowedDevOrigins`. The matcher
// compares against the *hostname only* (no protocol/port) and supports per-
// segment `*` wildcards, so `*.*.*.*` matches any 4-octet IPv4 hostname.
// Regular page loads still work from any host; this only unblocks dev/HMR for
// LAN browsing (e.g. http://192.168.18.78:3000 from another device).
const allowedDevOrigins = [
  "*.*.*.*",
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins,
};

export default nextConfig;
