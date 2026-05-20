#!/usr/bin/env node
/** Print tags + TMMT custom fields for a GHL contact (no secrets). */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const contactId = process.argv[2]?.trim();
if (!contactId) {
  console.error("Usage: node scripts/check-ghl-contact-tags.mjs CONTACT_ID");
  process.exit(1);
}

for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const key = process.env.GHL_API_KEY?.trim();
if (!key) {
  console.error("FAIL: GHL_API_KEY missing");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${key}`,
  Version: "2021-07-28",
  Accept: "application/json",
};

const res = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
  headers,
});
const body = await res.text();
if (!res.ok) {
  console.error("GET contact:", res.status, body.slice(0, 400));
  process.exit(1);
}

const json = JSON.parse(body);
const contact = json.contact ?? json;
const tags = contact.tags ?? [];
const fields = (contact.customFields ?? contact.customField ?? []).reduce((acc, f) => {
  const k = f.key ?? f.id ?? f.name;
  if (k) acc[k] = f.value ?? f.field_value ?? "";
  return acc;
}, {});

const keys = [
  "tmmt_case_ref",
  "tmmt_track_url",
  "tmmt_portal_url",
  "tmmt_portal_login_url",
];
console.log("Contact:", contact.id, contact.email ?? contact.name ?? "");
console.log("Tags:", tags.length ? tags.join(", ") : "(none)");
for (const k of keys) {
  console.log(`${k}:`, fields[k] ? "yes" : "no", fields[k] ? `(${String(fields[k]).slice(0, 60)}…)` : "");
}
const want = ["tmmt-portal-alert", "tmmt-portal-team-message"];
for (const t of want) {
  console.log(`tag ${t}:`, tags.includes(t) ? "YES" : "NO");
}
