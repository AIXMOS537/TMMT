#!/usr/bin/env node
/**
 * Provision Supabase Auth users from a CSV (operators, partners, staff).
 * Safe defaults: dry-run available, never deletes users, skips existing unless --update.
 *
 * CSV columns (header required):
 *   email,role[,affiliate_code[,name]]
 *
 * Roles (app_metadata.role): operator | partner | admin | va | executive | vendor | investor
 *
 * Usage:
 *   node scripts/provision-operators.mjs --file operators.csv --dry-run
 *   node scripts/provision-operators.mjs --file operators.csv
 *   node scripts/provision-operators.mjs --file operators.csv --update   # reset password + metadata
 *
 * Requires in .env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Send each one-time password out-of-band (Signal, iMessage, in-person). Do not email in bulk.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { basename, join } from "path";
import { randomBytes } from "crypto";
import { loadProjectEnv, root } from "./load-env.mjs";

const ALLOWED_ROLES = new Set([
  "operator",
  "partner",
  "admin",
  "va",
  "executive",
  "executive_va",
  "internal_team",
  "vendor",
  "investor",
  "customer",
]);

const LOGIN_URL =
  process.env.PROVISION_LOGIN_URL || "https://tmmt-command-center.vercel.app/login";

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {
    file: null,
    email: null,
    role: "operator",
    affiliateCode: "",
    name: "",
    dryRun: false,
    update: false,
    output: null,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) out.file = argv[++i];
    else if (argv[i] === "--email" && argv[i + 1]) out.email = argv[++i];
    else if (argv[i] === "--role" && argv[i + 1]) out.role = argv[++i];
    else if (argv[i] === "--affiliate-code" && argv[i + 1]) out.affiliateCode = argv[++i];
    else if (argv[i] === "--name" && argv[i + 1]) out.name = argv[++i];
    else if (argv[i] === "--dry-run") out.dryRun = true;
    else if (argv[i] === "--update") out.update = true;
    else if (argv[i] === "--output" && argv[i + 1]) out.output = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`Usage:
  node scripts/provision-operators.mjs --email sam@x.com --role operator
  node scripts/provision-operators.mjs --file operators.csv [--dry-run] [--update]`);
      process.exit(0);
    }
  }
  if (!out.file && !out.email) {
    console.error("Need --file operators.csv or --email user@x.com --role operator");
    process.exit(1);
  }
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const emailIdx = header.indexOf("email");
  const roleIdx = header.indexOf("role");
  if (emailIdx === -1 || roleIdx === -1) {
    throw new Error('CSV must include header columns: email,role (optional: affiliate_code, name)');
  }
  const affIdx = header.indexOf("affiliate_code");
  const nameIdx = header.indexOf("name");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const email = cols[emailIdx]?.toLowerCase();
    const role = cols[roleIdx]?.toLowerCase();
    if (!email || !role) continue;
    rows.push({
      email,
      role,
      affiliate_code: affIdx >= 0 ? cols[affIdx] || "" : "",
      name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
    });
  }
  return rows;
}

function genPassword() {
  return randomBytes(12).toString("base64url") + "Aa1!";
}

function homeForRole(role) {
  switch (role) {
    case "admin":
      return "/command";
    case "operator":
      return "/operator";
    case "partner":
    case "investor":
      return "/investor";
    case "vendor":
      return "/vendor";
    case "executive":
    case "executive_va":
      return "/executive";
    default:
      return "/";
  }
}

async function findUserIdByEmail(adminClient, email) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

if (!loadProjectEnv()) {
  console.error("Missing .env or .env.local at project root.");
  process.exit(1);
}
const args = parseArgs();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

let csvPath = null;
if (args.file) {
  csvPath = args.file.startsWith("/") ? args.file : join(process.cwd(), args.file);
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }
}

let rows;
if (args.email) {
  rows = [
    {
      email: args.email.trim().toLowerCase(),
      role: args.role.trim().toLowerCase(),
      affiliate_code: args.affiliateCode,
      name: args.name,
    },
  ];
} else {
  try {
    rows = parseCsv(readFileSync(csvPath, "utf8"));
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
}

if (!rows.length) {
  console.error("No data rows in CSV.");
  process.exit(1);
}

for (const row of rows) {
  if (!ALLOWED_ROLES.has(row.role)) {
    console.error(`Invalid role "${row.role}" for ${row.email}. Allowed: ${[...ALLOWED_ROLES].join(", ")}`);
    process.exit(1);
  }
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\n=== Provision operators (${args.file ? basename(csvPath) : args.email}) ===`);
console.log(`Rows: ${rows.length} | dry-run: ${args.dryRun} | update-existing: ${args.update}\n`);

const results = [];

for (const row of rows) {
  const appMetadata = { role: row.role };
  if (row.affiliate_code) appMetadata.affiliate_code = row.affiliate_code;

  if (args.dryRun) {
    console.log(`DRY   ${row.email} (${row.role}) → ${homeForRole(row.role)}${row.affiliate_code ? ` affiliate=${row.affiliate_code}` : ""}`);
    results.push({ ...row, status: "dry-run", portal: homeForRole(row.role) });
    continue;
  }

  const existing = await findUserIdByEmail(supabase, row.email);
  const password = genPassword();

  if (existing && !args.update) {
    console.log(`SKIP  ${row.email} (${row.role}) — already exists. Use --update to reset password/metadata.`);
    results.push({ ...row, status: "skipped", user_id: existing.id, portal: homeForRole(row.role) });
    continue;
  }

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      app_metadata: appMetadata,
      user_metadata: row.name ? { full_name: row.name } : undefined,
      email_confirm: true,
    });
    if (error) {
      console.error(`FAIL  ${row.email}: ${error.message}`);
      results.push({ ...row, status: "error", error: error.message });
      continue;
    }
    console.log(`UPDATE ${row.email} (${row.role}) → ${homeForRole(row.role)}`);
    results.push({
      ...row,
      status: "updated",
      user_id: data.user.id,
      password,
      portal: homeForRole(row.role),
    });
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: row.email,
      password,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: row.name ? { full_name: row.name } : undefined,
    });
    if (error) {
      console.error(`FAIL  ${row.email}: ${error.message}`);
      results.push({ ...row, status: "error", error: error.message });
      continue;
    }
    console.log(`CREATE ${row.email} (${row.role}) → ${homeForRole(row.role)}`);
    results.push({
      ...row,
      status: "created",
      user_id: data.user.id,
      password,
      portal: homeForRole(row.role),
    });
  }
}

const credRows = results.filter((r) => r.password);
if (credRows.length) {
  console.log("\n--- One-time passwords (send securely, then ask them to change) ---\n");
  for (const r of credRows) {
    console.log(`${r.email}`);
    console.log(`  role:     ${r.role}`);
    console.log(`  login:    ${LOGIN_URL}`);
    console.log(`  portal:   ${r.portal}`);
    console.log(`  password: ${r.password}`);
    if (r.affiliate_code) console.log(`  affiliate code: ${r.affiliate_code}`);
    console.log("");
  }
}

if (results.some((r) => r.role === "partner")) {
  console.log(
    "NOTE: partner users also need partner_fleet_access rows. Run create-partner-test-user.mjs as a template or link fleet in Supabase."
  );
}

if (args.output && !args.dryRun) {
  const outPath = args.output.startsWith("/") ? args.output : join(process.cwd(), args.output);
  const lines = [
    "email,role,status,user_id,portal,affiliate_code",
    ...results.map((r) =>
      [r.email, r.role, r.status, r.user_id || "", r.portal || "", r.affiliate_code || ""].join(",")
    ),
  ];
  writeFileSync(outPath, lines.join("\n") + "\n");
  console.log(`Wrote summary (no passwords): ${outPath}`);
}

const failed = results.filter((r) => r.status === "error").length;
process.exit(failed ? 1 : 0);
