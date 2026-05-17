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

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: [...serverActionOrigins],
    },
  },
};

export default nextConfig;
