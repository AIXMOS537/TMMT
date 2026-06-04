#!/usr/bin/env node
/**
 * Verify ClickUp API token and list access for TMMT workspace.
 * Usage: CLICKUP_API_TOKEN=pk_... node scripts/clickup-check.mjs
 */
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env.vercel.production", ".env.local", ".env"]) {
  const p = join(root, name);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") process.env[key] = val;
  }
}

const token = process.env.CLICKUP_API_TOKEN;
const teamId = process.env.CLICKUP_TEAM_ID ?? "90132245195";

if (!token) {
  console.error("Missing CLICKUP_API_TOKEN (pk_... personal token from ClickUp settings)");
  process.exit(1);
}

const res = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/space?archived=false`, {
  headers: { Authorization: token },
});
const text = await res.text();
if (!res.ok) {
  console.error(`ClickUp API failed HTTP ${res.status}: ${text.slice(0, 300)}`);
  process.exit(1);
}

const data = JSON.parse(text);
console.log(`ClickUp OK — team ${teamId}, ${data.spaces?.length ?? 0} spaces`);
for (const sp of data.spaces ?? []) {
  console.log(`  • ${sp.name} (${sp.id})`);
}

const lists = {
  CLICKUP_LIST_FLEET: process.env.CLICKUP_LIST_FLEET ?? "901318986996",
  CLICKUP_LIST_OPS: process.env.CLICKUP_LIST_OPS ?? "901318985770",
};
console.log("\nConfigured intake lists:");
for (const [k, id] of Object.entries(lists)) {
  const lr = await fetch(`https://api.clickup.com/api/v2/list/${id}`, {
    headers: { Authorization: token },
  });
  if (lr.ok) {
    const lj = await lr.json();
    console.log(`  ✓ ${k} → ${lj.name} (${id})`);
  } else {
    console.log(`  ✗ ${k} → ${id} (HTTP ${lr.status})`);
  }
}

console.log("\nAdd to Vercel: CLICKUP_API_TOKEN, optional CLICKUP_LIST_* overrides");
