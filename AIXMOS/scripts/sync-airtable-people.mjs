#!/usr/bin/env node
/**
 * Pull AIXMOS Operations → People from Airtable into portal/data/users.json
 *
 * Env:
 *   AIRTABLE_PAT              — personal access token
 *   AIRTABLE_BASE_ID          — optional if AIRTABLE_BASE_NAME is set
 *   AIRTABLE_BASE_NAME        — default "AIXMOS Operations"
 *   AIRTABLE_PEOPLE_TABLE     — default "People"
 *
 * Usage:
 *   node AIXMOS/scripts/sync-airtable-people.mjs
 *   node AIXMOS/scripts/sync-airtable-people.mjs --dry-run
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "../portal/data/users.json");

const DRY_RUN = process.argv.includes("--dry-run");
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const BASE_ID_ENV = process.env.AIRTABLE_BASE_ID;
const BASE_NAME = process.env.AIRTABLE_BASE_NAME || "AIXMOS Operations";
const TABLE_NAME = process.env.AIRTABLE_PEOPLE_TABLE || "People";

const PORTAL_STATUSES = new Set([
  "Login Created",
  "Welcome Sent",
  "Day-1 Call Scheduled",
  "Day-1 Call Done",
  "Active",
]);

const PORTAL_SYSTEMS = new Set(["AIXMOS Portal", "Both"]);
const VALID_ROLES = new Set(["admin", "executive", "operator", "member"]);

if (!AIRTABLE_PAT) {
  console.error(
    "Missing AIRTABLE_PAT. Add to .env and run: export $(grep -v '^#' .env | xargs) && node ..."
  );
  process.exit(1);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function airtableFetch(path) {
  await sleep(220);
  const res = await fetch(`https://api.airtable.com${path}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
  });
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function resolveBaseId() {
  if (BASE_ID_ENV) return BASE_ID_ENV;
  const { bases } = await airtableFetch("/v0/meta/bases");
  const match = bases.find(
    (b) => b.name.toLowerCase() === BASE_NAME.toLowerCase()
  );
  if (!match) {
    console.error(
      `Base "${BASE_NAME}" not found. Set AIRTABLE_BASE_ID or create the base. Known bases:`
    );
    bases.forEach((b) => console.error(`  - ${b.name} (${b.id})`));
    process.exit(1);
  }
  return match.id;
}

async function resolveTableId(baseId) {
  const { tables } = await airtableFetch(`/v0/meta/bases/${baseId}/tables`);
  const match = tables.find(
    (t) => t.name.toLowerCase() === TABLE_NAME.toLowerCase()
  );
  if (!match) {
    console.error(`Table "${TABLE_NAME}" not found in base ${baseId}.`);
    process.exit(1);
  }
  return match.id;
}

async function fetchAllPeople(baseId, tableId) {
  const records = [];
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: "100" });
    if (offset) qs.set("offset", offset);
    const data = await airtableFetch(
      `/v0/${baseId}/${tableId}?${qs.toString()}`
    );
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

function field(record, ...keys) {
  for (const k of keys) {
    if (record.fields[k] !== undefined && record.fields[k] !== null) {
      return record.fields[k];
    }
  }
  return undefined;
}

function toUser(record) {
  const name = String(field(record, "Name") || "").trim();
  const email = String(field(record, "Email") || "")
    .trim()
    .toLowerCase();
  const role = String(field(record, "Portal Role") || "")
    .trim()
    .toLowerCase();
  const password = String(
    field(record, "Portal Password", "Portal password") || ""
  ).trim();
  const status = String(field(record, "Status") || "").trim();
  const system = String(field(record, "System") || "").trim();
  const syncFlag = field(record, "Sync to Portal", "Sync To Portal");

  if (syncFlag === false) return { skip: true, reason: "Sync to Portal unchecked" };
  if (!PORTAL_STATUSES.has(status)) {
    return { skip: true, reason: `Status "${status}" not portal-active` };
  }
  if (!PORTAL_SYSTEMS.has(system)) {
    return { skip: true, reason: `System "${system}" not AIXMOS portal` };
  }
  if (!VALID_ROLES.has(role) || role === "pending") {
    return { skip: true, reason: `Invalid Portal Role "${role}"` };
  }
  if (!email || !password || !name) {
    return { skip: true, reason: "Missing name, email, or Portal Password" };
  }

  return {
    skip: false,
    user: { email, password, name, role },
  };
}

async function main() {
  const baseId = await resolveBaseId();
  const tableId = await resolveTableId(baseId);
  const records = await fetchAllPeople(baseId, tableId);

  const users = [];
  const skipped = [];

  for (const rec of records) {
    const result = toUser(rec);
    if (result.skip) {
      skipped.push({
        id: rec.id,
        name: field(rec, "Name") || rec.id,
        reason: result.reason,
      });
    } else {
      users.push(result.user);
    }
  }

  const byEmail = new Map();
  for (const u of users) {
    if (byEmail.has(u.email)) {
      console.warn(`Duplicate email (keeping last): ${u.email}`);
    }
    byEmail.set(u.email, u);
  }
  const unique = [...byEmail.values()].sort((a, b) =>
    a.email.localeCompare(b.email)
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "airtable",
    baseId,
    table: TABLE_NAME,
    users: unique,
  };

  console.log(`Base: ${baseId} · Table: ${TABLE_NAME}`);
  console.log(`Synced ${unique.length} portal user(s), skipped ${skipped.length}.`);

  if (skipped.length) {
    console.log("\nSkipped:");
    skipped.forEach((s) => console.log(`  - ${s.name}: ${s.reason}`));
  }

  if (unique.length === 0) {
    console.error(
      "\nNo users to write. Check People rows: Sync to Portal ✓, Status, Portal Password."
    );
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: would write:\n", JSON.stringify(payload, null, 2));
    return;
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(`\nWrote ${OUT_PATH}`);
  console.log("Redeploy or refresh NAS portal volume if already running.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
