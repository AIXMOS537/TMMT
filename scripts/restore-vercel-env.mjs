#!/usr/bin/env node
/**
 * restore-vercel-env — rebuild a Vercel project's environment from local files.
 *
 * Exists because a production project's environment can be lost wholesale (the
 * project gets deleted and recreated), which takes the site down even when the
 * code is perfect. This turns recovery into one command instead of archaeology.
 *
 * Values are read from local files and never printed — the script reports key
 * names and lengths only, so a restore can be confirmed without exposing a
 * secret to a terminal, a log, or a chat window.
 *
 *   node scripts/restore-vercel-env.mjs           # dry run
 *   node scripts/restore-vercel-env.mjs --apply
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ID = process.env.VERCEL_PROJECT_ID || "prj_Cw4lJPwwlYSyVWLvuo98nuk1r5gV";
const TEAM_ID = process.env.VERCEL_TEAM_ID || "team_UzatfZkJUpFKABaO6cZTQUq7";
const APPLY = process.argv.includes("--apply");
// Secrets are read in place from wherever they already live. They are never
// copied into this checkout, so a worktree or clone never becomes a new place
// a credential can leak from. Override with ENV_SOURCE_DIR when the canonical
// .env files sit outside this repo (e.g. running from a git worktree).
const REPO = process.env.ENV_SOURCE_DIR
  ? path.resolve(process.env.ENV_SOURCE_DIR)
  : path.resolve(import.meta.dirname, "..");

/** The contract for a working deploy. `required` means the app throws without it. */
const SPEC = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", required: true, pub: true },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, pub: true },
  { key: "SUPABASE_SERVICE_ROLE_KEY", required: true },
  { key: "GHL_WEBHOOK_SECRET" },
  { key: "NEXT_PUBLIC_GHL_CHECKOUT_OPS_KIT", pub: true },
  { key: "NEXT_PUBLIC_GHL_CHECKOUT_COMMAND_KIT", pub: true },
  { key: "NEXT_PUBLIC_GHL_CHECKOUT_DEALER_BUNDLE", pub: true },
  { key: "NEXT_PUBLIC_GHL_CHECKOUT_97", pub: true },
  { key: "NEXT_PUBLIC_GHL_OPERATOR_APPLY", pub: true },
  { key: "NEXT_PUBLIC_GHL_CHECKOUT_LLC", pub: true },
];

const SOURCES = [".env.local", ".env"];

function token() {
  const p = path.join(os.homedir(), "Library/Application Support/com.vercel.cli/auth.json");
  if (!fs.existsSync(p)) throw new Error("Vercel CLI not authenticated — run: vercel login");
  return JSON.parse(fs.readFileSync(p, "utf8")).token;
}

function parseEnvFile(file) {
  const full = path.join(REPO, file);
  if (!fs.existsSync(full)) return {};
  const out = {};
  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v !== "") out[m[1]] = v;
  }
  return out;
}

const files = Object.fromEntries(SOURCES.map((f) => [f, parseEnvFile(f)]));

function lookup(key) {
  for (const f of SOURCES) if (files[f][key]) return { value: files[f][key], file: f };
  return null;
}

async function main() {
  const found = [];
  const missing = [];
  for (const spec of SPEC) {
    const hit = lookup(spec.key);
    if (hit) found.push({ ...spec, ...hit });
    else missing.push(spec);
  }

  console.log(`Project ${PROJECT_ID}\n`);
  console.log("RECOVERABLE FROM LOCAL FILES:");
  for (const f of found) {
    console.log(`  ✓ ${f.key.padEnd(38)} len ${String(f.value.length).padStart(4)}  ← ${f.file}`);
  }
  console.log("\nNOT PRESENT LOCALLY:");
  for (const m of missing) console.log(`  ${m.required ? "✗ REQUIRED " : "· optional "} ${m.key}`);

  if (!APPLY) {
    console.log("\n(dry run — re-run with --apply to push)");
    return;
  }

  const TOK = token();
  const url = `https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&upsert=true`;
  console.log("\nPushing…");
  let ok = 0;
  for (const f of found) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOK}`, "content-type": "application/json" },
      body: JSON.stringify({
        key: f.key,
        value: f.value,
        // NEXT_PUBLIC_* is inlined into the client bundle anyway, so encrypting
        // it buys nothing and only makes later auditing harder.
        type: f.pub ? "plain" : "encrypted",
        target: ["production", "preview", "development"],
      }),
    });
    if (res.ok) { console.log(`  ✓ ${f.key}`); ok++; }
    else console.log(`  ✗ ${f.key} — ${res.status} ${(await res.text()).slice(0, 160)}`);
  }
  console.log(`\n${ok}/${found.length} pushed.`);
  const blocking = missing.filter((m) => m.required);
  if (blocking.length) {
    console.log(`\n⚠ Production will still fail at runtime. Missing: ${blocking.map((m) => m.key).join(", ")}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
