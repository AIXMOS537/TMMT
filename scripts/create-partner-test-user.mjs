#!/usr/bin/env node
/**
 * Dev-only: create (or update) a Supabase Auth user with role=partner and one partner_fleet_access row.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env (or env).
 *
 * Usage:
 *   node scripts/create-partner-test-user.mjs
 *   node scripts/create-partner-test-user.mjs --email you@example.com --password 'SecurePass123!'
 *   node scripts/create-partner-test-user.mjs --fleet-id <uuid>   # optional; default = first fleet row
 *
 * Env (optional defaults):
 *   PARTNER_TEST_EMAIL
 *   PARTNER_TEST_PASSWORD  (if omitted, a random password is generated and printed once)
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { randomBytes } from "crypto"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = join(root, ".env")

function loadDotEnv() {
  if (!existsSync(envPath)) {
    console.error("Missing .env at project root.")
    process.exit(1)
  }
  const raw = readFileSync(envPath, "utf8")
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = val
    }
  }
}

function parseArgs() {
  const argv = process.argv.slice(2)
  const out = { email: null, password: null, fleetId: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email" && argv[i + 1]) out.email = argv[++i]
    else if (argv[i] === "--password" && argv[i + 1]) out.password = argv[++i]
    else if (argv[i] === "--fleet-id" && argv[i + 1]) out.fleetId = argv[++i]
  }
  return out
}

async function findUserIdByEmail(adminClient, email) {
  let page = 1
  const perPage = 200
  for (;;) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())
    if (u) return u.id
    if (data.users.length < perPage) return null
    page += 1
  }
}

loadDotEnv()
const args = parseArgs()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}

const email =
  args.email ||
  process.env.PARTNER_TEST_EMAIL ||
  "partner-portal-test@tmmt-rentals.local"
let password =
  args.password || process.env.PARTNER_TEST_PASSWORD || null
if (!password) {
  password = randomBytes(12).toString("base64url") + "Aa1!"
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  let userId = await findUserIdByEmail(supabase, email)

  if (userId) {
    console.log(`User already exists: ${email}`)
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      app_metadata: { role: "partner" },
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user.id
    console.log("Updated app_metadata.role=partner and password.")
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "partner" },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`Created user: ${email}`)
  }

  let fleetId = args.fleetId
  if (!fleetId) {
    const { data: fleets, error: fe } = await supabase
      .from("fleet")
      .select("id, vehicle_name, vehicle_make, vehicle_model")
      .order("created_at", { ascending: true })
      .limit(1)
    if (fe) {
      console.error("Could not read fleet table:", fe.message)
      console.error("Apply migration 20260503120000_partner_portal_rls.sql if partner_fleet_access is missing.")
      process.exit(1)
    }
    if (!fleets?.length) {
      console.error("No rows in fleet — add a vehicle first, or pass --fleet-id <uuid>.")
      process.exit(1)
    }
    fleetId = fleets[0].id
    console.log(
      `Linking to fleet: ${fleets[0].vehicle_name || fleets[0].vehicle_make || fleetId} (${fleetId})`
    )
  }

  console.log("")
  console.log("--- Credentials (save now) ---")
  console.log(`Email:    ${email}`)
  console.log(`Password: ${password}`)
  console.log(`User id:  ${userId}`)
  console.log(`Fleet id: ${fleetId}`)
  console.log("")

  const { error: linkErr } = await supabase.from("partner_fleet_access").upsert(
    { partner_user_id: userId, fleet_id: fleetId },
    { onConflict: "partner_user_id,fleet_id" }
  )
  if (linkErr) {
    console.error("partner_fleet_access upsert failed:", linkErr.message)
    console.error("Apply supabase/migrations/20260503120000_partner_portal_rls.sql in the Supabase SQL editor, then run:")
    console.error(
      `  INSERT INTO partner_fleet_access (partner_user_id, fleet_id) VALUES ('${userId}', '${fleetId}') ON CONFLICT (partner_user_id, fleet_id) DO NOTHING;`
    )
    console.error("Or re-run: npm run create-partner-test-user")
    process.exit(1)
  }

  console.log("--- Partner portal test user ready ---")
  console.log("Sign in at: http://localhost:3000/login → expect http://localhost:3000/partner")
  console.log("(Delete or rotate this user in Supabase when done testing.)")
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
