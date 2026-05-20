#!/usr/bin/env node
/**
 * Set Supabase Auth app_metadata.role = "admin" for owner .net access.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.
 *
 * Usage:
 *   node scripts/set-admin-role.mjs --email you@example.com
 */
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

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
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email" && argv[i + 1]) return argv[++i]
  }
  return null
}

async function findUserIdByEmail(adminClient, email) {
  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match.id
    if (data.users.length < perPage) break
    page++
  }
  return null
}

loadDotEnv()

const email = parseArgs()
if (!email) {
  console.error("Usage: node scripts/set-admin-role.mjs --email you@example.com")
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url?.trim() || !serviceKey?.trim()) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const userId = await findUserIdByEmail(admin, email)
if (!userId) {
  console.error(`No user found for ${email}`)
  process.exit(1)
}

const { data: existing, error: getErr } = await admin.auth.admin.getUserById(userId)
if (getErr) throw getErr

const app_metadata = { ...(existing.user.app_metadata ?? {}), role: "admin" }
const { error: updateErr } = await admin.auth.admin.updateUserById(userId, { app_metadata })
if (updateErr) throw updateErr

console.log(`Set app_metadata.role=admin for ${email}`)
console.log("Sign out and sign in again (or wait for JWT refresh) before testing .net/command.")
