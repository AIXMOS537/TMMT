#!/usr/bin/env node
/**
 * Create TMMT dispatch contact custom fields in each GHL location (best-effort).
 * Requires GHL_API_KEY with locations/customFields scope.
 *
 * Usage: node scripts/ghl-dispatch/create-ghl-dispatch-fields.mjs [--dry-run]
 */
import { loadEnvLocal, readLocationsConfig, ghlHeaders } from "./load-env.mjs";

loadEnvLocal();

const dryRun = process.argv.includes("--dry-run");
const cfg = readLocationsConfig();
const headers = ghlHeaders();
const GHL = "https://services.leadconnectorhq.com";

async function listContactFields(locationId) {
  const res = await fetch(
    `${GHL}/locations/${locationId}/customFields?model=contact`,
    { headers }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`list fields ${locationId}: ${res.status} ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.customFields ?? json.customField ?? json ?? [];
}

async function createField(locationId, field) {
  if (dryRun) {
    console.log(`  [dry-run] would create ${field.key}`);
    return { ok: true };
  }
  const res = await fetch(`${GHL}/locations/${locationId}/customFields`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: field.name,
      fieldKey: field.key,
      dataType: field.key === "tmmt_job_details" ? "LARGE_TEXT" : "TEXT",
      model: "contact",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    if (text.includes("already") || text.includes("duplicate") || res.status === 422) {
      return { ok: true, skipped: true };
    }
    return { ok: false, error: `${res.status} ${text.slice(0, 200)}` };
  }
  return { ok: true };
}

async function main() {
  let failed = 0;
  for (const loc of cfg.locations) {
    console.log(`\n=== ${loc.name} (${loc.location_id}) ===`);
    let existing = [];
    try {
      existing = await listContactFields(loc.location_id);
    } catch (e) {
      console.error("  FAIL list:", e.message);
      failed++;
      continue;
    }
    const keys = new Set(
      (Array.isArray(existing) ? existing : []).map((f) => f.fieldKey ?? f.key ?? f.name)
    );

    for (const field of cfg.custom_fields) {
      if (keys.has(field.key)) {
        console.log(`  OK exists: ${field.key}`);
        continue;
      }
      const result = await createField(loc.location_id, field);
      if (result.ok) {
        console.log(`  ${result.skipped ? "SKIP" : "CREATED"}: ${field.key}`);
      } else {
        console.error(`  FAIL ${field.key}:`, result.error);
        failed++;
      }
    }
  }

  console.log("\nNote: Pipelines + inbound webhook workflows must be created in GHL UI (see RUNBOOK).");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
