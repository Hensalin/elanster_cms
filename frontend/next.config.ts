import type { NextConfig } from "next";

// FRONTEND: the admin screens only. Every /api/... call is passed to the backend app,
// so the browser talks to one address and the sign-in cookie just works.
const BACKEND = (process.env.BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");
const security = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
const nextConfig: NextConfig = {
  // The admin screens are all client-side, so Next.js "instant navigation" checks only add dev warnings.
  cacheComponents: false,
  devIndicators: false,
  async rewrites() { return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }, { source: "/preview/:path*", destination: `${BACKEND}/preview/:path*` }]; },
  async headers() { return [{ source: "/((?!api/).*)", headers: security }]; },
};
export default nextConfig;
