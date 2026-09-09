import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["@aixmos/core"],
  // Dev-only: the tailnet hosts carry serves from. Without these, `next dev`
  // blocks /_next/* as a cross-origin request when the app is opened over
  // Tailscale, React never hydrates, and the login <form> falls back to a
  // native GET — putting email + password in the URL and the server log.
  allowedDevOrigins: [
    "watchtower.tailceb455.ts.net",
    "100.77.126.8",
  ],
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

      // Phase 9 short aliases for marketing surfaces (email, SMS, bio links).
      // Permanent (308) so browsers cache; UTM defaults can be overridden by callers passing their own.
      // Public marketing lives on the GHL site (allinonemanagementsolutions.com).
      // Temporary (307) on purpose so the destination can change without
      // browsers caching a dead hop (the old 308 pointed at the retired landing).
      {
        source: "/funding",
        destination:
          "https://allinonemanagementsolutions.com/?utm_source=tmmt-ops&utm_medium=redirect&utm_campaign=credit",
        permanent: false,
      },
      {
        source: "/credit",
        destination:
          "https://allinonemanagementsolutions.com/?utm_source=tmmt-ops&utm_medium=redirect&utm_campaign=credit",
        permanent: false,
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
