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
import { readFileSync, statSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, extname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cfgPath = resolve(here, "../config/credit-compliance.json");
let cfg;
try { cfg = JSON.parse(readFileSync(cfgPath, "utf8")); }
catch (e) { console.error(`✗ cannot read ${cfgPath}: ${e.message}`); process.exit(2); }

// args: optional --product <key>, then a file/dir path (or stdin)
const args = process.argv.slice(2);
let product = "all", target = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--product") product = args[++i];
  else target = args[i];
}

const SCAN_EXT = new Set([".txt", ".md", ".html", ".htm", ".mdx"]);
function walk(dir, acc) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (SCAN_EXT.has(extname(e.name))) acc.push(p);
  }
  return acc;
}
// build list of {name, text} units to check
function units() {
  if (!target) {
    let t = "";
    try { t = readFileSync(0, "utf8"); } catch { /* no stdin */ }
    if (!t.trim()) { console.error("✗ no input (give a file/dir path or pipe text)"); process.exit(2); }
    return [{ name: "<stdin>", text: t }];
  }
  const st = statSync(target);
  const files = st.isDirectory() ? walk(target, []) : [target];
  return files.map((f) => ({ name: f, text: readFileSync(f, "utf8") }));
}

const map = { credit_repair: "credit_repair_CROA", funding: "funding" };
let totalViol = 0, totalMissing = 0;
console.log("== compliance-check ==");
for (const u of units()) {
  const lower = u.text.toLowerCase();
  const violations = [];
  for (const p of cfg.prohibited_claims.patterns) {
    const re = new RegExp(p, "ig"); let m;
    while ((m = re.exec(u.text)) !== null) {
      violations.push({ pattern: p, match: m[0].trim() });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }
  const want = [...cfg.required_disclosures.general];
  if (product === "all") want.push(...cfg.required_disclosures.credit_repair_CROA, ...cfg.required_disclosures.funding);
  else if (map[product]) want.push(...cfg.required_disclosures[map[product]]);
  const missing = want.filter((d) => !lower.includes(d.toLowerCase().slice(0, 24)));

  if (violations.length || missing.length) {
    console.log(`\n${u.name}`);
    if (violations.length) {
      console.log(`  \x1b[31m✗ ${violations.length} PROHIBITED claim(s) — DO NOT SEND:\x1b[0m`);
      for (const v of violations) console.log(`    • "${v.match}"   (rule: ${v.pattern})`);
    }
    if (missing.length) {
      console.log(`  \x1b[33m! missing ${missing.length} required disclosure(s):\x1b[0m`);
      for (const d of missing) console.log(`    • ${d}`);
    }
  }
  totalViol += violations.length; totalMissing += missing.length;
}

if (!totalViol) console.log("\x1b[32m✓ no prohibited claims\x1b[0m");
console.log(`\n${totalViol} prohibited, ${totalMissing} missing-disclosure warning(s).`);
console.log("\x1b[2mNot legal advice. Counsel must review before sale (config.pre_sale_gate).\x1b[0m");
process.exit(totalViol ? 1 : 0);
