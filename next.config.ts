import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@aixmos/core"],
  turbopack: {
    root: repoRoot,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async rewrites() {
    return [
      // Legacy engine paths → unified Learn face
      { source: "/onboarding", destination: "/learn/onboarding" },
      { source: "/dashboard", destination: "/learn/dashboard" },
      { source: "/coach", destination: "/learn/coach" },
      { source: "/consent", destination: "/learn/consent" },
      { source: "/status", destination: "/learn/status" },
      { source: "/documents", destination: "/learn/documents" },
      { source: "/products", destination: "/learn/products" },
      { source: "/questionnaire/:path*", destination: "/learn/questionnaire/:path*" },
      { source: "/application/:path*", destination: "/learn/application/:path*" },
      // src/app/api/agent/_health/route.ts can never be reached on its own:
      // the App Router treats a leading underscore as a private folder and
      // excludes it from routing entirely. External monitors already point at
      // this URL, so map it onto the real handler rather than moving it and
      // breaking them.
      { source: "/api/agent/_health", destination: "/api/agent/health" },
    ];
  },
  async redirects() {
    return [
      // Phase 9 short aliases for marketing surfaces (email, SMS, bio links).
      // Permanent (308) so browsers cache; UTM defaults can be overridden by callers passing their own.
      {
        source: "/funding",
        destination: "https://aixmos-landing.vercel.app/forms",
        permanent: true,
      },
      {
        source: "/credit",
        destination: "https://aixmos-landing.vercel.app/forms",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.mxpnl.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://*.sentry.io https://api.mixpanel.com https://api-js.mixpanel.com",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // `disableLogger` is deprecated in @sentry/nextjs v10; this is its replacement.
  webpack: { treeshake: { removeDebugLogging: true } },
});
