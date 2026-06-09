#!/usr/bin/env node
/**
 * Set app_metadata.role=admin for an existing Supabase Auth user.
 *
 * Usage:
 *   node scripts/set-admin-role.mjs user@example.com
 *   npm run set-admin-role -- user@example.com
 */
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv } from "./load-env.mjs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/set-admin-role.mjs <email>");
  process.exit(1);
}

if (!loadProjectEnv()) {
  console.error("Missing .env or .env.local");
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

async function findUserIdByEmail(adminClient, target) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === target);
    if (u) return u.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

const userId = await findUserIdByEmail(supabase, email);
if (!userId) {
  console.error(`No user found: ${email}`);
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.updateUserById(userId, {
  app_metadata: { role: "admin" },
});
if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`✓ ${email} → app_metadata.role=admin (${data.user.id})`);
console.log("  Login → /command on owner hub");
