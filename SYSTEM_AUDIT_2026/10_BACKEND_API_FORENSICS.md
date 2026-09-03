# 10 · BACKEND / API FORENSICS

## 28 API routes
| Route | Purpose | Auth | Status |
|---|---|---|---|
| `leads/webhook` | **Public lead intake** | `?org=` slug + rate limit (3/min/IP) | 🔴 **500 — 2,381 failures** |
| `webhooks/ghl` (+contact, form, appointment, overdue, program) | GHL inbound | `GHL_WEBHOOK_SECRET` + idempotency | 🟢 |
| `webhooks/airtable` (+locations) | Airtable automations | `SYNC_WEBHOOK_SECRET` header | 🟠 should not still exist |
| `agent/sms/inbound` | Twilio SMS | public path | 🔵 0 conversations |
| `agent/voice/ghl` | Voice handler | `GHL_VOICE_WEBHOOK_SECRET` | 🔵 |
| `agent/stripe/webhook/[slug]` | Payments | Stripe sig | 🟡 |
| `agent/cal/webhook/[slug]` | Booking | slug | 🟡 |
| `agent/health` | Health | public | 🟢 |
| `cron/journey-recompute` | Daily 04:00 | `CRON_SECRET` | 🟡 |
| `cron/marketing-kpi-ghl` | Weekly Mon 13:00 | `CRON_SECRET` | 🟡 |
| `license/provision`, `/revoke`, `/heartbeat` | Licensing | secret | 🟡 |
| `forms/submit` | Form intake | public | 🟢 |
| `cube/application` | Program apply | — | 🔵 tested, 0 rows |
| `mission/generate` | Telegram digest | `CRON_SECRET` | 🟢 |
| `ops/command` | Ops actions | staff | 🟡 |
| `pocket/chat` | Assistant | session | 🟡 |
| `audit/events` | Audit write | service | 🟢 |
| `offline/merge` | PWA sync | session | 🟡 |
| `auth/callback`, `health` | — | public | 🟢 |

## 🔴 The lead webhook, in full
**Route:** `src/app/api/leads/webhook/route.ts`
**Flow:** `?org=<slug>` (line 77) → rate limit (81) → `resolveOrgBySlugPublic(slug)` (89) → validate → insert `incoming_leads`.

**Failure 1 — RESOLVED 2026-09-01T19:29:28Z**
`Error: Supabase env vars not configured (URL + SERVICE_ROLE_KEY)` — **2,197 occurrences** from 2026-08-19T22:27:12Z. Vercel production was missing `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

**Failure 2 — BEGAN 2026-09-01T19:30:09Z, 41 seconds later**
```
OrgRowShapeError: Org row failed schema validation for slug:aixmos
  path: ["id"]   code: invalid_format   format: "uuid"   message: "Invalid UUID"
```
**184 occurrences** to 2026-09-01T23:28:53Z.

**Root cause — CONFIRMED in code:**
- `src/lib/agent/tenant.ts:60` — `OrgRowSchema = z.object({ id: OrgIdSchema, … })` where `OrgIdSchema` requires a UUID; throws `OrgRowShapeError` at `:84` and `:104`.
- `src/lib/platform/tenant-map.generated.ts:38` — `"aixmos": { id: "aixmos", … }`
- `:60` — `"moe_legacy": { id: "moe-legacy", … }`
- `:82` — `"tmmt_property": { id: "tmmt", … }`

**Every tenant id in the generated map is a slug string, not a UUID.** The resolver demands a UUID. Introduced by the 2026-08-27 host-tenancy commit `be9b38ee0`.

**Remaining UNKNOWN:** whether `organizations.id` in the database is itself non-UUID, or whether the static map is the source. Resolved by one read-only query — see `00_MASTER_SYSTEM_AUDIT.md` §7.

**Why no errors after 23:28 on 09-01:** either a fix, or **no traffic**. Query 2 in §7 distinguishes these. Do not assume the former.

## Cross-cutting
- **Rate limiting** on the lead webhook (3/min/IP) — good.
- **Webhook idempotency** for GHL (`20260825_ghl_webhook_idempotency`) — good.
- **PII redaction** (`lib/agent/redact-pii.ts`, tested) — good.
- **Secrets** all read from env; none committed. `.env.example` documents ~60 vars with no values.
- **No global error taxonomy** — routes return ad-hoc `{error}` shapes.
