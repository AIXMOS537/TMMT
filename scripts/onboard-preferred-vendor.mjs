#!/usr/bin/env node
/**
 * Onboard a preferred vendor (Michael Bibbs default): Auth user + vendors row + shops record.
 *
 * Usage:
 *   node scripts/onboard-preferred-vendor.mjs
 *   node scripts/onboard-preferred-vendor.mjs --email michael@example.com --name "M. Bibbs Cleaning LLC"
 *   node scripts/onboard-preferred-vendor.mjs --dry-run
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { randomBytes } from "crypto";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPaths = [
  join(root, ".env.vercel.production"),
  join(root, ".env.local"),
  join(root, ".env"),
];

function loadDotEnv() {
  for (const envPath of envPaths) {
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env) || process.env[key] === "") process.env[key] = val;
    }
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {
    email: null,
    password: null,
    name: null,
    contact: null,
    phone: null,
    verticals: ["cleaning", "moving"],
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email" && argv[i + 1]) out.email = argv[++i];
    else if (argv[i] === "--password" && argv[i + 1]) out.password = argv[++i];
    else if (argv[i] === "--name" && argv[i + 1]) out.name = argv[++i];
    else if (argv[i] === "--contact" && argv[i + 1]) out.contact = argv[++i];
    else if (argv[i] === "--phone" && argv[i + 1]) out.phone = argv[++i];
    else if (argv[i] === "--verticals" && argv[i + 1])
      out.verticals = argv[++i].split(",").map((s) => s.trim());
    else if (argv[i] === "--dry-run") out.dryRun = true;
  }
  return out;
}

async function findUserIdByEmail(admin, email) {
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) return null;
    page++;
  }
}

loadDotEnv();
const args = parseArgs();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const email = args.email ?? process.env.MICHAEL_VENDOR_EMAIL ?? "michael.bibbs@vendor.tmmtrentals.local";
const password = args.password ?? process.env.MICHAEL_VENDOR_PASSWORD ?? randomBytes(12).toString("base64url") + "Aa1!";
const businessName = args.name ?? "M. Bibbs Cleaning & Moving";
const contactName = args.contact ?? "Michael Bibbs";
const phone = args.phone ?? "";
const verticals = args.verticals;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== Preferred vendor onboarding ===");
console.log(`Business: ${businessName}`);
console.log(`Email:    ${email}`);
console.log(`Verticals: ${verticals.join(", ")}`);
if (args.dryRun) {
  console.log("\nDry run — no changes written.");
  process.exit(0);
}

let userId = await findUserIdByEmail(admin, email);
if (userId) {
  console.log("Auth user exists — updating role=vendor");
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: { role: "vendor" },
    email_confirm: true,
  });
  if (error) throw error;
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "vendor" },
  });
  if (error) throw error;
  userId = data.user.id;
  console.log("Created Auth user with role=vendor");
}

const vendorNotes = [
  "Preferred vendor — LLC-to-LLC services agreement.",
  "Docs: docs/hiring-onboarding/06_MICHAEL_VENDOR_AGREEMENT/",
  `Verticals: ${verticals.join(", ")}`,
  "Next: sign Master + Cleaning/Moving schedules, verify insurance, assign first job in /workflow-vendors.",
].join("\n");

const { data: existingVendor } = await admin
  .from("vendors")
  .select("id")
  .eq("auth_user_id", userId)
  .maybeSingle();

let vendorId = existingVendor?.id;

if (vendorId) {
  const { error } = await admin
    .from("vendors")
    .update({
      name: businessName,
      contact_name: contactName,
      email,
      phone: phone || null,
      vendor_type: verticals.join(","),
      service_verticals: verticals,
      agreement_status: "trial",
      notes: vendorNotes,
      active: true,
    })
    .eq("id", vendorId);
  if (error) throw error;
  console.log(`Updated vendors row ${vendorId}`);
} else {
  const { data, error } = await admin
    .from("vendors")
    .insert({
      name: businessName,
      contact_name: contactName,
      email,
      phone: phone || null,
      vendor_type: verticals.join(","),
      service_verticals: verticals,
      agreement_status: "trial",
      auth_user_id: userId,
      notes: vendorNotes,
      active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  vendorId = data.id;
  console.log(`Created vendors row ${vendorId}`);
}

const { data: shopMatch } = await admin
  .from("shops_mechanics_cleaning")
  .select("id")
  .ilike("email_address", email)
  .maybeSingle();

if (!shopMatch) {
  const { error: shopErr } = await admin.from("shops_mechanics_cleaning").insert({
    vendor_payee: businessName,
    point_of_contact: contactName,
    email_address: email,
    phone_number: phone || null,
    notes: `Preferred vendor portal id: ${vendorId}. Verticals: ${verticals.join(", ")}`,
  });
  if (shopErr) console.warn("shops_mechanics_cleaning insert skipped:", shopErr.message);
  else console.log("Added shops_mechanics_cleaning record for legacy admin /vendors page");
} else {
  console.log("shops_mechanics_cleaning record already exists");
}

console.log("\n--- Vendor portal ready ---");
console.log(`Email:     ${email}`);
console.log(`Password:  ${password}`);
console.log(`User id:   ${userId}`);
console.log(`Vendor id: ${vendorId}`);
console.log("Login → /vendor (after migration 20260520140000_vendor_service_verticals.sql applied)");
console.log("Staff: /workflow-vendors to assign jobs");
