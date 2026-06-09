#!/usr/bin/env node
/**
 * Bulk-provision operator / dealer / partner logins in Supabase Auth.
 * Creates (or updates) users with the right `app_metadata.role` so middleware
 * scopes them to their portal. They get a hosted login — never the repo/secrets.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.
 *
 * Usage:
 *   # one at a time:
 *   node scripts/provision-operators.mjs --email sam@x.com --role operator
 *   node scripts/provision-operators.mjs --email dealer@x.com --role partner --password 'SetThis123!'
 *
 *   # bulk from CSV (header: email,role[,password]):
 *   node scripts/provision-operators.mjs --file operators.csv
 *
 * Roles: operator | vendor | partner | executive | admin (see src/lib/auth-roles.ts).
 * If no password is given, a strong one is generated and printed ONCE.
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { randomBytes } from "crypto"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const envPath = join(root, ".env")

const VALID_ROLES = new Set(["operator", "vendor", "partner", "executive", "admin", "investor", "executive_va", "internal_team", "va"])

function loadDotEnv() {
  if (!existsSync(envPath)) { console.error("✗ Missing .env at project root."); process.exit(1) }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (!(key in process.env) || process.env[key] === "") process.env[key] = val
  }
}

function parseArgs() {
  const a = process.argv.slice(2)
  const out = { email: null, role: null, password: null, file: null }
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--email") out.email = a[++i]
    else if (a[i] === "--role") out.role = a[++i]
    else if (a[i] === "--password") out.password = a[++i]
    else if (a[i] === "--file") out.file = a[++i]
  }
  return out
}

function strongPassword() {
  // 16 url-safe chars + guaranteed symbol/number so it meets common policies.
  return randomBytes(12).toString("base64").replace(/[+/=]/g, "").slice(0, 14) + "9!"
}

function rowsFromCsv(path) {
  const lines = readFileSync(path, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
  const header = lines.shift().split(",").map((h) => h.trim().toLowerCase())
  const ei = header.indexOf("email"), ri = header.indexOf("role"), pi = header.indexOf("password")
  if (ei === -1 || ri === -1) { console.error("✗ CSV needs at least 'email,role' columns."); process.exit(1) }
  return lines.map((l) => {
    const c = l.split(",").map((x) => x.trim())
    return { email: c[ei], role: c[ri], password: pi >= 0 ? (c[pi] || null) : null }
  })
}

async function findUserIdByEmail(admin, email) {
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())
    if (u) return u.id
    if (data.users.length < 200) return null
    page += 1
  }
}

async function provision(admin, { email, role, password }) {
  if (!email || !role) return { email, role, status: "skipped (missing email/role)" }
  if (!VALID_ROLES.has(role)) return { email, role, status: `skipped (invalid role; use ${[...VALID_ROLES].join("/")})` }
  const pass = password || strongPassword()
  const existingId = await findUserIdByEmail(admin, email)

  if (existingId) {
    const upd = { app_metadata: { role } }
    if (password) upd.password = password
    const { error } = await admin.auth.admin.updateUserById(existingId, upd)
    return { email, role, password: password ? pass : "(unchanged)", status: error ? `error: ${error.message}` : "updated role" }
  }

  const { error } = await admin.auth.admin.createUser({
    email, password: pass, email_confirm: true, app_metadata: { role },
  })
  return { email, role, password: pass, status: error ? `error: ${error.message}` : "created" }
}

async function main() {
  loadDotEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error("✗ Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env"); process.exit(1) }

  const args = parseArgs()
  const rows = args.file ? rowsFromCsv(args.file) : [{ email: args.email, role: args.role, password: args.password }]
  if (!rows.length || (!args.file && !args.email)) {
    console.error("Usage: --email x@y.com --role operator   |   --file operators.csv"); process.exit(1)
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  console.log(`\nProvisioning ${rows.length} account(s)…\n`)
  const results = []
  for (const r of rows) results.push(await provision(admin, r))

  console.log("email".padEnd(34) + "role".padEnd(12) + "status".padEnd(18) + "password")
  console.log("-".repeat(90))
  for (const r of results) {
    console.log((r.email || "").padEnd(34) + (r.role || "").padEnd(12) + (r.status || "").padEnd(18) + (r.password || ""))
  }
  console.log("\n⚠  Passwords are shown ONCE. Send each operator their login over a secure channel,")
  console.log("   and have them change it on first sign-in (or use the /login/forgot reset flow).")
}

main().catch((e) => { console.error(e); process.exit(1) })
