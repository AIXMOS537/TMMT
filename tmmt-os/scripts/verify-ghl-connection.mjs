#!/usr/bin/env node
/**
 * Quick GHL API check (no secrets printed).
 * Usage: node scripts/verify-ghl-connection.mjs [contactId] [refCode]
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");

function loadEnv() {
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const key = process.env.GHL_API_KEY?.trim();
const loc = process.env.GHL_LOCATION_ID?.trim();
const contactArg = process.argv[2]?.trim();
const refCode = process.argv[3]?.trim() || "C-TEST-VERIFY";

if (!key || !loc) {
  console.error("FAIL: Set GHL_API_KEY and GHL_LOCATION_ID in .env.local or Vercel.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  Version: "2021-07-28",
  Accept: "application/json",
  "Content-Type": "application/json",
};

const portal = (process.env.NEXT_PUBLIC_PORTAL_URL || "https://tmmt-ops.vercel.app").replace(
  /\/$/,
  ""
);
const fields = {
  tmmt_case_ref: refCode,
  tmmt_track_url: `${portal}/track?ref=${encodeURIComponent(refCode)}`,
  tmmt_portal_url: `${portal}/client/updates`,
  tmmt_portal_login_url: `${portal}/login`,
};

async function resolveContactId(arg) {
  if (!arg) return null;
  if (!arg.includes("@")) return arg;
  const res = await fetch(
    `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${encodeURIComponent(loc)}&email=${encodeURIComponent(arg.toLowerCase())}`,
    { headers }
  );
  if (!res.ok) {
    console.error("Contact lookup failed:", res.status, (await res.text()).slice(0, 200));
    return null;
  }
  const json = await res.json();
  const id = json.contact?.id ?? null;
  if (!id) console.error("No GHL contact found for email:", arg);
  else console.log("Resolved contact ID from email:", id);
  return id;
}

async function main() {
  const dup = await fetch(
    `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${encodeURIComponent(loc)}&email=${encodeURIComponent("verify-nonexistent@tmmt.test")}`,
    { headers }
  );
  const authOk = dup.status !== 401 && dup.status !== 403;
  console.log(
    "API auth check:",
    dup.status,
    dup.status === 401
      ? "INVALID_TOKEN"
      : dup.status === 403
        ? "NO_LOCATION_ACCESS"
        : authOk
          ? "OK"
          : "CHECK_STATUS"
  );

  const contactId = await resolveContactId(contactArg);
  if (!contactId) {
    console.log("\nOptional: pass contact ID or email to test field write:");
    console.log("  node scripts/verify-ghl-connection.mjs YOUR_CONTACT_ID C-YOUR-REF");
    console.log("  node scripts/verify-ghl-connection.mjs client@example.com C-YOUR-REF");
    return;
  }

  const res = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      customFields: Object.entries(fields).map(([key, field_value]) => ({ key, field_value })),
    }),
  });
  const body = await res.text();
  console.log("Field sync test:", res.status, res.ok ? "OK" : "FAILED");
  if (!res.ok) console.log(body.slice(0, 300));
  else console.log("Wrote:", Object.keys(fields).join(", "));
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
