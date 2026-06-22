#!/usr/bin/env node
/**
 * Drift check: the embedded CONFIG in index.html must stay 1:1 with aixmos.config.json.
 *
 * Compares, for every module, the stable contract fields:
 *   - key            (stable id → platform schema)
 *   - gated          (bay requires owner approval)
 *   - flags          (feature flags the unlock maps to)
 *   - approvers      (who may grant)
 * Order matters: the index.html node ring is positional, so module order must match too.
 *
 * Exit 0 = in sync. Exit 1 = drift (prints the diffs). Pure Node, no deps.
 * Run: node tools/aixmos-build-page/check-config-drift.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "index.html"), "utf8");
const cfg = JSON.parse(readFileSync(join(here, "aixmos.config.json"), "utf8"));

// --- pull the embedded MODULES array out of index.html ---------------------
const m = html.match(/var MODULES=\[([\s\S]*?)\n {2}\];/);
if (!m) {
  console.error("FAIL: could not locate the `var MODULES=[...]` block in index.html");
  process.exit(1);
}
const block = m[1];

// split into per-module slices on each `key:"..."` boundary (robust to
// multi-line gated entries that carry a long `gate:` string).
const keyRe = /key:"[^"]+"/g;
const starts = [];
let km;
while ((km = keyRe.exec(block)) !== null) starts.push(km.index);
const entries = starts.map((s, i) => block.slice(s, starts[i + 1] ?? block.length));
const embedded = entries.map((e) => {
  const key = (e.match(/key:"([^"]+)"/) || [])[1];
  const gated = /gated:true/.test(e);
  const flags = (() => {
    const f = e.match(/flags:\[([^\]]*)\]/);
    if (!f) return [];
    return f[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
  })();
  const approvers = (() => {
    const a = e.match(/approvers:\[([^\]]*)\]/);
    if (!a) return [];
    return a[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
  })();
  return { key, gated, flags, approvers };
});

// --- normalize aixmos.config.json the same way -----------------------------
const canonical = cfg.modules.map((mod) => ({
  key: mod.key,
  gated: !!mod.gated,
  flags: mod.flags || [],
  approvers: mod.approvers || [],
}));

// --- compare ----------------------------------------------------------------
const problems = [];
if (embedded.length !== canonical.length) {
  problems.push(`module count: index.html=${embedded.length} vs config=${canonical.length}`);
}
const n = Math.max(embedded.length, canonical.length);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (let i = 0; i < n; i++) {
  const e = embedded[i] || {};
  const c = canonical[i] || {};
  if (e.key !== c.key) problems.push(`#${i} key: index.html="${e.key}" vs config="${c.key}"`);
  if (!!e.gated !== !!c.gated) problems.push(`#${i} (${c.key || e.key}) gated mismatch`);
  if (!eq(e.flags || [], c.flags || []))
    problems.push(`#${i} (${c.key || e.key}) flags: [${e.flags}] vs [${c.flags}]`);
  if (!eq(e.approvers || [], c.approvers || []))
    problems.push(`#${i} (${c.key || e.key}) approvers: [${e.approvers}] vs [${c.approvers}]`);
}

if (problems.length) {
  console.error("CONFIG DRIFT — index.html CONFIG and aixmos.config.json disagree:\n");
  problems.forEach((p) => console.error("  ✗ " + p));
  console.error("\nFix both so module key/gated/flags/approvers match, then re-run.");
  process.exit(1);
}

console.log(`OK — ${canonical.length} modules in sync (key, gated, flags, approvers).`);
