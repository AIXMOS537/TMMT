#!/usr/bin/env node
/**
 * Build PARTNER_APP_WEBHOOKS_JSON from scripts/ghl-dispatch/locations.json
 * Usage: node scripts/ghl-dispatch/build-partner-webhooks-env.mjs [--write-env-local]
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { loadEnvLocal, readLocationsConfig, ROOT } from "./load-env.mjs";

loadEnvLocal();

const writeEnv = process.argv.includes("--write-env-local");
const cfg = readLocationsConfig();
const map = {};

for (const loc of cfg.locations) {
  const url = loc.webhook_url?.trim();
  if (!url) {
    console.warn(`SKIP (no webhook_url): ${loc.partner_app_slug} — ${loc.name}`);
    continue;
  }
  if (!url.includes("leadconnectorhq.com/hooks")) {
    console.warn(`WARN: ${loc.partner_app_slug} URL may not be a GHL inbound hook: ${url}`);
  }
  map[loc.partner_app_slug] = { url };
}

const json = JSON.stringify(map);
const line = `PARTNER_APP_WEBHOOKS_JSON=${json}`;

console.log("\n# Paste into Vercel (or .env.local):\n");
console.log(line);

const missing = cfg.locations.filter((l) => !l.webhook_url?.trim());
if (missing.length) {
  console.log("\n# Still need webhook URLs for:");
  for (const m of missing) {
    console.log(`#   ${m.partner_app_slug} — ${m.name}`);
    console.log(`#   ${m.launchpad}`);
  }
}

if (writeEnv && Object.keys(map).length > 0) {
  const envPath = resolve(ROOT, ".env.local");
  let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (/^PARTNER_APP_WEBHOOKS_JSON=/m.test(content)) {
    content = content.replace(/^PARTNER_APP_WEBHOOKS_JSON=.*$/m, line);
  } else {
    content = content.trimEnd() + (content.endsWith("\n") ? "" : "\n") + "\n" + line + "\n";
  }
  writeFileSync(envPath, content);
  console.log("\nWrote PARTNER_APP_WEBHOOKS_JSON to .env.local");
}

process.exit(missing.length && !Object.keys(map).length ? 1 : 0);
