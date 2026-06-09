#!/usr/bin/env node
/**
 * Export Airtable People → operators.csv for provision-operators.mjs
 * Only rows with Sync to Portal=true, Muhammad Approved=true, real email.
 *
 * Usage:
 *   node scripts/export-operators-from-airtable.mjs
 *   node scripts/export-operators-from-airtable.mjs --apply   # also run provision
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { loadProjectEnv, root } from "./load-env.mjs";

const apply = process.argv.includes("--apply");
if (!loadProjectEnv()) process.exit(1);

const { AIRTABLE_PAT, AIRTABLE_BASE_ID } = process.env;
const BASE_ID = AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_NAME;
if (!AIRTABLE_PAT) {
  console.error("Need AIRTABLE_PAT in .env.local");
  process.exit(1);
}

async function resolveBaseId() {
  if (AIRTABLE_BASE_ID) return AIRTABLE_BASE_ID;
  const res = await fetch("https://api.airtable.com/v0/meta/bases", {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });
  const { bases } = await res.json();
  const name = process.env.AIRTABLE_BASE_NAME || "AIXMOS Operations";
  const match = bases?.find((b) => b.name.toLowerCase() === name.toLowerCase());
  if (!match) throw new Error(`Base not found: ${name}`);
  return match.id;
}

const baseId = await resolveBaseId();
const table = encodeURIComponent(process.env.AIRTABLE_PEOPLE_TABLE || "People");
const res = await fetch(`https://api.airtable.com/v0/${baseId}/${table}?pageSize=100`, {
  headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
});
if (!res.ok) {
  console.error(await res.text());
  process.exit(1);
}

const { records = [] } = await res.json();
const rows = records
  .map((r) => r.fields || {})
  .filter((f) => f["Sync to Portal"] === true && f["Muhammad Approved"] === true)
  .filter((f) => f.Email && !/@example\.com$/i.test(String(f.Email)))
  .map((f) => ({
    email: String(f.Email).trim().toLowerCase(),
    role: String(f["Portal Role"] || "operator").trim().toLowerCase(),
    affiliate_code: String(f["Affiliate Code"] || "").trim(),
    name: String(f.Name || "").trim(),
  }));

if (!rows.length) {
  console.log("No eligible People rows (need Sync to Portal + Muhammad Approved + real email).");
  process.exit(0);
}

const lines = [
  "email,role,affiliate_code,name",
  ...rows.map((r) =>
    [r.email, r.role, r.affiliate_code, r.name.includes(",") ? `"${r.name}"` : r.name].join(",")
  ),
];
const outPath = join(root, "operators.csv");
writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`Wrote ${rows.length} row(s) → operators.csv`);

if (apply) {
  const r = spawnSync(process.execPath, [join(root, "scripts/provision-operators.mjs"), "--file", "operators.csv"], {
    cwd: root,
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
}

console.log("Next: npm run provision-operators -- --file operators.csv --dry-run");
