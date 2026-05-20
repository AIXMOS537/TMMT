#!/usr/bin/env node
/**
 * Post-login smoke (API layer) — run: node scripts/smoke-month2.mjs
 */
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    })
);

const ccUrl = env.COMMAND_CENTER_SUPABASE_URL;
const ccKey = env.COMMAND_CENTER_SUPABASE_SERVICE_KEY;
const osUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const osKey = env.SUPABASE_SERVICE_ROLE_KEY;

const results = [];

function pass(name, detail) {
  results.push({ name, ok: true, detail });
}
function fail(name, detail) {
  results.push({ name, ok: false, detail });
}

if (!ccUrl || !ccKey) fail("Command Center env", "missing COMMAND_CENTER_*");
else pass("Command Center env", "configured");

if (!osUrl || !osKey) fail("TMMT OS env", "missing SUPABASE_*");
else pass("TMMT OS env", "configured");

const cc = ccUrl && ccKey ? createClient(ccUrl, ccKey, { auth: { persistSession: false } }) : null;
const os = osUrl && osKey ? createClient(osUrl, osKey, { auth: { persistSession: false } }) : null;

if (cc) {
  const fleet = await cc.from("fleet").select("id", { count: "exact", head: true });
  if (fleet.error) fail("/v/tmmt-rentals fleet", fleet.error.message);
  else pass("/v/tmmt-rentals fleet", `${fleet.count} rows`);

  const leads = await cc.from("incoming_leads").select("id", { count: "exact", head: true });
  if (leads.error) fail("/v/tmmt-rentals leads", leads.error.message);
  else pass("/v/tmmt-rentals leads", `${leads.count} rows`);
}

let authUser = null;
if (os) {
  const { data: auth, error: authErr } = await os.auth.signInWithPassword({
    email: "management@tmmtrentals.net",
    password: "TmmtPortalTest!2026",
  });
  if (authErr) fail("Login management@", authErr.message);
  else {
    authUser = auth.user;
    pass("Login management@", auth.user.id);
    const { data: prof, error: pe } = await os
      .from("profiles")
      .select("role, organization_id")
      .eq("id", auth.user.id)
      .single();
    if (pe) fail("Profile", pe.message);
    else pass("Profile", `role=${prof.role} org=${prof.organization_id ?? "none"}`);
  }

  const deals = await os.from("deals").select("id", { count: "exact", head: true });
  if (deals.error?.message?.includes("does not exist")) {
    fail("/internal/dealer deals", "run migration 0016_dealer_core.sql");
  } else if (deals.error) {
    fail("/internal/dealer deals", deals.error.message);
  } else {
    pass("/internal/dealer deals table", `${deals.count} rows`);
  }

  const orgs = await os
    .from("organizations")
    .select(
      "id, name, vertical, billing_status, suspended_at, onboarding_step, stripe_connect_account_id"
    );
  if (orgs.error?.message?.includes("vertical")) {
    fail("/internal/agency", "run migrations 0016+0017 for organizations.vertical");
  } else if (orgs.error?.message?.includes("suspended_at")) {
    fail("/internal/agency suspend", "run migration 0018_agency_suspend_connect_onboarding.sql");
  } else if (orgs.error) {
    fail("/internal/agency", orgs.error.message);
  } else {
    pass("/internal/agency org list", `${orgs.data?.length ?? 0} orgs`);
    pass("/internal/agency suspend column", "present");
    pass("/internal/dealer onboarding column", "present");
  }

  if (authUser?.id && orgs.data?.length) {
    const orgId = orgs.data[0].id;
    await os.from("profiles").update({ organization_id: orgId }).eq("id", authUser.id);
    const party = await os
      .from("parties")
      .insert({
        organization_id: orgId,
        full_name: "Smoke Test Buyer",
        email: `smoke-buyer-${Date.now()}@example.com`,
      })
      .select("id")
      .single();
    if (party.error) fail("Create party", party.error.message);
    else {
      const deal = await os
        .from("deals")
        .insert({
          organization_id: orgId,
          party_id: party.data.id,
          vehicle_label: "Smoke Test Unit",
          status: "working",
          sale_price: 15000,
          down_payment: 2000,
        })
        .select("id")
        .single();
      if (deal.error) fail("Create deal", deal.error.message);
      else {
        const pay = await os.from("deal_payments").insert({
          deal_id: deal.data.id,
          amount: 500,
          method: "cash",
        });
        if (pay.error) fail("Log payment", pay.error.message);
        else pass("/internal/dealer deal+payment", `deal ${deal.data.id}`);
        await os.from("deal_payments").delete().eq("deal_id", deal.data.id);
        await os.from("deals").delete().eq("id", deal.data.id);
        await os.from("parties").delete().eq("id", party.data.id);
      }
    }
  }
}

if (cc) {
  const email = `ghl-smoke-${Date.now()}@example.com`;
  const ins = await cc.from("incoming_leads").insert({
    contact_name: "GHL Smoke Buyer",
    email,
    status: "New Lead",
    opportunity_name: "Dealer Sales · New lead",
    notes: "smoke-test",
  }).select("id").single();
  if (ins.error) fail("GHL dealer lead path", ins.error.message);
  else {
    pass("GHL dealer lead path", `lead ${ins.data.id}`);
    await cc.from("incoming_leads").delete().eq("id", ins.data.id);
  }
}

const stripeKey = env.STRIPE_SECRET_KEY?.trim();
if (!stripeKey) fail("/internal/billing Stripe", "STRIPE_SECRET_KEY not set");
else pass("/internal/billing Stripe", "key present (Checkout needs price IDs)");

console.log("\n=== Smoke results ===\n");
for (const r of results) {
  console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
  console.log(`       ${r.detail}\n`);
}
const failed = results.filter((r) => !r.ok).length;
process.exit(failed ? 1 : 0);
