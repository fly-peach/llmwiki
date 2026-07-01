import type { NextConfig } from "next";
import path from "path";

// Dev server (next dev) only trusts localhost for HMR by default, which breaks
// hot reloading when browsing via a LAN IP or tunneled host. Next.js does NOT
// accept a "*" wildcard here — it does exact string matching against the full
// origin. So we enumerate the origins we actually want to browse from:
//   - localhost / 127.0.0.1 (loopback, any port)
//   - the local machine's LAN IP (current host)
//   - common private ranges, so other LAN devices / different ports work too
// For any other origin, the page still loads fine — only the HMR websocket is
// rejected, which is harmless (you just lose auto-reload in that tab).
const devPorts = ["3000", "3001", "8000", "8001"];
const lanHosts = ["localhost", "127.0.0.1", "0.0.0.0"];
for (let third = 0; third <= 255; third++) {
  lanHosts.push(`192.168.${third}`);
  lanHosts.push(`10.0.${third}`);
  lanHosts.push(`172.16.${third}`);
}
const allowedDevOrigins = lanHosts.flatMap((host) =>
  devPorts.map((port) => `http://${host}:${port}`)
);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins,
};

export default nextConfig;
