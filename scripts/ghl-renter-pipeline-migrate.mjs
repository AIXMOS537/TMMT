#!/usr/bin/env node
/**
 * Move the renter opportunities out of UBER/LYFT and into the merged renter
 * pipeline, putting each person where their ACTUAL decision says they belong.
 *
 * Why this is not a blanket stage remap
 * -------------------------------------
 * 286 opportunities sit at "Verification Form Received". That stage means only
 * "the form came back" — it says nothing about the outcome. The outcome lives in
 * Supabase, in background_checks.eligibility_status, and the two systems have
 * never been joined. Moving all 286 to one stage would bury the same
 * information a second time.
 *
 * So this joins them by name and routes each person individually:
 *
 *     Eligible               -> Approved
 *     Need Manager's Review  -> Under Review
 *     Not Eligible           -> Declined - Prequal   (the AIXMOS lane, not a dead end)
 *     out of radius          -> Out of Area          (geography, never a credit pitch)
 *     Not found / unset / no match -> Under Review    (a human looks; never guessed)
 *
 * Safety
 * ------
 *   - Dry run by default. --apply is required to write anything.
 *   - Writes a rollback CSV of every current stage BEFORE the first write.
 *   - Never moves an opportunity whose status is not "open" — won, lost and
 *     abandoned records are reported and left exactly where they are.
 *   - Resolves target stages by NAME against the live pipeline, so it cannot
 *     write a stage id that does not exist in the destination.
 *
 * Usage
 * -----
 *   node scripts/ghl-renter-pipeline-migrate.mjs --to <NEW_PIPELINE_ID>
 *   node scripts/ghl-renter-pipeline-migrate.mjs --to <NEW_PIPELINE_ID> --apply
 *
 * Env (see CommandCenter/tmmt-os/.env.local — canon's .env has no GHL key):
 *   GHL_API_KEY, GHL_LOCATION_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { writeFileSync } from "node:fs";

const GHL_BASE = "https://services.leadconnectorhq.com";
const SOURCE_PIPELINE = "6HjUYeJhUaAyoit7lCSt"; // UBER/LYFT

/** Current stage id -> how to decide the destination. */
const SOURCE_STAGES = {
  "4bf50ab1-8adc-4f3a-bc64-3b59e225b2f8": { name: "New Lead", to: "New Lead" },
  "5f0f3bf4-7720-437f-9f1c-68bb7d740be7": { name: "Verification Form Sent", to: "Verification Form Sent" },
  // The one that needs the join.
  "f446c3e4-1328-46ed-b340-97b28986c0a6": { name: "Verification Form Received", to: null },
  "9fc1a290-26d6-4821-ba29-ddf25bad5697": { name: "Qualified", to: "Approved" },
  "f445c66d-7aa9-46cf-91df-f87fee7e4361": { name: "Proposal Sent", to: "Approved" },
  "cb8ad766-50cb-4d99-91d5-505f7f38435e": { name: "Negotiation", to: "Approved" },
  "c0a52269-54b2-4320-a4d2-a2211c6c8966": { name: "On the Road", to: "Rental in Progress" },
  "68ebfa44-a90e-47b5-af97-b8da4282b6b6": { name: "Closed", to: "Rental Completed" },
};

/** eligibility_status (normalized) -> destination stage name. */
function stageForEligibility(status) {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "eligible") return "Approved";
  if (s.includes("review")) return "Under Review";
  if (s.includes("out of radius") || s.includes("out of area")) return "Out of Area";
  if (s.includes("not eligible") || s.includes("ineligible")) return "Declined - Prequal";
  // "Not found", unset, or no matching background check. The check could not be
  // run or the person was never matched — that is not a decision about them.
  return "Under Review";
}

const norm = (s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function env(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Missing ${name}. Source CommandCenter/tmmt-os/.env.local first.`);
    process.exit(1);
  }
  return v;
}

function ghlHeaders() {
  return {
    Authorization: `Bearer ${env("GHL_API_KEY")}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };
}

async function fetchOpportunities(locationId) {
  const out = new Map();
  for (let page = 1; page <= 20; page++) {
    const url =
      `${GHL_BASE}/opportunities/search?location_id=${encodeURIComponent(locationId)}` +
      `&pipeline_id=${SOURCE_PIPELINE}&limit=100&page=${page}`;
    const res = await fetch(url, { headers: ghlHeaders() });
    if (!res.ok) throw new Error(`opportunity search failed (${res.status})`);
    const batch = (await res.json()).opportunities ?? [];
    if (batch.length === 0) break;
    for (const o of batch) out.set(o.id, o);
  }
  return [...out.values()];
}

/** Stage name -> id in the destination pipeline. Resolved live, never hardcoded. */
async function destinationStages(locationId, pipelineId) {
  const res = await fetch(
    `${GHL_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    { headers: ghlHeaders() }
  );
  if (!res.ok) throw new Error(`pipeline fetch failed (${res.status})`);
  const pipeline = ((await res.json()).pipelines ?? []).find((p) => p.id === pipelineId);
  if (!pipeline) throw new Error(`pipeline ${pipelineId} not found in location ${locationId}`);
  return new Map(pipeline.stages.map((s) => [s.name.trim().toLowerCase(), s.id]));
}

/** name -> eligibility_status, from the app's own background checks. */
async function fetchEligibility() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(
    `${url}/rest/v1/background_checks?select=customer_name,eligibility_status`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  if (!res.ok) throw new Error(`background_checks fetch failed (${res.status})`);

  const byName = new Map();
  for (const row of await res.json()) {
    const n = norm(row.customer_name);
    if (!n) continue;
    // A person can have several checks. The most decisive answer wins, so a
    // stale "Need Manager's Review" never overrides a real decision.
    const rank = (s) => (norm(s) === "eligible" ? 3 : norm(s).includes("not eligible") ? 3 : norm(s) ? 2 : 1);
    if (!byName.has(n) || rank(row.eligibility_status) > rank(byName.get(n))) {
      byName.set(n, row.eligibility_status);
    }
  }
  return byName;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const toPipeline = args[args.indexOf("--to") + 1];
  if (!args.includes("--to") || !toPipeline) {
    console.error("Required: --to <NEW_PIPELINE_ID>");
    process.exit(1);
  }

  const locationId = env("GHL_LOCATION_ID");
  const [opps, stageIds, eligibility] = await Promise.all([
    fetchOpportunities(locationId),
    destinationStages(locationId, toPipeline),
    fetchEligibility(),
  ]);

  console.log(`opportunities: ${opps.length}   destination stages: ${stageIds.size}   background checks: ${eligibility.size}`);

  const plan = [];
  const skipped = [];

  for (const o of opps) {
    if (o.status !== "open") {
      skipped.push({ o, why: `status=${o.status}` });
      continue;
    }
    const src = SOURCE_STAGES[o.pipelineStageId];
    if (!src) {
      skipped.push({ o, why: "unrecognised source stage" });
      continue;
    }

    const matched = eligibility.has(norm(o.name));
    const targetName = src.to ?? stageForEligibility(eligibility.get(norm(o.name)));
    const targetId = stageIds.get(targetName.toLowerCase());

    if (!targetId) {
      skipped.push({ o, why: `destination has no stage named "${targetName}"` });
      continue;
    }
    plan.push({ o, from: src.name, to: targetName, targetId, matched });
  }

  // Rollback file first — before a single write.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rollback = `ghl-rollback-${stamp}.csv`;
  writeFileSync(
    rollback,
    "opportunity_id,name,pipeline_id,pipeline_stage_id,status\n" +
      opps.map((o) => [o.id, JSON.stringify(o.name ?? ""), o.pipelineId, o.pipelineStageId, o.status].join(",")).join("\n")
  );
  console.log(`rollback written: ${rollback}`);

  const counts = {};
  for (const p of plan) counts[`${p.from} -> ${p.to}`] = (counts[`${p.from} -> ${p.to}`] ?? 0) + 1;
  console.log("\nplan:");
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }
  console.log(`\n  unmatched against background_checks: ${plan.filter((p) => !p.matched).length}`);
  console.log(`  skipped: ${skipped.length}`);
  for (const s of skipped.slice(0, 10)) console.log(`    - ${s.o.name}: ${s.why}`);

  if (!apply) {
    console.log("\nDRY RUN. Nothing was written. Re-run with --apply to move them.");
    return;
  }

  let ok = 0;
  const failed = [];
  for (const p of plan) {
    const res = await fetch(`${GHL_BASE}/opportunities/${p.o.id}`, {
      method: "PUT",
      headers: ghlHeaders(),
      body: JSON.stringify({ pipelineId: toPipeline, pipelineStageId: p.targetId }),
    });
    if (res.ok) ok++;
    else failed.push({ id: p.o.id, name: p.o.name, status: res.status, body: await res.text() });
    await new Promise((r) => setTimeout(r, 120)); // stay under the rate limit
  }

  console.log(`\nmoved: ${ok}   failed: ${failed.length}`);
  for (const f of failed.slice(0, 20)) console.log(`  ${f.name} (${f.id}): ${f.status} ${f.body.slice(0, 120)}`);
  if (failed.length) console.log(`\nRestore from ${rollback} if you need to undo.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
