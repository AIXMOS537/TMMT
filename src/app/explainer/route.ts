import { readFileSync } from "fs";
import { join } from "path";

/**
 * Serves the colorful kid-friendly explainer page at /explainer.
 *
 * Reads the HTML at build time from public/explainer.html so the asset
 * ships with the deployment regardless of Vercel's static-file quirks.
 * Force-static so Vercel CDN caches it aggressively after first hit.
 */
export const dynamic = "force-static";
export const revalidate = false;

const html = readFileSync(
  join(process.cwd(), "public", "explainer.html"),
  "utf-8"
);

export function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
