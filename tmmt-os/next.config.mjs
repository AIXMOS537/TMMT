/** @type {import('next').NextConfig} */
const productionHost =
  process.env.NEXT_PUBLIC_APP_HOST ?? "tmmt-c919-two.vercel.app";

const serverActionOrigins = new Set([
  "localhost:3000",
  productionHost,
  "tmmt-ops.vercel.app",
  "tmmt-ops-muhammad-tahas-projects-7644a317.vercel.app",
]);

if (process.env.VERCEL_URL) {
  serverActionOrigins.add(process.env.VERCEL_URL);
}

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const RENTALS_VENTURE = "tmmt-rentals";
const legacyRentalsRedirects = [
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
  destination: `/v/${RENTALS_VENTURE}/${segment}`,
  permanent: true,
}));

const supabaseConnectSrc = supabaseHost ? ` https://${supabaseHost}` : " https://*.supabase.co";

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return legacyRentalsRedirects;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
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
              `connect-src 'self'${supabaseConnectSrc} https://*.sentry.io`,
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: supabaseHost
    ? { remotePatterns: [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/**" }] }
    : undefined,
  experimental: {
    serverActions: {
      allowedOrigins: [...serverActionOrigins],
    },
  },
};

export default nextConfig;
