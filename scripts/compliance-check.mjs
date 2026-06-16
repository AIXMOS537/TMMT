#!/usr/bin/env node
// compliance-check.mjs — guardrail for consumer-facing credit/funding output.
// Scans text against config/credit-compliance.json: BLOCKS prohibited claims,
// WARNS on missing required disclosures. Use before anything reaches a consumer.
//
//   node scripts/compliance-check.mjs path/to/output.txt
//   echo "We guarantee to delete your debt" | node scripts/compliance-check.mjs
//   node scripts/compliance-check.mjs --product credit_repair path/to/file
//
// Exit 0 = clean. Exit 1 = prohibited claim(s) found (do NOT send). Exit 2 = usage.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = resolve(here, "../config/credit-compliance.json");
let cfg;
try { cfg = JSON.parse(readFileSync(cfgPath, "utf8")); }
catch (e) { console.error(`✗ cannot read ${cfgPath}: ${e.message}`); process.exit(2); }

// args: optional --product <key>, then a file path (or stdin)
const args = process.argv.slice(2);
let product = "all", file = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--product") product = args[++i];
  else file = args[i];
}

function readInput() {
  if (file) return readFileSync(file, "utf8");
  try { return readFileSync(0, "utf8"); } catch { return ""; }
}
const text = readInput();
if (!text.trim()) { console.error("✗ no input (give a file path or pipe text)"); process.exit(2); }

const lower = text.toLowerCase();
const violations = [];
for (const p of cfg.prohibited_claims.patterns) {
  const re = new RegExp(p, "ig");
  let m;
  while ((m = re.exec(text)) !== null) {
    violations.push({ pattern: p, match: m[0].trim() });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
}

// required disclosures (general + product-specific)
const want = [...cfg.required_disclosures.general];
const map = { credit_repair: "credit_repair_CROA", funding: "funding" };
if (product === "all") want.push(...cfg.required_disclosures.credit_repair_CROA, ...cfg.required_disclosures.funding);
else if (map[product]) want.push(...cfg.required_disclosures[map[product]]);
const missing = want.filter((d) => !lower.includes(d.toLowerCase().slice(0, 24)));

console.log("== compliance-check ==");
if (violations.length) {
  console.log(`\n\x1b[31m✗ ${violations.length} PROHIBITED claim(s) — DO NOT SEND:\x1b[0m`);
  for (const v of violations) console.log(`  • "${v.match}"   (rule: ${v.pattern})`);
} else {
  console.log("\x1b[32m✓ no prohibited claims\x1b[0m");
}
if (missing.length) {
  console.log(`\n\x1b[33m! missing ${missing.length} required disclosure(s) (add to output or wrapping contract/UI):\x1b[0m`);
  for (const d of missing) console.log(`  • ${d}`);
}
console.log("\n\x1b[2mNot legal advice. Counsel must review before sale (config.pre_sale_gate).\x1b[0m");

process.exit(violations.length ? 1 : 0);
