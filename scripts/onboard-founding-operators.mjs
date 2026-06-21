#!/usr/bin/env node
/**
 * Onboard founding operators into org_roles so RLS (is_org_member) opens their lane.
 *
 * This closes the doc's "Next provisioning step": each founder needs a Supabase Auth
 * account AND an org_roles row (org_id + non-staff operator role). provision-operators.mjs
 * only does the auth user; this script does the full chain:
 *   1. ensure auth user exists (create with one-time password if missing)
 *   2. resolve their org by name (no hard-coded UUIDs)
 *   3. call onboard_org_member(email, org_id, role) → inserts org_roles (idempotent)
 *
 * Service role bypasses onboard_org_member's staff guard (auth.uid() is null).
 *
 * Requires in .env(.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/onboard-founding-operators.mjs --dry-run
 *   node scripts/onboard-founding-operators.mjs \
 *     --op "umar@moelegacy.com=Moe Legacy" \
 *     --op "aayan@khanstrategies.com=Khan Strategies LLC"
 *
 * Send one-time passwords out-of-band (Signal/iMessage/in person), then have them reset.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

function parseArgs() {
  const argv = process.argv.slice(2);
  const ops = [];
  let dryRun = false;
  let role = "operator";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--op" && argv[i + 1]) {
      const raw = argv[++i];
      const eq = raw.lastIndexOf("=");
      if (eq === -1) {
        console.error(`Bad --op "${raw}". Expected "email=Org Name".`);
        process.exit(1);
      }
      ops.push({ email: raw.slice(0, eq).trim().toLowerCase(), orgName: raw.slice(eq + 1).trim() });
    } else if (argv[i] === "--role" && argv[i + 1]) role = argv[++i];
    else if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`Usage:\n  node scripts/onboard-founding-operators.mjs --op "email=Org Name" [--op ...] [--role operator] [--dry-run]`);
      process.exit(0);
    }
  }
  if (!ops.length) {
    console.error('Need at least one --op "email=Org Name".');
    process.exit(1);
  }
  return { ops, dryRun, role };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env. (node --env-file=.env.local ...)");
  process.exit(1);
}

const { ops, dryRun, role } = parseArgs();
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(email) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function resolveOrgId(orgName) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name")
    .ilike("name", orgName)
    .limit(2);
  if (error) throw error;
  if (!data?.length) throw new Error(`No org matching "${orgName}"`);
  if (data.length > 1) throw new Error(`Ambiguous org name "${orgName}" → ${data.map((d) => d.name).join(", ")}`);
  return data[0].id;
}

const genPassword = () => randomBytes(12).toString("base64url") + "Aa1!";
const results = [];

for (const { email, orgName } of ops) {
  try {
    const orgId = await resolveOrgId(orgName);
    if (dryRun) {
      const existing = await findUserByEmail(email);
      console.log(`DRY  ${email} → ${orgName} (${orgId}) role=${role} [user ${existing ? "exists" : "would be created"}]`);
      results.push({ email, orgName, orgId, status: "dry-run" });
      continue;
    }

    let user = await findUserByEmail(email);
    let password = null;
    if (!user) {
      password = genPassword();
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role },
      });
      if (error) throw error;
      user = data.user;
    }

    // org_roles insert via the canonical bridge RPC (idempotent; needs the profile,
    // which handle_new_user creates from the auth user).
    const { data: row, error: rpcErr } = await supabase.rpc("onboard_org_member", {
      p_email: email,
      p_org_id: orgId,
      p_role: role,
    });
    if (rpcErr) throw rpcErr;

    console.log(`OK   ${email} → ${orgName} role=${role}${password ? " (user created)" : ""}`);
    results.push({ email, orgName, orgId, status: "onboarded", user_id: user.id, password, row });
  } catch (e) {
    console.error(`FAIL ${email} → ${orgName}: ${e.message || e}`);
    results.push({ email, orgName, status: "error", error: e.message || String(e) });
  }
}

const creds = results.filter((r) => r.password);
if (creds.length) {
  console.log("\n--- One-time passwords (send securely; have them reset on first login) ---");
  for (const r of creds) console.log(`${r.email}  ${r.password}`);
}

process.exit(results.some((r) => r.status === "error") ? 1 : 0);
