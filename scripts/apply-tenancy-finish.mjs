#!/usr/bin/env node
/**
 * One-shot: finish the app-layer tenancy + hardening on the LIVE Supabase DB.
 *
 * Applies (idempotent, in order):
 *   1. 20260618210000_operator_writes_org_default.sql   — operators can transact
 *   2. 20260618211000_lock_install_rpc_anon.sql          — lock last 2 anon RPCs
 *   3. 20260618212000_advisor_hardening_policies.sql     — policies on bare tables
 * Then VERIFIES each change, then (optionally) onboards founding operators.
 *
 * Credentials (in .env.local — never committed):
 *   - SUPABASE_ACCESS_TOKEN   (sbp_...)  → required for the DDL (Management API)
 *       Get it: https://supabase.com/dashboard/account/tokens  ("Generate new token")
 *   - SUPABASE_SERVICE_ROLE_KEY (eyJ...) → required only for --op onboarding
 *       Get it: Supabase → Project Settings → API → service_role (secret)
 *
 * Usage:
 *   node scripts/apply-tenancy-finish.mjs                 # apply DDL + verify
 *   node scripts/apply-tenancy-finish.mjs --dry-run       # print what would run
 *   node scripts/apply-tenancy-finish.mjs \
 *     --op "[email removed]=Moe Legacy"               # also onboard Umar
 *
 * Safe: every statement is idempotent; re-running is a no-op. Nothing is dropped.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { loadProjectEnv, root } from "./load-env.mjs";

const PROJECT_REF = "uapxakmlwnpfsftfeezx";
const MIGRATIONS = [
  "20260618210000_operator_writes_org_default.sql",
  "20260618211000_lock_install_rpc_anon.sql",
  "20260618212000_advisor_hardening_policies.sql",
];

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const ops = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--op" && argv[i + 1]) ops.push(argv[++i]);
}

loadProjectEnv();
const token = process.env.SUPABASE_ACCESS_TOKEN;

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

async function mgmt(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function main() {
  console.log("=== Finish tenancy + hardening on live DB (project " + PROJECT_REF + ") ===\n");

  if (dryRun) {
    for (const m of MIGRATIONS) {
      console.log(`--- ${m} ---`);
      console.log(readFileSync(join(root, "supabase/migrations", m), "utf8"));
    }
    console.log("DRY RUN — nothing applied.");
    return;
  }

  if (!token) {
    fail(
      "SUPABASE_ACCESS_TOKEN missing. Add it to .env.local:\n" +
        "  SUPABASE_ACCESS_TOKEN=sbp_xxx\n" +
        "  Get one at https://supabase.com/dashboard/account/tokens"
    );
  }

  // 1) Apply migrations
  for (const m of MIGRATIONS) {
    const sql = readFileSync(join(root, "supabase/migrations", m), "utf8");
    process.stdout.write(`applying ${m} ... `);
    await mgmt(sql);
    console.log("OK");
  }

  // 2) Verify
  console.log("\n--- verification ---");
  const checks = [
    [
      "operator writes: acting_org_id() exists",
      "select (to_regprocedure('public.acting_org_id()') is not null) as ok",
    ],
    [
      "operator writes: bookings.org_id default uses acting_org_id",
      "select (pg_get_expr(d.adbin, d.adrelid) ilike '%acting_org_id%') as ok " +
        "from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum " +
        "join pg_class c on c.oid=d.adrelid join pg_namespace n on n.oid=c.relnamespace " +
        "where n.nspname='public' and c.relname='bookings' and a.attname='org_id'",
    ],
    [
      "install RPC: anon can NOT execute bind_install",
      "select (not has_function_privilege('anon','public.bind_install(uuid,text,text)','execute')) as ok",
    ],
    [
      "install RPC: anon can NOT execute license_heartbeat",
      "select (not has_function_privilege('anon','public.license_heartbeat(uuid,text)','execute')) as ok",
    ],
    [
      "intake: anon CAN still execute submit_customer_intake (must stay true)",
      "select has_function_privilege('anon','public.submit_customer_intake(text,text,text,text,text,text)','execute') as ok",
    ],
    [
      "policies: enforcement_settings + operator_va_assignments now have policies",
      "select (count(*) >= 2) as ok from pg_policies where schemaname='public' " +
        "and tablename in ('enforcement_settings','operator_va_assignments')",
    ],
  ];
  let allOk = true;
  for (const [label, q] of checks) {
    try {
      const rows = await mgmt(q);
      const ok = rows && rows[0] && rows[0].ok === true;
      console.log(`${ok ? "✓" : "✗"} ${label}`);
      if (!ok) allOk = false;
    } catch (e) {
      console.log(`✗ ${label} — ${e.message}`);
      allOk = false;
    }
  }
  if (!allOk) fail("One or more verifications failed — review above before relying on this.");
  console.log("\n✓ All migrations applied and verified.");

  // 3) Onboard founders (optional)
  if (ops.length) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log(
        "\n⚠ --op given but SUPABASE_SERVICE_ROLE_KEY missing — skipping onboarding.\n" +
          "  Add the service_role key to .env.local and re-run with the same --op flags."
      );
    } else {
      console.log("\n--- onboarding founding operators ---");
      const args = ["scripts/onboard-founding-operators.mjs"];
      for (const o of ops) args.push("--op", o);
      execFileSync("node", args, { cwd: root, stdio: "inherit" });
    }
  } else {
    console.log(
      '\nNext: onboard a founder with\n  node scripts/apply-tenancy-finish.mjs --op "[email removed]=Moe Legacy"'
    );
  }
}

main().catch((e) => fail(e.message || String(e)));
