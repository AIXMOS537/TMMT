#!/usr/bin/env node
/**
 * Go-live orchestrator — runs safe checks in order. Does not mutate prod unless --apply.
 *
 * Usage:
 *   node scripts/go-live.mjs              # audit only
 *   node scripts/go-live.mjs --apply      # provision CSV + test prod webhook
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { loadProjectEnv, root } from "./load-env.mjs";

const apply = process.argv.includes("--apply");
const node = process.execPath;

function run(label, args, opts = {}) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(node, args, { cwd: root, stdio: "inherit", ...opts });
  return r.status ?? 1;
}

loadProjectEnv();

console.log("=== TMMT Go-Live Runner ===");
console.log(`Mode: ${apply ? "APPLY (mutates)" : "AUDIT ONLY"}\n`);

let failed = 0;

failed += run("Env check", [join(root, "scripts/check-env.mjs")]) ? 1 : 0;
failed += run("GHL revenue check", [join(root, "scripts/ghl-activation-check.mjs")]) ? 1 : 0;

if (process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID) {
  run("GHL product discovery", [join(root, "scripts/ghl-discover-products.mjs")]);
} else {
  console.log("\n○ Skip GHL discover — GHL_API_KEY or GHL_LOCATION_ID missing");
}

const csv = join(root, "operators.csv");
const csvExample = join(root, "operators.csv.example");
if (existsSync(csv)) {
  failed += run(
    apply ? "Provision operators (live)" : "Provision operators (dry-run)",
    [join(root, "scripts/provision-operators.mjs"), "--file", "operators.csv", ...(apply ? [] : ["--dry-run"])]
  )
    ? 1
    : 0;
} else {
  console.log(`\n○ No operators.csv — copy operators.csv.example → operators.csv and add real emails`);
  if (existsSync(csvExample)) {
    run("Provision example (dry-run)", [
      join(root, "scripts/provision-operators.mjs"),
      "--file",
      "operators.csv.example",
      "--dry-run",
    ]);
  }
}

if (process.env.GHL_WEBHOOK_SECRET) {
  const base = process.env.GHL_TEST_BASE_URL || "https://tmmt-ops.vercel.app";
  console.log(`\n▶ Prod webhook smoke (${base})`);
  failed += run("Webhook payment test", [
    join(root, "scripts/test-ghl-webhook.mjs"),
    "payment",
    base,
  ])
    ? 1
    : 0;
}

console.log("\n=== Manual gates (cannot automate) ===");
console.log("1. Create GHL checkout products + paste URLs into .env → npm run ghl:sync-vercel");
console.log("2. GHL workflow → POST /api/webhooks/ghl (see docs/GHL-WEBHOOK-SETUP.md)");
console.log("3. Hand operators OPERATOR-START-HERE.md");
console.log("4. Dealers → docs/sales/DEALER-KIT-ONE-PAGER.md (separate instance, not shared DB)");

process.exit(failed ? 1 : 0);
