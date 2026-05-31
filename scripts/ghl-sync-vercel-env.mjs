#!/usr/bin/env node
/**
 * Push GHL-related env vars from .env → Vercel project tmmt-c919.
 * Usage:
 *   node scripts/ghl-sync-vercel-env.mjs              # production only
 *   node scripts/ghl-sync-vercel-env.mjs --all-envs   # production + preview + development
 *
 * Requires: vercel CLI logged in, values filled in .env (see .env.example).
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const scope = "aixmos537";
const project = "tmmt-c919";

const GHL_KEYS = [
  "GHL_WEBHOOK_SECRET",
  "NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT",
  "NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT_USB",
  "NEXT_PUBLIC_GHL_CHECKOUT_OPS_MONTHLY",
  "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT",
  "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT_USB",
  "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_MONTHLY",
  "NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE",
  "NEXT_PUBLIC_GHL_CHECKOUT_DEALER_MONTHLY",
  "NEXT_PUBLIC_GHL_CHECKOUT_97",
  "NEXT_PUBLIC_GHL_CHECKOUT_LLC",
  "NEXT_PUBLIC_GHL_CHECKOUT_3750",
  "NEXT_PUBLIC_GHL_OPERATOR_APPLY",
  "NEXT_PUBLIC_GHL_CREDIT_GUIDANCE",
  "NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL",
  "NEXT_PUBLIC_SUPPORT_PHONE",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
];

function loadDotEnv() {
  if (!existsSync(envPath)) {
    console.error("Missing .env — copy .env.example and fill GHL checkout URLs.");
    process.exit(1);
  }
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function isPlaceholder(v) {
  if (!v) return true;
  return v.includes("YOUR_GHL") || v === "https://app.gohighlevel.com/";
}

const allEnvs = process.argv.includes("--all-envs");
const envs = allEnvs ? ["production", "preview", "development"] : ["production"];
const vars = loadDotEnv();

const toSync = GHL_KEYS.filter((k) => vars[k] && !isPlaceholder(vars[k]));
if (toSync.length === 0) {
  console.error("No GHL vars to sync — fill checkout URLs in .env first.");
  process.exit(1);
}

console.log(`Syncing ${toSync.length} var(s) to ${scope}/${project} (${envs.join(", ")})…\n`);

let failed = 0;
for (const key of toSync) {
  for (const env of envs) {
    const args = [
      "env",
      "add",
      key,
      env,
      "--value",
      vars[key],
      "--yes",
      "--force",
      "--scope",
      scope,
    ];
    console.log(`→ ${key} (${env})`);
    const r = spawnSync("vercel", args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, VERCEL_PROJECT_ID: project },
    });
    if (r.status !== 0) {
      console.error(`  failed (${r.status})`);
      failed++;
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} add(s) failed. Link project: vercel link --project ${project} --scope ${scope}`);
  process.exit(1);
}

console.log("\nDone. Redeploy tmmt-c919 (dashboard or: vercel redeploy --prod).");
