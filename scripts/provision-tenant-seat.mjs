#!/usr/bin/env node
/**
 * Provision a vertical seat — auth user + org_roles + operator_profiles (when applicable).
 * Owner-only. Dry-run by default mindset: pass --apply to write live.
 *
 * Combines provision-operators.mjs + onboard-founding-operators.mjs into one vertical-aware flow.
 * Does NOT deploy. Does NOT apply RLS migrations.
 *
 * Usage:
 *   node scripts/provision-tenant-seat.mjs --vertical moe-legacy --email u@x.com --stage admin --dry-run
 *   node scripts/provision-tenant-seat.mjs --vertical moe-legacy --email u@x.com --stage earn --apply
 *   node scripts/provision-tenant-seat.mjs --file config/seats.example.csv --dry-run
 *
 * CSV columns: email,vertical,stage[,name]
 *
 * Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { loadProjectEnv, root } from "./load-env.mjs";

const CONFIG_PATH = join(root, "config/verticals.json");

function loadConfig() {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const bySlug = Object.fromEntries(raw.verticals.map((v) => [v.slug, v]));
  return { bySlug, stages: raw.stages };
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {
    vertical: null,
    email: null,
    stage: "earn",
    name: "",
    file: null,
    dryRun: true,
    planOnly: false,
    output: null,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--vertical" && argv[i + 1]) out.vertical = argv[++i];
    else if (argv[i] === "--email" && argv[i + 1]) out.email = argv[++i].trim().toLowerCase();
    else if (argv[i] === "--stage" && argv[i + 1]) out.stage = argv[++i];
    else if (argv[i] === "--name" && argv[i + 1]) out.name = argv[++i];
    else if (argv[i] === "--file" && argv[i + 1]) out.file = argv[++i];
    else if (argv[i] === "--dry-run") out.dryRun = true;
    else if (argv[i] === "--plan-only") { out.dryRun = true; out.planOnly = true; }
    else if (argv[i] === "--apply") out.dryRun = false;
    else if (argv[i] === "--output" && argv[i + 1]) out.output = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(`Usage:
  node scripts/provision-tenant-seat.mjs --vertical moe-legacy --email u@x.com --stage admin [--dry-run|--apply]
  node scripts/provision-tenant-seat.mjs --file seats.csv [--dry-run|--apply]

Stages: learn | earn | admin | graduate`);
      process.exit(0);
    }
  }
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (!lines.length) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const emailIdx = header.indexOf("email");
  const verticalIdx = header.indexOf("vertical");
  const stageIdx = header.indexOf("stage");
  const nameIdx = header.indexOf("name");
  if (emailIdx === -1 || verticalIdx === -1) {
    throw new Error("CSV must include email,vertical (optional: stage, name)");
  }
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const email = cols[emailIdx]?.toLowerCase();
    const vertical = cols[verticalIdx];
    if (!email || !vertical) continue;
    rows.push({
      email,
      vertical,
      stage: stageIdx >= 0 ? cols[stageIdx] || "earn" : "earn",
      name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
    });
  }
  return rows;
}

const genPassword = () => randomBytes(12).toString("base64url") + "Aa1!";

async function findUserByEmail(adminClient, email) {
  let page = 1;
  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function resolveOrgId(supabase, orgName) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id,name")
    .ilike("name", orgName)
    .limit(2);
  if (error) throw error;
  if (!data?.length) throw new Error(`No org matching "${orgName}"`);
  if (data.length > 1) throw new Error(`Ambiguous org "${orgName}"`);
  return data[0].id;
}

function homeForRole(appRole) {
  switch (appRole) {
    case "partner":
      return "/investor";
    case "operator":
      return "/operator";
    default:
      return "/";
  }
}

const args = parseArgs();
const { bySlug, stages } = loadConfig();

let rows = [];
if (args.file) {
  const csvPath = args.file.startsWith("/") ? args.file : join(process.cwd(), args.file);
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }
  rows = parseCsv(readFileSync(csvPath, "utf8"));
} else if (args.email && args.vertical) {
  rows = [{ email: args.email, vertical: args.vertical, stage: args.stage, name: args.name }];
} else {
  console.error("Need --vertical + --email, or --file seats.csv");
  process.exit(1);
}

for (const row of rows) {
  if (!bySlug[row.vertical]) {
    console.error(`Unknown vertical slug "${row.vertical}". Known: ${Object.keys(bySlug).join(", ")}`);
    process.exit(1);
  }
  if (!stages[row.stage]) {
    console.error(`Unknown stage "${row.stage}". Known: ${Object.keys(stages).join(", ")}`);
    process.exit(1);
  }
}

if (args.planOnly) {
  console.log(`\n=== Plan only (no DB, no credentials) ===\n`);
  for (const row of rows) {
    const vertical = bySlug[row.vertical];
    const plan = stages[row.stage];
    console.log(
      `PLAN ${row.email} → ${vertical.orgName} (${row.vertical}) stage=${row.stage}\n` +
        `     appRole=${plan.appRole} orgRole=${plan.orgRole} split=${plan.revenueSharePct}%\n` +
        `     login=${vertical.loginUrl} portal=${homeForRole(plan.appRole)}\n`
    );
  }
  process.exit(0);
}

if (!loadProjectEnv()) {
  console.error("Missing .env or .env.local at project root.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`\n=== Provision tenant seats (${rows.length} row(s)) ===`);
console.log(`Mode: ${args.dryRun ? "DRY-RUN (no writes)" : "APPLY (live writes)"}\n`);

const results = [];

for (const row of rows) {
  const vertical = bySlug[row.vertical];
  const plan = stages[row.stage];
  const orgName = vertical.orgName;
  const loginUrl = vertical.loginUrl || "https://tmmt-ops.vercel.app/login";

  try {
    const orgId = await resolveOrgId(supabase, orgName);
    const existing = await findUserByEmail(supabase, row.email);

    if (args.dryRun) {
      console.log(
        `DRY  ${row.email} → ${orgName} (${row.vertical}) stage=${row.stage} ` +
          `appRole=${plan.appRole} orgRole=${plan.orgRole} split=${plan.revenueSharePct}% ` +
          `[user ${existing ? "exists" : "would create"}]`
      );
      results.push({ ...row, orgId, status: "dry-run", portal: homeForRole(plan.appRole) });
      continue;
    }

    let user = existing;
    let password = null;
    if (!user) {
      password = genPassword();
      const { data, error } = await supabase.auth.admin.createUser({
        email: row.email,
        password,
        email_confirm: true,
        app_metadata: { role: plan.appRole },
        user_metadata: row.name ? { full_name: row.name } : undefined,
      });
      if (error) throw error;
      user = data.user;
    }

    const { error: rpcErr } = await supabase.rpc("onboard_org_member", {
      p_email: row.email,
      p_org_id: orgId,
      p_role: plan.orgRole,
    });
    if (rpcErr) throw rpcErr;

    // Operator economics row when stage is earn/admin/graduate
    if (plan.revenueSharePct > 0 || plan.level !== "student") {
      const rpcBody = {
        p_email: row.email,
        p_revenue_share_pct: plan.revenueSharePct,
        p_level: plan.level,
        p_license_fee_cents: 0,
      };
      const { data: opId, error: provErr } = await supabase.rpc("provision_operator", rpcBody);
      if (provErr && !String(provErr.message).includes("duplicate")) {
        console.warn(`WARN operator_profiles: ${provErr.message}`);
      } else if (opId || plan.certified) {
        const { data: existingOp } = await supabase
          .from("operator_profiles")
          .select("id")
          .eq("customer_email", row.email)
          .maybeSingle();
        if (existingOp?.id && plan.certified) {
          await supabase
            .from("operator_profiles")
            .update({
              level: plan.level,
              revenue_share_pct: plan.revenueSharePct,
              certified_at: new Date().toISOString(),
              profile_id: user.id,
            })
            .eq("id", existingOp.id);
        }
      }
    }

    console.log(`OK   ${row.email} → ${orgName} stage=${row.stage} orgRole=${plan.orgRole}`);
    results.push({
      ...row,
      orgId,
      status: "provisioned",
      user_id: user.id,
      password,
      portal: homeForRole(plan.appRole),
      loginUrl,
    });
  } catch (e) {
    console.error(`FAIL ${row.email} → ${row.vertical}: ${e.message || e}`);
    results.push({ ...row, status: "error", error: e.message || String(e) });
  }
}

const creds = results.filter((r) => r.password);
if (creds.length) {
  console.log("\n--- One-time passwords (send securely; have them reset on first login) ---");
  for (const r of creds) {
    console.log(`${r.email}`);
    console.log(`  login:    ${r.loginUrl}`);
    console.log(`  portal:   ${r.portal}`);
    console.log(`  password: ${r.password}`);
    console.log("");
  }
}

if (args.output && !args.dryRun) {
  const outPath = args.output.startsWith("/") ? args.output : join(process.cwd(), args.output);
  writeFileSync(
    outPath,
    ["email,vertical,stage,status,portal", ...results.map((r) =>
      [r.email, r.vertical, r.stage, r.status, r.portal || ""].join(",")
    )].join("\n") + "\n"
  );
  console.log(`Wrote summary (no passwords): ${outPath}`);
}

process.exit(results.some((r) => r.status === "error") ? 1 : 0);
