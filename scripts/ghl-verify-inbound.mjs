#!/usr/bin/env node
/**
 * Prove the GHL inbound rail actually works — end to end, against a real deployment.
 *
 * WHY. As of 2026-09-20 `ghl_webhook_events`, `ghl_form_submissions` and `ghl_appointments`
 * all hold ZERO rows. The endpoints are live and the secret is set, so nothing is broken —
 * GHL has simply never been pointed at them. The moment someone wires it up, the question
 * becomes "did that actually work?", and a 200 from the endpoint does not answer it: the
 * route can accept a payload and still write nothing.
 *
 * So this sends a signed webhook AND then reads the database back. Only the row counts.
 *
 * USAGE
 *   GHL_WEBHOOK_SECRET=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/ghl-verify-inbound.mjs [--base https://tmmt-ops.vercel.app]
 *
 * Exits 0 only when a row was written. Anything else is a non-zero exit and a reason.
 */

import { createHmac, randomUUID } from 'node:crypto'

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : dflt
}

const BASE = (arg('base', 'https://tmmt-ops.vercel.app')).replace(/\/$/, '')
const SECRET = process.env.GHL_WEBHOOK_SECRET
const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const fail = (msg) => { console.error(`\n  ✗ ${msg}\n`); process.exit(1) }

if (!SECRET) fail('GHL_WEBHOOK_SECRET is not set. It is the same value that must be configured on the GHL side.')
if (!SB_URL || !SB_KEY) fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required — this verifies the WRITE, not just the response.')

// A marker that is obviously synthetic, so a human reading the table later knows what it is
// and can remove it. Never a plausible-looking customer.
const STAMP = `ZZ_GHL_VERIFY_${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}_${randomUUID().slice(0, 8)}`

async function sb(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  })
  if (!res.ok) fail(`Supabase read failed (${res.status}) on ${path}`)
  return res.json()
}

async function post(path, body) {
  const raw = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // Both accepted paths are exercised: the shared secret header that GHL workflows
      // use, and the HMAC signature that marketplace apps use. If either is misconfigured
      // this is where it shows.
      'x-ghl-webhook-secret': SECRET,
      'x-ghl-signature': createHmac('sha256', SECRET).update(raw).digest('hex'),
      'x-ghl-timestamp': String(Date.now()),
    },
    body: raw,
  })
  return { status: res.status, text: await res.text().catch(() => '') }
}

console.log(`\n  GHL inbound verification`)
console.log(`  target: ${BASE}`)
console.log(`  marker: ${STAMP}\n`)

// ── 1. before ────────────────────────────────────────────────────────────────
const before = (await sb('ghl_webhook_events?select=*&limit=1000')).length
console.log(`  ghl_webhook_events before: ${before}`)

// ── 2. send ──────────────────────────────────────────────────────────────────
const eventId = randomUUID()
const r = await post('/api/webhooks/ghl/form', {
  id: eventId,
  event: 'form_submission',
  form_id: 'verify-form',
  location_id: process.env.GHL_LOCATION_ID || 'verify-location',
  email: `${STAMP.toLowerCase()}@verify.invalid`,
  name: STAMP,
  timestamp: Date.now(),
})
console.log(`  POST /api/webhooks/ghl/form -> ${r.status}`)

if (r.status === 401) {
  fail('401 — the secret this script sent does not match the one the deployment expects.\n' +
       '    Fix: make GHL_WEBHOOK_SECRET here, in Vercel, and in the GHL workflow all the same value.')
}
if (r.status >= 400) fail(`${r.status} from the endpoint: ${r.text.slice(0, 300)}`)

// ── 3. after — the part that actually matters ────────────────────────────────
await new Promise(res => setTimeout(res, 2000))
const after = (await sb('ghl_webhook_events?select=*&limit=1000')).length
const forms = await sb(`ghl_form_submissions?select=*&limit=50`)
const mine = forms.filter(f => JSON.stringify(f).includes(STAMP))

console.log(`  ghl_webhook_events after:  ${after}`)
console.log(`  matching form submission:  ${mine.length}`)

if (after <= before && mine.length === 0) {
  fail('The endpoint returned 200 but NOTHING was written.\n' +
       '    A 200 is not proof: the route can accept a payload and persist nothing.\n' +
       '    Check the route handler and that the migrations behind these tables are applied.')
}

console.log(`\n  ✓ Inbound works. A real webhook reached the app and landed in the database.`)
console.log(`  Remove the marker row when you are done:  ${STAMP}\n`)
