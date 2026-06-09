#!/usr/bin/env node
/**
 * Push GHL-related env vars from .env → Vercel projects tmmt-ops + tmmt-command-center.
 *
 * Targets BOTH live Vercel apps in one run:
 *   - tmmt-ops (canonical, hosts /kits, /forms, /build)
 *   - tmmt-command-center (staff/owner login portal)
 *
 * Usage:
 *   node scripts/ghl-sync-vercel-env.mjs              # production only
 *   node scripts/ghl-sync-vercel-env.mjs --all-envs   # production + preview + development
 *
 * Requires: vercel CLI logged in, values filled in .env (see .env.example).
 *
 * Side effect: temporarily relinks .vercel/project.json per project; relinks back
 * to the canonical project (tmmt-ops) at the end so dev workflows stay correct.
 */
import { loadProjectEnv, root } from "./load-env.mjs";
import { spawnSync } from "child_process";

const scope = "aixmos537";

// Projects to push env vars to. Order matters: canonical last so we leave the
// repo linked to it at exit.
const PROJECTS = ["tmmt-command-center", "tmmt-ops"];
const CANONICAL_PROJECT = "tmmt-ops";

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
  "NEXT_PUBLIC_GHL_CHECKOUT_7500",
  "NEXT_PUBLIC_GHL_CHECKOUT_15000",
  "NEXT_PUBLIC_GHL_CHECKOUT_25000",
  "NEXT_PUBLIC_GHL_CONSULT_CALL",
  "NEXT_PUBLIC_GHL_OPERATOR_APPLY",
  "NEXT_PUBLIC_GHL_CREDIT_GUIDANCE",
  "NEXT_PUBLIC_GHL_UPSELL_PIPELINE_URL",
  "NEXT_PUBLIC_SUPPORT_PHONE",
  "NEXT_PUBLIC_SUPPORT_EMAIL",
];

function loadDotEnv() {
  if (!loadProjectEnv()) {
    console.error("Missing .env or .env.local — copy .env.example and fill GHL checkout URLs.");
    process.exit(1);
  }
  const out = {};
  for (const key of GHL_KEYS) {
    if (process.env[key]) out[key] = process.env[key];
  }
  return out;
}

function isPlaceholder(v) {
  if (!v) return true;
  return v.includes("YOUR_GHL") || v === "https://app.gohighlevel.com/";
}

function linkProject(project) {
  console.log(`\n── linking → ${project} ──`);
  const r = spawnSync(
    "vercel",
    ["link", "--project", project, "--scope", scope, "--yes"],
    { cwd: root, stdio: "inherit" }
  );
  return r.status === 0;
}

const allEnvs = process.argv.includes("--all-envs");
const envs = allEnvs ? ["production", "preview", "development"] : ["production"];
const vars = loadDotEnv();

const toSync = GHL_KEYS.filter((k) => vars[k] && !isPlaceholder(vars[k]));
if (toSync.length === 0) {
  console.error("No GHL vars to sync — fill checkout URLs in .env first.");
  process.exit(1);
}

console.log(
  `Syncing ${toSync.length} var(s) to ${PROJECTS.length} project(s) in ${scope} (${envs.join(", ")})…`
);

let failed = 0;

for (const project of PROJECTS) {
  if (!linkProject(project)) {
    console.error(`  link failed for ${project} — skipping its env push`);
    failed++;
    continue;
  }

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
      console.log(`→ ${project} :: ${key} (${env})`);
      const r = spawnSync("vercel", args, { cwd: root, stdio: "inherit" });
      if (r.status !== 0) {
        console.error(`  failed (${r.status})`);
        failed++;
      }
    }
  }
}

// Always relink to canonical at end so dev workflows (vercel dev / vercel --prod)
// don't accidentally target the wrong project after this script ran.
if (PROJECTS[PROJECTS.length - 1] !== CANONICAL_PROJECT) {
  linkProject(CANONICAL_PROJECT);
}

if (failed > 0) {
  console.error(
    `\n${failed} add(s) failed. Re-link manually: vercel link --project <name> --scope ${scope}`
  );
  process.exit(1);
}

console.log(
  `\nDone. Redeploy ${PROJECTS.join(" + ")} (Vercel dashboard or: vercel redeploy --prod after relinking).`
);
