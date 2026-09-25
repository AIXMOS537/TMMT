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
      // The four tables that had two admin screens each, both in the sidebar,
      // so which app you got depended on which link you clicked. The
      // /interfaces/* generation won — it has the kanban, calendar, charts and
      // detail panel, and it now carries the export and add-record the older
      // pages had. These keep old bookmarks and any link already sent out
      // working. Not permanent: 307, so nothing is cached into a browser if
      // these paths are ever wanted for something else.
      { source: "/appointments", destination: "/interfaces/appointments", permanent: false },
      { source: "/contracts", destination: "/interfaces/contracts", permanent: false },
      { source: "/payments", destination: "/interfaces/payments", permanent: false },
      { source: "/fleet", destination: "/interfaces/vehicles", permanent: false },

      // /credit and /funding are TMMT's own front doors, not the partner's.
      //
      // These two used to 307 straight to allinonemanagementsolutions.com, on
      // every host, before middleware even ran — so anyone who typed a TMMT
      // address, clicked a TMMT ad, or scanned a TMMT QR code landed on the
      // partner's homepage and the lead was gone. Sending a visitor to the
      // partner is a referral we give away; it is opt-in only now and lives on
      // /partners/all-in-one behind a form (see src/lib/partner-handoff.ts).
      // These land on our own credit + funding intake instead, which captures
      // the lead into TMMT and carries the opt-in box.
      {
        source: "/funding",
        destination: "/forms/credit-funding-intake?entry=funding",
        permanent: false,
      },
      {
        source: "/credit",
        destination: "/forms/credit-funding-intake?entry=credit",
        permanent: false,
      },

      // Customer-facing audit fixes (2026-09-24). Not permanent: 307, so
      // nothing is cached into a browser if these paths are ever wanted for
      // something else.
      //
      // /rent was never a page — signed-out visitors hit the middleware gate
      // and landed on the staff login. The hero "Rent a car" CTA goes to the
      // lead-intake form, so /rent should too.
      { source: "/rent", destination: "/forms/lead-intake", permanent: false },
      { source: "/rent/:path*", destination: "/forms/lead-intake", permanent: false },

      // Legacy legal/help paths that used to dead-end at the staff login.
      { source: "/terms", destination: "/legal/rental", permanent: false },
      { source: "/privacy", destination: "/legal/privacy", permanent: false },
      { source: "/sms-policy", destination: "/legal/sms", permanent: false },
      { source: "/help", destination: "/forms/ticket", permanent: false },
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
