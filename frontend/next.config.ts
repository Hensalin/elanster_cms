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
// Content Security Policy (production): only this app's own scripts run; pictures may come from any https address;
// the page editor may show the real websites in its preview frame. ('unsafe-inline' is needed by Next.js start-up scripts.)
const csp = ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:", "connect-src 'self'", "frame-src https: http:", "frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join("; ");
if (process.env.NODE_ENV === "production") security.push({ key: "Content-Security-Policy", value: csp });
const nextConfig: NextConfig = {
  // The admin screens are all client-side, so Next.js "instant navigation" checks only add dev warnings.
  cacheComponents: false,
  devIndicators: false,
  poweredByHeader: false,
  async rewrites() { return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }, { source: "/preview/:path*", destination: `${BACKEND}/preview/:path*` }]; },
  async headers() { return [{ source: "/((?!api/).*)", headers: security }]; },
};
export default nextConfig;
