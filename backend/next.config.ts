import type { NextConfig } from "next";

// BACKEND: database, sign-in, all /api/v1 endpoints and the article preview page. No admin screens here.
const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  async headers() { return [{ source: "/((?!api/v1/websites|api/v1/media).*)", headers: security }]; },
  // Opening the backend address in a browser goes to the admin app (set FRONTEND_URL in Vercel).
  async redirects() {
    const fe = process.env.FRONTEND_URL;
    return fe ? [{ source: "/", destination: fe, permanent: false }, { source: "/login", destination: fe + "/login", permanent: false }] : [];
  },
};
export default nextConfig;
