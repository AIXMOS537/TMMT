import fs from "node:fs";
import path from "node:path";

const APP_DIR = path.join(process.cwd(), "src", "app");

/**
 * Walk src/app and derive the live route list from page.tsx files.
 *
 * Derived, never hand-maintained: a route added to the app is audited on the
 * next run without anyone remembering to update a list. Route groups —
 * `(admin)`, `(auth)` — are organisational only and contribute no URL segment,
 * so they are stripped. Dynamic segments (`[id]`) are skipped: the crawler has
 * no way to invent a valid param, and a 404 from a made-up id is noise, not a
 * finding.
 */
export function discoverRoutes(dir: string = APP_DIR, prefix = ""): string[] {
  const routes: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("[")) continue; // dynamic — no safe param to supply
      if (entry.name.startsWith("_")) continue; // private folder, not routable
      const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
      const nextPrefix = isGroup ? prefix : `${prefix}/${entry.name}`;
      routes.push(...discoverRoutes(path.join(dir, entry.name), nextPrefix));
    } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
      routes.push(prefix === "" ? "/" : prefix);
    }
  }

  return routes.sort();
}

/** Routes reachable without a session. Everything else is behind middleware. */
export const PUBLIC_ROUTES = new Set(
  discoverRoutes().filter((r) => r === "/login" || r.startsWith("/forms/"))
);

export const ALL_ROUTES = discoverRoutes();
export const ADMIN_ROUTES = ALL_ROUTES.filter((r) => !PUBLIC_ROUTES.has(r));
