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
    ];
  },
  async redirects() {
    return [
      // Phase 9 short aliases for marketing surfaces (email, SMS, bio links).
      // Permanent (308) so browsers cache; UTM defaults can be overridden by callers passing their own.
      {
        source: "/funding",
        destination: "/forms/credit-funding-intake?utm_source=shortlink&utm_medium=direct&utm_campaign=funding_alias",
        permanent: true,
      },
      {
        source: "/credit",
        destination: "/forms/credit-funding-intake?utm_source=shortlink&utm_medium=direct&utm_campaign=credit_alias",
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://*.sentry.io",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, { silent: true, disableLogger: true });
