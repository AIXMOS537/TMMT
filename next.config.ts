import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const VENTURE = "tmmt-rentals";

const legacyAdminRedirects = [
  "fleet",
  "leads",
  "customers",
  "payments",
  "background-checks",
  "waitlist",
  "appointments",
  "former-customers",
  "do-not-rent",
  "inspections",
  "maintenance",
  "insurance",
  "tickets",
  "expenses",
  "contracts",
  "vendors",
  "operation-costs",
  "interfaces/appointments",
  "interfaces/contracts",
  "interfaces/vehicles",
  "interfaces/payments",
].map((segment) => ({
  source: `/${segment}`,
  destination: `/v/${VENTURE}/${segment}`,
  permanent: true,
}));

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  async redirects() {
    return legacyAdminRedirects;
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
