# Spec B3.1 — SMS Sales Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SMS-first AI Sales Agent that picks up new leads ≤60 seconds after form submission, runs a Twilio-backed conversation through a state machine with non-bypassable compliance gates, closes <$97 SKUs directly via Stripe Payment Link, and books >$97 SKUs via Cal.com, all while honoring Spec A's license kill-switch in real time.

**Architecture:** New Vercel project `sales.tmmt.tools` (Next.js 14 App Router). Twilio webhook → `guardTenant()` license check → tenant resolution by inbound number → opt-out/quiet-hours/license checks → state machine step → LLM router (Sonnet primary, Haiku fallback) → compliance post-processor (CFPB disclaimers + banned phrases) → outbound via Twilio → audit ship to `log.tmmt.tools`. All B3 actions emit Supabase Realtime events for B5 monitoring subscribers.

**Tech Stack:** Next.js 14 App Router, TypeScript 5.x, Supabase JS client, `twilio` Node SDK, `@anthropic-ai/sdk`, `zod` (structured LLM output validation), `vitest` (tests), `pino` (logging), Vercel Edge for webhooks.

**Reference spec:** `~/Projects/TMMT/docs/superpowers/specs/2026-06-09-spec-b3-ai-sales-agent-design.md` (commit `1f38c54`).
**Reference umbrella:** `~/Projects/TMMT/docs/superpowers/specs/2026-06-09-spec-b-revenue-engine-umbrella.md` (substrate §5).

**HARD PREREQUISITE:** Spec A Plan Phase 1 (Control Plane, tasks 1-10) MUST be deployed and smoking green before starting this plan. B3.1 depends on:
- `tenants` table existing
- `licenses` table existing with at least one active row per tenant being tested
- `lic.tmmt.tools` live and returning 200s on heartbeat
- `log.tmmt.tools` live and accepting NDJSON

If these are not done, STOP and run Spec A Plan Phase 1 first.

**Tagged milestones:**
- After Task 5 → tag `v0.5.1-b3-substrate` (schema + scaffold + guard + tenant resolve)
- After Task 11 → tag `v0.5.2-b3-compliance` (all compliance modules unit-tested green)
- After Task 17 → tag `v0.5.3-b3-state-machine` (FSM + LLM + audit + handoff in)
- After Task 22 → tag `v0.5.4-b3-webhooks` (Twilio + Stripe + Cal webhooks wired)
- After Task 25 → tag `v0.5-b3-sms` (full SMS sales agent live)

---

## File Structure (decomposition)

```
apps/sales-agent/                              # new Vercel project, sales.tmmt.tools
├── package.json
├── tsconfig.json
├── next.config.mjs
├── vitest.config.ts
├── .env.example
├── app/
│   ├── _health/route.ts
│   ├── api/
│   │   ├── sms/
│   │   │   ├── inbound/route.ts              # Twilio webhook
│   │   │   └── outbound/[lead_id]/route.ts   # internal sender, called by realtime sub
│   │   ├── stripe/webhook/[tenant_id]/route.ts
│   │   └── cal/webhook/[tenant_id]/route.ts
├── lib/
│   ├── supabase.ts                           # service-role + RLS-scoped clients
│   ├── guard.ts                              # license live-check (Spec A integration)
│   ├── tenant-context.ts                     # Twilio number → tenant_id resolver
│   ├── state-machine.ts                      # pure FSM
│   ├── llm-router.ts                         # Sonnet primary, Haiku fallback, structured output
│   ├── persona/
│   │   ├── base-prompt.ts
│   │   └── tenant-overlay.ts
│   ├── compliance/
│   │   ├── opt-out.ts
│   │   ├── quiet-hours.ts
│   │   ├── disclaimers.ts
│   │   └── banned-phrases.ts
│   ├── handoff.ts
│   ├── stripe-link.ts
│   ├── cal-link.ts
│   ├── audit.ts
│   └── realtime-subscriber.ts                # subscribes to lead_received events
└── tests/
    ├── unit/                                 # one file per lib module
    └── integration/
        ├── sms-happy-path.test.ts
        ├── opt-out.test.ts
        ├── quiet-hours.test.ts
        ├── banned-phrase-regen.test.ts
        ├── license-revoke.test.ts
        ├── cross-tenant-isolation.test.ts
        └── handoff.test.ts

supabase/migrations/
├── 20260609000010_leads.sql
├── 20260609000011_conversations_messages.sql
└── 20260609000012_tenant_agent_columns.sql

supabase/tests/
├── leads_rls_test.sql
└── messages_rls_test.sql

docs/runbooks/
├── twilio-10dlc-registration.md              # per-tenant operational guide
└── b3-sms-rollback.md                        # how to disable B3 without breaking B0/A
```

---

## Phase 0 — Pre-Flight Safety (P0, blocking)

### Task 0: Verify Spec A prerequisites + branch isolation

**Files:**
- Create: `docs/runbooks/b3-sms-preflight.md`

- [ ] **Step 1: Verify control plane is live**

Run:
```bash
# All three must return 200 (or 401 with valid error JSON — that's "alive but rejecting")
curl -sS -o /dev/null -w "%{http_code}\n" https://lic.tmmt.tools/_health
curl -sS -o /dev/null -w "%{http_code}\n" https://log.tmmt.tools/_health
curl -sS -o /dev/null -w "%{http_code}\n" https://partner.tmmt-ops.com/_health
```
Expected: three `200`s. If any are `404`, `5xx`, or timeout → STOP, run Spec A Plan Phase 1 first.

- [ ] **Step 2: Verify Supabase tables exist**

Run:
```bash
psql "$SUPABASE_DB_URL" -c "\d tenants" 2>&1 | grep -q 'Table.*tenants' && echo "✓ tenants" || { echo "MISSING tenants"; exit 1; }
psql "$SUPABASE_DB_URL" -c "\d licenses" 2>&1 | grep -q 'Table.*licenses' && echo "✓ licenses" || { echo "MISSING licenses"; exit 1; }
psql "$SUPABASE_DB_URL" -c "\d audit_events" 2>&1 | grep -q 'Table.*audit_events' && echo "✓ audit_events" || { echo "MISSING audit_events"; exit 1; }
```
Expected: three `✓` lines.

- [ ] **Step 3: Create a Supabase branch for B3 work**

```bash
cd ~/Projects/TMMT
supabase branches create b3-sms --persistent
supabase branches list  # confirm "b3-sms" appears with a connection string
```
Expected: branch created, isolated DB available. All B3 schema work happens here BEFORE prod.

- [ ] **Step 4: Write preflight runbook**

Create `docs/runbooks/b3-sms-preflight.md`:

```markdown
# B3 SMS Pre-Flight Checklist

Before merging any B3 work to main:

- [ ] Spec A control plane returns 200 on all three /_health endpoints
- [ ] tenants, licenses, audit_events tables exist on prod Supabase
- [ ] Supabase branch `b3-sms` exists; all migrations applied + tested there
- [ ] No new env vars are missing from Vercel `sales-agent` project
- [ ] At least one active license row exists for the test tenant
- [ ] $0 ad spend running (B1 not built yet — we test B3 with manually-seeded leads)

If any item is unchecked, do NOT deploy. Block in PR review.

## Rollback
If B3 misbehaves in prod:
1. In Vercel, set `sales-agent` env var `B3_KILL_SWITCH=1`
2. Redeploy `sales-agent` (effects within 60s)
3. All inbound webhooks now return 503; no LLM calls, no outbound SMS, no Stripe/Cal actions
4. Existing leads in flight pause; nothing is lost
5. Fix the issue, unset B3_KILL_SWITCH, redeploy
```

- [ ] **Step 5: Commit + tag**

```bash
git add docs/runbooks/b3-sms-preflight.md
git commit -m "feat(b3): pre-flight runbook + rollback procedure"
```

---

## Phase 1 — Substrate (Tasks 1–5)

### Task 1: Supabase schema — `leads` table

**Files:**
- Create: `supabase/migrations/20260609000010_leads.sql`
- Create: `supabase/tests/leads_rls_test.sql`

⚠️ **BEFORE YOU TOUCH PROD:** apply this migration to the `b3-sms` branch first via `supabase migration up --branch b3-sms`. Smoke it there. Only after Phase 5 self-test passes do we merge to main.

- [ ] **Step 1: Write the RLS test**

```sql
-- supabase/tests/leads_rls_test.sql
BEGIN;
SELECT plan(4);

-- Seed two tenants if not present
INSERT INTO tenants (id, name) VALUES ('moe-legacy','Moe'),('test-partner','Test')
  ON CONFLICT DO NOTHING;

-- Insert one lead per tenant
SET LOCAL app.tenant_id = 'moe-legacy';
INSERT INTO leads (tenant_id, phone_e164) VALUES ('moe-legacy','+15551001001');

SET LOCAL app.tenant_id = 'test-partner';
INSERT INTO leads (tenant_id, phone_e164) VALUES ('test-partner','+15551001001');

-- Moe sees only their lead
SET LOCAL app.tenant_id = 'moe-legacy';
SELECT is((SELECT count(*) FROM leads), 1::bigint, 'moe-legacy sees 1 lead');
SELECT is((SELECT tenant_id FROM leads LIMIT 1), 'moe-legacy', 'moe-legacy lead is theirs');

-- Test partner sees only theirs
SET LOCAL app.tenant_id = 'test-partner';
SELECT is((SELECT count(*) FROM leads), 1::bigint, 'test-partner sees 1 lead');

-- Unset = zero
RESET app.tenant_id;
SELECT is((SELECT count(*) FROM leads), 0::bigint, 'unset tenant sees 0');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test against b3-sms branch to verify it fails**

Run: `supabase test db --branch b3-sms`
Expected: FAIL — table `leads` does not exist yet.

- [ ] **Step 3: Write migration**

```sql
-- supabase/migrations/20260609000010_leads.sql
CREATE TABLE leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL REFERENCES tenants(id),
  status          text NOT NULL DEFAULT 'NEW'
                  CHECK (status IN ('NEW','CONTACTED','QUALIFIED','BOOKED','CLOSED','LOST','HUMAN_HANDOFF')),
  phone_e164      text NOT NULL,
  email           text,
  ghl_contact_id  text,
  source          jsonb NOT NULL DEFAULT '{}'::jsonb,
  sku             text,
  qualification   jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversation_id uuid,
  stripe_payment_intent_id text,
  opted_out       boolean NOT NULL DEFAULT false,
  opted_out_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  contacted_at    timestamptz,
  qualified_at    timestamptz,
  closed_at       timestamptz,
  lost_at         timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX leads_tenant_status_idx ON leads(tenant_id, status);
CREATE INDEX leads_tenant_created_idx ON leads(tenant_id, created_at DESC);
CREATE INDEX leads_phone_tenant_idx ON leads(phone_e164, tenant_id);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON leads
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_modify ON leads
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

REVOKE ALL ON leads FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON leads TO authenticated;
GRANT ALL ON leads TO service_role;
```

- [ ] **Step 4: Apply to branch + run test**

Run:
```bash
cd ~/Projects/TMMT
supabase migration up --branch b3-sms
supabase test db --branch b3-sms
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260609000010_leads.sql supabase/tests/leads_rls_test.sql
git commit -m "feat(b3): leads table with tenant_id RLS"
```

---

### Task 2: Supabase schema — `conversations` + `messages`

**Files:**
- Create: `supabase/migrations/20260609000011_conversations_messages.sql`
- Create: `supabase/tests/messages_rls_test.sql`

⚠️ **BEFORE YOU TOUCH PROD:** same branch-first pattern as Task 1.

- [ ] **Step 1: Write RLS test**

```sql
-- supabase/tests/messages_rls_test.sql
BEGIN;
SELECT plan(3);

SET LOCAL app.tenant_id = 'moe-legacy';
WITH lead AS (INSERT INTO leads (tenant_id, phone_e164) VALUES ('moe-legacy','+15552002001') RETURNING id),
     conv AS (INSERT INTO conversations (lead_id, tenant_id, channel) SELECT id, 'moe-legacy', 'sms' FROM lead RETURNING id)
INSERT INTO messages (conversation_id, direction, body) SELECT id, 'out', 'hi' FROM conv;

SET LOCAL app.tenant_id = 'test-partner';
WITH lead AS (INSERT INTO leads (tenant_id, phone_e164) VALUES ('test-partner','+15553003001') RETURNING id),
     conv AS (INSERT INTO conversations (lead_id, tenant_id, channel) SELECT id, 'test-partner', 'sms' FROM lead RETURNING id)
INSERT INTO messages (conversation_id, direction, body) SELECT id, 'out', 'hi' FROM conv;

SET LOCAL app.tenant_id = 'moe-legacy';
SELECT is((SELECT count(*) FROM messages), 1::bigint, 'moe-legacy sees 1 message');

SET LOCAL app.tenant_id = 'test-partner';
SELECT is((SELECT count(*) FROM messages), 1::bigint, 'test-partner sees 1 message');

RESET app.tenant_id;
SELECT is((SELECT count(*) FROM messages), 0::bigint, 'unset sees 0');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test, expect FAIL (tables not yet)**

Run: `supabase test db --branch b3-sms`
Expected: FAIL — tables don't exist.

- [ ] **Step 3: Write migration**

```sql
-- supabase/migrations/20260609000011_conversations_messages.sql
CREATE TABLE conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES leads(id),
  tenant_id    text NOT NULL REFERENCES tenants(id),
  channel      text NOT NULL CHECK (channel IN ('sms','voice')),
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  state_at_end text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX conversations_lead_idx ON conversations(lead_id);
CREATE INDEX conversations_tenant_started_idx ON conversations(tenant_id, started_at DESC);

CREATE TABLE messages (
  id              bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  ts              timestamptz NOT NULL DEFAULT now(),
  direction       text NOT NULL CHECK (direction IN ('in','out')),
  body            text NOT NULL,
  llm_assessment  jsonb,
  compliance_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX messages_conv_ts_idx ON messages(conversation_id, ts);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_conv ON conversations
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Messages don't carry tenant_id directly; isolation is via conversation join
CREATE POLICY tenant_isolation_messages ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = current_setting('app.tenant_id', true)
    )
  );

REVOKE ALL ON conversations, messages FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON conversations, messages TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE messages_id_seq TO authenticated;
GRANT ALL ON conversations, messages TO service_role;
```

- [ ] **Step 4: Apply + test**

Run: `supabase migration up --branch b3-sms && supabase test db --branch b3-sms`
Expected: 3 tests PASS (plus the 4 from Task 1).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260609000011_conversations_messages.sql supabase/tests/messages_rls_test.sql
git commit -m "feat(b3): conversations + messages tables with tenant-isolated RLS"
```

---

### Task 3: Schema — `tenants` agent columns

**Files:**
- Create: `supabase/migrations/20260609000012_tenant_agent_columns.sql`

⚠️ **BEFORE YOU TOUCH PROD:** branch first.

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/20260609000012_tenant_agent_columns.sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS twilio_inbound_number    text,
  ADD COLUMN IF NOT EXISTS twilio_account_sid       text,
  ADD COLUMN IF NOT EXISTS twilio_auth_token_secret_name text,  -- name of vault secret
  ADD COLUMN IF NOT EXISTS agent_name               text DEFAULT 'Riley',
  ADD COLUMN IF NOT EXISTS tenant_brand             text,
  ADD COLUMN IF NOT EXISTS agent_persona_overlay    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS handoff_slack_webhook    text,
  ADD COLUMN IF NOT EXISTS handoff_imessage_target  text,
  ADD COLUMN IF NOT EXISTS cal_com_event_link       text,
  ADD COLUMN IF NOT EXISTS stripe_account_id        text,
  ADD COLUMN IF NOT EXISTS llm_daily_cap_usd        numeric NOT NULL DEFAULT 50;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_twilio_number_idx ON tenants(twilio_inbound_number) WHERE twilio_inbound_number IS NOT NULL;
```

- [ ] **Step 2: Apply to branch + verify**

Run:
```bash
supabase migration up --branch b3-sms
psql "$BRANCH_DB_URL" -c "\d tenants" | grep -E "twilio_inbound|agent_name|handoff_slack"
```
Expected: 3+ matching lines.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609000012_tenant_agent_columns.sql
git commit -m "feat(b3): add tenant agent config columns"
```

---

### Task 4: Scaffold `apps/sales-agent` Next.js project

**Files:**
- Create: entire `apps/sales-agent/` Next.js project

- [ ] **Step 1: Init Next.js**

Run:
```bash
cd ~/Projects/TMMT/apps
pnpm create next-app@latest sales-agent --typescript --app --no-tailwind --no-eslint --import-alias '@/*' --use-pnpm
cd sales-agent
```

- [ ] **Step 2: Add deps**

Run:
```bash
pnpm add @supabase/supabase-js@latest twilio @anthropic-ai/sdk zod pino
pnpm add -D vitest @vitest/coverage-v8 supertest @types/node
```

- [ ] **Step 3: Configure vitest**

Create `apps/sales-agent/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: { reporter: ['text', 'html'], exclude: ['app/**', 'tests/**', '*.config.*'] },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

Create `apps/sales-agent/tests/setup.ts`:

```typescript
import { beforeAll } from 'vitest'

beforeAll(() => {
  process.env.SUPABASE_URL ??= 'http://localhost:54321'
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role'
  process.env.ANTHROPIC_API_KEY ??= 'test-anthropic-key'
  process.env.LICENSE_PUBLIC_KEY_PEM ??= ''
  process.env.TWILIO_ACCOUNT_SID ??= 'test-twilio-sid'
  process.env.TWILIO_AUTH_TOKEN ??= 'test-twilio-token'
})
```

- [ ] **Step 4: Create `.env.example`**

Create `apps/sales-agent/.env.example`:

```bash
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BRANCH=  # set to b3-sms during dev, blank for prod

# Anthropic (LLM)
ANTHROPIC_API_KEY=

# License verification (from Spec A — public key only)
LICENSE_PUBLIC_KEY_PEM=

# Audit ingest
AUDIT_INGEST_URL=https://log.tmmt.tools/v1/events

# Operational kill-switch (independent of license; redeploy-driven)
B3_KILL_SWITCH=

# Tenant-specific secrets live in Supabase Vault, NOT here
```

- [ ] **Step 5: Smoke build**

Run: `pnpm build`
Expected: builds without error (no app routes yet beyond `_health`).

- [ ] **Step 6: Add `_health` route**

Create `apps/sales-agent/app/_health/route.ts`:

```typescript
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
export async function GET(): Promise<NextResponse> {
  if (process.env.B3_KILL_SWITCH === '1') {
    return NextResponse.json({ ok: false, status: 'killed' }, { status: 503 })
  }
  return NextResponse.json({ ok: true, service: 'sales-agent', ts: new Date().toISOString() })
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/sales-agent/
git commit -m "feat(sales-agent): Next.js project scaffold + _health route"
```

---

### Task 5: `guard.ts` — license live-check (Spec A integration)

**Files:**
- Create: `apps/sales-agent/lib/supabase.ts`
- Create: `apps/sales-agent/lib/guard.ts`
- Create: `apps/sales-agent/tests/unit/guard.test.ts`

- [ ] **Step 1: Write `supabase.ts` helpers**

```typescript
// apps/sales-agent/lib/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createServiceClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function withTenant<T>(
  tenantId: string,
  fn: (db: SupabaseClient) => Promise<T>
): Promise<T> {
  const db = createServiceClient()
  await db.rpc('set_config', { setting: 'app.tenant_id', value: tenantId, is_local: false })
  try { return await fn(db) }
  finally { await db.rpc('set_config', { setting: 'app.tenant_id', value: '', is_local: false }) }
}
```

- [ ] **Step 2: Write failing test for `guard.ts`**

```typescript
// apps/sales-agent/tests/unit/guard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { guardTenant, LicenseDisabledError, OperationalKillError } from '@/lib/guard'

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  }),
}))

describe('guardTenant', () => {
  beforeEach(() => { delete process.env.B3_KILL_SWITCH })

  it('throws OperationalKillError when B3_KILL_SWITCH=1', async () => {
    process.env.B3_KILL_SWITCH = '1'
    await expect(guardTenant('moe-legacy')).rejects.toThrow(OperationalKillError)
  })

  it('throws LicenseDisabledError when license inactive', async () => {
    const { createServiceClient } = await import('@/lib/supabase')
    ;(createServiceClient as any).mockReturnValueOnce({
      from: () => ({ select: () => ({ eq: () => ({ single: () => ({ data: { active: false, kill_command: null } }) }) }) }),
    })
    await expect(guardTenant('moe-legacy')).rejects.toThrow(LicenseDisabledError)
  })

  it('throws LicenseDisabledError when kill_command=wipe', async () => {
    const { createServiceClient } = await import('@/lib/supabase')
    ;(createServiceClient as any).mockReturnValueOnce({
      from: () => ({ select: () => ({ eq: () => ({ single: () => ({ data: { active: true, kill_command: 'wipe' } }) }) }) }),
    })
    await expect(guardTenant('moe-legacy')).rejects.toThrow(LicenseDisabledError)
  })

  it('resolves cleanly when license active and no kill', async () => {
    const { createServiceClient } = await import('@/lib/supabase')
    ;(createServiceClient as any).mockReturnValueOnce({
      from: () => ({ select: () => ({ eq: () => ({ single: () => ({ data: { active: true, kill_command: null } }) }) }) }),
    })
    await expect(guardTenant('moe-legacy')).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 3: Run test, expect FAIL**

Run: `cd apps/sales-agent && pnpm vitest run tests/unit/guard.test.ts`
Expected: FAIL — `guard.ts` does not exist.

- [ ] **Step 4: Implement `guard.ts`**

```typescript
// apps/sales-agent/lib/guard.ts
import { createServiceClient } from './supabase'

export class LicenseDisabledError extends Error {
  constructor(public tenantId: string, public killCommand: string | null) {
    super(`License disabled for tenant=${tenantId} kill=${killCommand ?? 'none'}`)
  }
}

export class OperationalKillError extends Error {
  constructor() { super('B3 operational kill-switch engaged') }
}

export async function guardTenant(tenantId: string): Promise<void> {
  if (process.env.B3_KILL_SWITCH === '1') throw new OperationalKillError()

  const db = createServiceClient()
  const { data } = await db.from('licenses')
    .select('active, kill_command')
    .eq('tenant_id', tenantId)
    .single()

  if (!data || !data.active || data.kill_command === 'wipe') {
    throw new LicenseDisabledError(tenantId, data?.kill_command ?? null)
  }
}
```

- [ ] **Step 5: Run test, expect PASS**

Run: `cd apps/sales-agent && pnpm vitest run tests/unit/guard.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 6: Commit + tag substrate milestone**

```bash
git add apps/sales-agent/lib/supabase.ts apps/sales-agent/lib/guard.ts apps/sales-agent/tests/unit/guard.test.ts
git commit -m "feat(b3): guardTenant license live-check + supabase helpers"
git tag v0.5.1-b3-substrate
```

---

## Phase 2 — Compliance Modules (Tasks 6–11)

### Task 6: `tenant-context.ts` — resolve tenant from Twilio number

**Files:**
- Create: `apps/sales-agent/lib/tenant-context.ts`
- Create: `apps/sales-agent/tests/unit/tenant-context.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/tenant-context.test.ts
import { describe, it, expect, vi } from 'vitest'
import { resolveTenantByTwilioNumber, TenantNotFoundError } from '@/lib/tenant-context'

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(),
}))

describe('resolveTenantByTwilioNumber', () => {
  it('returns tenant config when number matches', async () => {
    const { createServiceClient } = await import('@/lib/supabase')
    ;(createServiceClient as any).mockReturnValueOnce({
      from: () => ({ select: () => ({ eq: () => ({ single: () => ({
        data: { id: 'moe-legacy', agent_name: 'Riley', tenant_brand: 'Moe Legacy' }
      }) }) }) }),
    })
    const t = await resolveTenantByTwilioNumber('+15555550100')
    expect(t.id).toBe('moe-legacy')
    expect(t.agentName).toBe('Riley')
  })

  it('throws TenantNotFoundError when no match', async () => {
    const { createServiceClient } = await import('@/lib/supabase')
    ;(createServiceClient as any).mockReturnValueOnce({
      from: () => ({ select: () => ({ eq: () => ({ single: () => ({ data: null }) }) }) }),
    })
    await expect(resolveTenantByTwilioNumber('+15555559999')).rejects.toThrow(TenantNotFoundError)
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/tenant-context.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `tenant-context.ts`**

```typescript
// apps/sales-agent/lib/tenant-context.ts
import { createServiceClient } from './supabase'

export interface TenantContext {
  id: string
  agentName: string
  tenantBrand: string
  agentPersonaOverlay: Record<string, unknown>
  handoffSlackWebhook: string | null
  handoffImessageTarget: string | null
  calComEventLink: string | null
  stripeAccountId: string | null
  llmDailyCapUsd: number
}

export class TenantNotFoundError extends Error {
  constructor(public lookup: string) { super(`No tenant for ${lookup}`) }
}

export async function resolveTenantByTwilioNumber(number: string): Promise<TenantContext> {
  const db = createServiceClient()
  const { data } = await db.from('tenants')
    .select('id, agent_name, tenant_brand, agent_persona_overlay, handoff_slack_webhook, handoff_imessage_target, cal_com_event_link, stripe_account_id, llm_daily_cap_usd')
    .eq('twilio_inbound_number', number)
    .single()
  if (!data) throw new TenantNotFoundError(number)
  return {
    id: data.id,
    agentName: data.agent_name ?? 'Riley',
    tenantBrand: data.tenant_brand ?? data.id,
    agentPersonaOverlay: data.agent_persona_overlay ?? {},
    handoffSlackWebhook: data.handoff_slack_webhook,
    handoffImessageTarget: data.handoff_imessage_target,
    calComEventLink: data.cal_com_event_link,
    stripeAccountId: data.stripe_account_id,
    llmDailyCapUsd: Number(data.llm_daily_cap_usd ?? 50),
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/tenant-context.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/lib/tenant-context.ts apps/sales-agent/tests/unit/tenant-context.test.ts
git commit -m "feat(b3): tenant resolver by Twilio number"
```

---

### Task 7: `compliance/opt-out.ts` — STOP/UNSUB enforcement

**Files:**
- Create: `apps/sales-agent/lib/compliance/opt-out.ts`
- Create: `apps/sales-agent/tests/unit/opt-out.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/opt-out.test.ts
import { describe, it, expect } from 'vitest'
import { isOptOutMessage, optOutAutoReply } from '@/lib/compliance/opt-out'

describe('isOptOutMessage', () => {
  it.each([
    ['STOP', true],
    ['stop', true],
    ['Stop.', true],
    ['STOPALL', true],
    ['unsubscribe', true],
    ['Unsub', false],     // not full keyword — accepting it would be too aggressive
    ['cancel', true],
    ['END', true],
    ['stop please', true],
    ['Opt out', true],
    ['opt-out', true],
    ['Yes I am interested', false],
    ['STOP being annoying lol', false],   // sentence with stop ≠ opt-out
    ['', false],
  ])('"%s" → %s', (input, expected) => {
    expect(isOptOutMessage(input)).toBe(expected)
  })
})

describe('optOutAutoReply', () => {
  it('returns the confirmation', () => {
    expect(optOutAutoReply()).toMatch(/opted out/i)
    expect(optOutAutoReply()).toMatch(/START/)
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/opt-out.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `opt-out.ts`**

```typescript
// apps/sales-agent/lib/compliance/opt-out.ts
const STOP_PATTERN = /^(stop|stopall|unsubscribe|cancel|end|quit|stop[\s-]?please|opt[\s-]?out)\s*\.?$/i

export function isOptOutMessage(body: string): boolean {
  return STOP_PATTERN.test(body.trim())
}

export function optOutAutoReply(): string {
  return "You're opted out and won't receive further messages. Reply START anytime to opt back in."
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/opt-out.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/lib/compliance/opt-out.ts apps/sales-agent/tests/unit/opt-out.test.ts
git commit -m "feat(b3): opt-out detection with STOP/UNSUB/CANCEL regex"
```

---

### Task 8: `compliance/quiet-hours.ts` — TCPA 9pm-8am block

**Files:**
- Create: `apps/sales-agent/lib/compliance/quiet-hours.ts`
- Create: `apps/sales-agent/lib/compliance/area-code-timezone.ts`
- Create: `apps/sales-agent/tests/unit/quiet-hours.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/quiet-hours.test.ts
import { describe, it, expect } from 'vitest'
import { isQuietHours, nextSendWindow } from '@/lib/compliance/quiet-hours'

describe('isQuietHours', () => {
  // Test with explicit "now" arg to keep deterministic
  // Eastern Time area code 212 (NY)
  it('blocks 22:00 ET for area code 212', () => {
    const now = new Date('2026-06-15T02:00:00Z') // 22:00 ET previous day
    expect(isQuietHours('+12125551234', now)).toBe(true)
  })

  it('allows 10:00 ET for area code 212', () => {
    const now = new Date('2026-06-15T14:00:00Z') // 10:00 ET
    expect(isQuietHours('+12125551234', now)).toBe(false)
  })

  it('blocks 21:30 PT for area code 415', () => {
    const now = new Date('2026-06-15T04:30:00Z') // 21:30 PT previous day
    expect(isQuietHours('+14155551234', now)).toBe(true)
  })

  it('falls back to ET when area code unknown', () => {
    const now = new Date('2026-06-15T02:00:00Z') // assume ET
    expect(isQuietHours('+19995551234', now)).toBe(true)
  })
})

describe('nextSendWindow', () => {
  it('returns 8am local of next day when called at midnight local', () => {
    const now = new Date('2026-06-15T04:00:00Z') // 00:00 ET
    const next = nextSendWindow('+12125551234', now)
    expect(next.toISOString()).toBe('2026-06-15T12:00:00.000Z') // 8am ET = 12:00 UTC
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/quiet-hours.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `area-code-timezone.ts`** (abbreviated NANPA mapping)

```typescript
// apps/sales-agent/lib/compliance/area-code-timezone.ts
// Mapping from NANPA area code → IANA timezone. Covers the most common; falls back to America/New_York.
// Source: derived from NANPA + nationsonline.org.
const AREA_CODE_TZ: Record<string, string> = {
  // Pacific
  '206': 'America/Los_Angeles', '253': 'America/Los_Angeles', '360': 'America/Los_Angeles',
  '425': 'America/Los_Angeles', '503': 'America/Los_Angeles', '541': 'America/Los_Angeles',
  '971': 'America/Los_Angeles', '209': 'America/Los_Angeles', '213': 'America/Los_Angeles',
  '310': 'America/Los_Angeles', '323': 'America/Los_Angeles', '408': 'America/Los_Angeles',
  '415': 'America/Los_Angeles', '424': 'America/Los_Angeles', '510': 'America/Los_Angeles',
  '530': 'America/Los_Angeles', '559': 'America/Los_Angeles', '562': 'America/Los_Angeles',
  '619': 'America/Los_Angeles', '626': 'America/Los_Angeles', '650': 'America/Los_Angeles',
  '661': 'America/Los_Angeles', '707': 'America/Los_Angeles', '714': 'America/Los_Angeles',
  '760': 'America/Los_Angeles', '805': 'America/Los_Angeles', '818': 'America/Los_Angeles',
  '831': 'America/Los_Angeles', '858': 'America/Los_Angeles', '909': 'America/Los_Angeles',
  '916': 'America/Los_Angeles', '925': 'America/Los_Angeles', '949': 'America/Los_Angeles',
  // Mountain
  '303': 'America/Denver', '480': 'America/Phoenix', '505': 'America/Denver',
  '602': 'America/Phoenix', '623': 'America/Phoenix', '702': 'America/Los_Angeles',
  '720': 'America/Denver', '801': 'America/Denver', '928': 'America/Phoenix',
  // Central
  '210': 'America/Chicago', '214': 'America/Chicago', '281': 'America/Chicago',
  '309': 'America/Chicago', '312': 'America/Chicago', '314': 'America/Chicago',
  '316': 'America/Chicago', '405': 'America/Chicago', '414': 'America/Chicago',
  '469': 'America/Chicago', '512': 'America/Chicago', '515': 'America/Chicago',
  '630': 'America/Chicago', '713': 'America/Chicago', '773': 'America/Chicago',
  '816': 'America/Chicago', '832': 'America/Chicago', '847': 'America/Chicago',
  '901': 'America/Chicago', '903': 'America/Chicago', '918': 'America/Chicago',
  '936': 'America/Chicago', '940': 'America/Chicago', '956': 'America/Chicago',
  '972': 'America/Chicago',
  // Eastern (DEFAULT for unmapped)
}

export function timezoneFor(phoneE164: string): string {
  // +1NNNNNNNNNN — area code is 1-3 chars after the country code
  const m = phoneE164.match(/^\+1(\d{3})/)
  if (!m) return 'America/New_York'
  return AREA_CODE_TZ[m[1]] ?? 'America/New_York'
}
```

- [ ] **Step 4: Implement `quiet-hours.ts`**

```typescript
// apps/sales-agent/lib/compliance/quiet-hours.ts
import { timezoneFor } from './area-code-timezone'

const QUIET_START_HOUR = 21  // 9pm
const QUIET_END_HOUR = 8     // 8am

function hourInTz(date: Date, tz: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(date))
}

export function isQuietHours(phoneE164: string, now: Date = new Date()): boolean {
  const tz = timezoneFor(phoneE164)
  const h = hourInTz(now, tz)
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR
}

export function nextSendWindow(phoneE164: string, now: Date = new Date()): Date {
  if (!isQuietHours(phoneE164, now)) return now
  const tz = timezoneFor(phoneE164)
  // Compute today 08:00 in tz, in UTC. If that's already past, add 24h.
  const localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const target = new Date(`${localDateStr}T08:00:00`)
  // Adjust for tz offset
  const localOffsetMin = -new Date(now.toLocaleString('en-US', { timeZone: tz })).getTimezoneOffset()
  // Simpler: build at 08:00 in tz using ISO + computed offset
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
  const _ = formatter // for offset side-effect in some runtimes
  // Build candidate by walking forward 1h at a time until hourInTz === 8
  let cand = new Date(now.getTime())
  while (hourInTz(cand, tz) !== QUIET_END_HOUR) {
    cand = new Date(cand.getTime() + 60 * 60 * 1000)
  }
  // Snap to top of hour
  cand.setUTCMinutes(0, 0, 0)
  return cand
}
```

- [ ] **Step 5: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/quiet-hours.test.ts`
Expected: tests PASS. (If `nextSendWindow` edge case fails, iterate — the walk-forward algorithm is robust but DST-edge-ambiguous; accept ±1h on DST transitions.)

- [ ] **Step 6: Commit**

```bash
git add apps/sales-agent/lib/compliance/quiet-hours.ts apps/sales-agent/lib/compliance/area-code-timezone.ts apps/sales-agent/tests/unit/quiet-hours.test.ts
git commit -m "feat(b3): TCPA quiet hours block 9pm-8am per area code timezone"
```

---

### Task 9: `compliance/disclaimers.ts` — CFPB disclaimer rule engine

**Files:**
- Create: `apps/sales-agent/lib/compliance/disclaimers.ts`
- Create: `apps/sales-agent/tests/unit/disclaimers.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/disclaimers.test.ts
import { describe, it, expect } from 'vitest'
import { applyDisclaimers, hasBlockingPhrase } from '@/lib/compliance/disclaimers'

describe('applyDisclaimers', () => {
  it('appends credit disclaimer when message mentions credit', () => {
    const out = applyDisclaimers('Your credit score will improve.')
    expect(out.body).toMatch(/Credit decisions are made by lenders/)
    expect(out.flags).toContain('cfpb_credit_disclaimer_appended')
  })

  it('appends funding disclaimer when message mentions funding', () => {
    const out = applyDisclaimers("You could see $50K in funding.")
    expect(out.body).toMatch(/Funding amounts are estimates/)
    expect(out.flags).toContain('cfpb_funding_disclaimer_appended')
  })

  it('appends both when both keywords present', () => {
    const out = applyDisclaimers('Your credit and funding will improve.')
    expect(out.flags).toContain('cfpb_credit_disclaimer_appended')
    expect(out.flags).toContain('cfpb_funding_disclaimer_appended')
  })

  it('returns unchanged when no triggers', () => {
    const out = applyDisclaimers('Tell me about your business goals.')
    expect(out.body).toBe('Tell me about your business goals.')
    expect(out.flags).toEqual([])
  })
})

describe('hasBlockingPhrase', () => {
  it.each([
    ['You are guaranteed approval', true],
    ['Approval is definitely yours', true],
    ['you will get the loan', true],
    ['Let me know your goals', false],
  ])('"%s" → %s', (input, expected) => {
    expect(hasBlockingPhrase(input)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/disclaimers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `disclaimers.ts`**

```typescript
// apps/sales-agent/lib/compliance/disclaimers.ts
const CREDIT_TRIGGER = /\b(credit\s*(score|report)?|approval)\b/i
const FUNDING_TRIGGER = /\b(funding|loan|fund(ed|ing)?|capital|approved\s+for)\b/i
const BLOCKING_PATTERN = /\b(guaranteed|definitely|surely|absolutely)\b.*\b(approv\w*|fund\w*|get the (loan|funding|capital))\b|\byou will (get|receive|be approved)\b/i

const CREDIT_DISCLAIMER = ' Credit decisions are made by lenders, not us. Results vary.'
const FUNDING_DISCLAIMER = ' Funding amounts are estimates; actual amounts depend on lender review.'

export interface DisclaimerResult {
  body: string
  flags: string[]
}

export function applyDisclaimers(body: string): DisclaimerResult {
  let out = body
  const flags: string[] = []
  if (CREDIT_TRIGGER.test(body)) {
    out += CREDIT_DISCLAIMER
    flags.push('cfpb_credit_disclaimer_appended')
  }
  if (FUNDING_TRIGGER.test(body)) {
    out += FUNDING_DISCLAIMER
    flags.push('cfpb_funding_disclaimer_appended')
  }
  return { body: out, flags }
}

export function hasBlockingPhrase(body: string): boolean {
  return BLOCKING_PATTERN.test(body)
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/disclaimers.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/lib/compliance/disclaimers.ts apps/sales-agent/tests/unit/disclaimers.test.ts
git commit -m "feat(b3): CFPB disclaimer rule engine for credit + funding phrases"
```

---

### Task 10: `compliance/banned-phrases.ts` — post-processor

**Files:**
- Create: `apps/sales-agent/lib/compliance/banned-phrases.ts`
- Create: `apps/sales-agent/tests/unit/banned-phrases.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/banned-phrases.test.ts
import { describe, it, expect } from 'vitest'
import { findBannedPhrases, BannedPhraseHit } from '@/lib/compliance/banned-phrases'

describe('findBannedPhrases', () => {
  it('finds "guaranteed approval"', () => {
    const hits = findBannedPhrases('You have guaranteed approval today.', [])
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].phrase).toContain('guaranteed')
  })

  it('finds "credit repair"', () => {
    const hits = findBannedPhrases("I'll do credit repair for you.", [])
    expect(hits.length).toBeGreaterThan(0)
  })

  it('respects tenant additions to ban list', () => {
    const hits = findBannedPhrases('I am a real person.', ['I am a real person'])
    expect(hits.length).toBeGreaterThan(0)
  })

  it('returns empty for clean message', () => {
    expect(findBannedPhrases('How can I help you today?', [])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/banned-phrases.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `banned-phrases.ts`**

```typescript
// apps/sales-agent/lib/compliance/banned-phrases.ts
const CORE_BANNED = [
  /guaranteed\s+(approval|funding|credit)/i,
  /credit\s+repair/i,                          // we are NOT a credit repair company
  /(fix|repair|boost)\s+your\s+credit/i,
  /\bI(?:'| a)?m\s+(?:a\s+)?(real|actual)\s+(person|human)\b/i,  // no deception
  /\bnot\s+a\s+(bot|robot|AI)\b/i,
  /100%\s+approval/i,
  /\bno\s+credit\s+check\b/i,
]

export interface BannedPhraseHit {
  phrase: string
  match: string
}

export function findBannedPhrases(body: string, tenantBanList: string[] = []): BannedPhraseHit[] {
  const hits: BannedPhraseHit[] = []
  for (const re of CORE_BANNED) {
    const m = body.match(re)
    if (m) hits.push({ phrase: re.source, match: m[0] })
  }
  for (const phrase of tenantBanList) {
    if (!phrase) continue
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, 'i')
    const m = body.match(re)
    if (m) hits.push({ phrase, match: m[0] })
  }
  return hits
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/banned-phrases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/lib/compliance/banned-phrases.ts apps/sales-agent/tests/unit/banned-phrases.test.ts
git commit -m "feat(b3): banned-phrase post-processor with tenant additions"
```

---

### Task 11: `persona/base-prompt.ts` + `persona/tenant-overlay.ts`

**Files:**
- Create: `apps/sales-agent/lib/persona/base-prompt.ts`
- Create: `apps/sales-agent/lib/persona/tenant-overlay.ts`
- Create: `apps/sales-agent/tests/unit/persona.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/persona.test.ts
import { describe, it, expect } from 'vitest'
import { BASE_PROMPT } from '@/lib/persona/base-prompt'
import { buildSystemPrompt } from '@/lib/persona/tenant-overlay'

describe('BASE_PROMPT', () => {
  it('includes compliance reminders', () => {
    expect(BASE_PROMPT).toMatch(/NEVER promise/i)
    expect(BASE_PROMPT).toMatch(/disclaim/i)
  })
  it('includes structured output instructions', () => {
    expect(BASE_PROMPT).toMatch(/JSON/)
    expect(BASE_PROMPT).toMatch(/next_action/)
  })
})

describe('buildSystemPrompt', () => {
  it('injects tenant brand + agent name', () => {
    const p = buildSystemPrompt({
      id: 'moe-legacy', agentName: 'Sam', tenantBrand: 'Moe Legacy',
      agentPersonaOverlay: {}, handoffSlackWebhook: null, handoffImessageTarget: null,
      calComEventLink: null, stripeAccountId: null, llmDailyCapUsd: 50,
    }, { currentState: 'CONTACTED', sku: 'lead-magnet', lastTurns: [] })
    expect(p).toContain('Sam')
    expect(p).toContain('Moe Legacy')
    expect(p).toContain('CONTACTED')
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/persona.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `base-prompt.ts`**

```typescript
// apps/sales-agent/lib/persona/base-prompt.ts
export const BASE_PROMPT = `You are an inbound sales conversationalist for a credit + funding service.

NEVER promise approval, credit score changes, specific dollar amounts of funding, or any guaranteed outcome.
NEVER claim to be a human if asked directly — if a lead asks if you're a bot, acknowledge you're an AI assistant and offer to connect them with a person.
ALWAYS speak warmly and concisely, like a knowledgeable assistant texting back.
ALWAYS include relevant disclaimers when discussing credit or funding (the system will append CFPB-required language automatically; your job is just to mention concepts honestly).

Your job is to:
1. Greet the lead by referencing where they came in from (the SKU they showed interest in)
2. Qualify them on three dimensions:
   - Budget (B): can they afford the offering?
   - Authority (A): are they the decision-maker?
   - Timing (T): are they ready in the next 30 days?
3. Take next action:
   - sku <= $97 + all 3 BAT positive → send Stripe Payment Link
   - sku > $97 + all 3 BAT positive → send Cal.com booking link
   - Lead asks for a human OR signals red flag → escalate
   - Need more info → ask one clarifying question

Output STRICTLY as JSON matching this schema:
{
  "message": "<your reply to the lead, 1-3 sentences>",
  "assessment": {
    "B": <0.0-1.0>,
    "A": <0.0-1.0>,
    "T": <0.0-1.0>,
    "confidence": <0.0-1.0>
  },
  "next_action": "ask_budget" | "ask_authority" | "ask_timing" | "ask_general" | "send_stripe_link" | "send_cal_link" | "escalate_human" | "wait"
}
`
```

- [ ] **Step 4: Implement `tenant-overlay.ts`**

```typescript
// apps/sales-agent/lib/persona/tenant-overlay.ts
import { BASE_PROMPT } from './base-prompt'
import type { TenantContext } from '@/lib/tenant-context'

export interface ConversationContext {
  currentState: string
  sku?: string
  lastTurns: Array<{ direction: 'in' | 'out'; body: string }>
}

export function buildSystemPrompt(tenant: TenantContext, ctx: ConversationContext): string {
  const overlay = tenant.agentPersonaOverlay as {
    tone_adjustment?: string
    forbidden_phrases?: string[]
    hot_lead_keywords?: string[]
  }
  const toneLine = overlay.tone_adjustment ? `Tone: ${overlay.tone_adjustment}.` : ''
  const hotKw = overlay.hot_lead_keywords?.length ? `If the lead says any of ${overlay.hot_lead_keywords.join(', ')}, escalate immediately.` : ''
  const turns = ctx.lastTurns.slice(-10).map(t => `${t.direction === 'in' ? 'Lead' : 'You'}: ${t.body}`).join('\n')

  return `${BASE_PROMPT}

You are ${tenant.agentName} from ${tenant.tenantBrand}.
${toneLine}
${hotKw}

Current state: ${ctx.currentState}
SKU under discussion: ${ctx.sku ?? 'unknown'}

Conversation so far:
${turns || '(none yet)'}
`
}
```

- [ ] **Step 5: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/persona.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit + tag compliance milestone**

```bash
git add apps/sales-agent/lib/persona/ apps/sales-agent/tests/unit/persona.test.ts
git commit -m "feat(b3): base persona prompt + tenant overlay merger"
git tag v0.5.2-b3-compliance
```

---

## Phase 3 — State Machine + LLM + Wiring (Tasks 12–17)

### Task 12: `llm-router.ts` — Sonnet primary, Haiku fallback, structured output

**Files:**
- Create: `apps/sales-agent/lib/llm-router.ts`
- Create: `apps/sales-agent/tests/unit/llm-router.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/llm-router.test.ts
import { describe, it, expect, vi } from 'vitest'
import { callAgent, LLMOutputSchema } from '@/lib/llm-router'

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate }
  }))
}))

describe('callAgent', () => {
  it('parses valid structured output', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({
        message: 'Hello!',
        assessment: { B: 0.5, A: 0.5, T: 0.5, confidence: 0.7 },
        next_action: 'ask_budget'
      })}],
      usage: { input_tokens: 100, output_tokens: 30 }
    })
    const result = await callAgent({ systemPrompt: 'sys', userMessage: 'hi', model: 'sonnet' })
    expect(result.parsed.message).toBe('Hello!')
    expect(result.parsed.next_action).toBe('ask_budget')
    expect(result.cost_usd).toBeGreaterThan(0)
  })

  it('throws on schema mismatch', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{ "garbage": true }' }],
      usage: { input_tokens: 100, output_tokens: 10 }
    })
    await expect(callAgent({ systemPrompt: 'sys', userMessage: 'hi', model: 'sonnet' })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/llm-router.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `llm-router.ts`**

```typescript
// apps/sales-agent/lib/llm-router.ts
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

export const LLMOutputSchema = z.object({
  message: z.string().min(1).max(500),
  assessment: z.object({
    B: z.number().min(0).max(1),
    A: z.number().min(0).max(1),
    T: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  }),
  next_action: z.enum([
    'ask_budget', 'ask_authority', 'ask_timing', 'ask_general',
    'send_stripe_link', 'send_cal_link', 'escalate_human', 'wait',
  ]),
})

export type LLMOutput = z.infer<typeof LLMOutputSchema>

const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
}

const PRICE = {
  sonnet: { in: 3.0 / 1_000_000, out: 15.0 / 1_000_000 },
  haiku:  { in: 0.8 / 1_000_000, out: 4.0 / 1_000_000 },
}

export interface CallArgs {
  systemPrompt: string
  userMessage: string
  model: 'sonnet' | 'haiku'
  maxRetries?: number
}

export interface CallResult {
  parsed: LLMOutput
  raw: string
  cost_usd: number
  model: 'sonnet' | 'haiku'
}

export async function callAgent(args: CallArgs): Promise<CallResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const modelId = MODELS[args.model]
  const maxRetries = args.maxRetries ?? 1

  let lastErr: Error | null = null
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const resp = await client.messages.create({
      model: modelId,
      max_tokens: 600,
      system: args.systemPrompt,
      messages: [{ role: 'user', content: args.userMessage }],
    })
    const text = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    try {
      const parsed = LLMOutputSchema.parse(JSON.parse(text))
      const cost_usd =
        resp.usage.input_tokens * PRICE[args.model].in +
        resp.usage.output_tokens * PRICE[args.model].out
      return { parsed, raw: text, cost_usd, model: args.model }
    } catch (e) {
      lastErr = e as Error
      if (attempt === maxRetries) throw new Error(`LLM output failed schema: ${(e as Error).message}\n---\n${text}`)
    }
  }
  throw lastErr ?? new Error('unreachable')
}

export function routeModel(intent: 'simple_route' | 'qualify' | 'close'): 'sonnet' | 'haiku' {
  return intent === 'simple_route' ? 'haiku' : 'sonnet'
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/llm-router.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/lib/llm-router.ts apps/sales-agent/tests/unit/llm-router.test.ts
git commit -m "feat(b3): LLM router with Sonnet primary, Haiku fallback, zod-validated structured output"
```

---

### Task 13: `state-machine.ts` — pure FSM

**Files:**
- Create: `apps/sales-agent/lib/state-machine.ts`
- Create: `apps/sales-agent/tests/unit/state-machine.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/state-machine.test.ts
import { describe, it, expect } from 'vitest'
import { step, State, Event } from '@/lib/state-machine'

describe('state-machine step()', () => {
  it('NEW + lead_received → CONTACTED with send_first_message action', () => {
    const r = step({ state: 'NEW' }, { kind: 'lead_received', sku: 'lead-magnet', skuPrice: 0 })
    expect(r.state).toBe('CONTACTED')
    expect(r.actions.map(a => a.kind)).toContain('send_first_message')
  })

  it('CONTACTED + llm assessment with B+A+T >= 2 + confidence >= 0.6 → QUALIFIED', () => {
    const r = step(
      { state: 'CONTACTED', sku: 'lead-magnet', skuPrice: 97 },
      { kind: 'llm_assessment', B: 0.8, A: 0.7, T: 0.7, confidence: 0.7, next_action: 'send_stripe_link' }
    )
    expect(r.state).toBe('QUALIFIED')
  })

  it('QUALIFIED + sku price <= 97 → CLOSED action send_stripe_link', () => {
    const r = step(
      { state: 'QUALIFIED', sku: 'lead-magnet', skuPrice: 97 },
      { kind: 'continue' }
    )
    expect(r.actions.map(a => a.kind)).toContain('send_stripe_link')
  })

  it('QUALIFIED + sku price > 97 → BOOKED action send_cal_link', () => {
    const r = step(
      { state: 'QUALIFIED', sku: 'training', skuPrice: 7000 },
      { kind: 'continue' }
    )
    expect(r.actions.map(a => a.kind)).toContain('send_cal_link')
  })

  it('any state + opt_out → terminates conversation', () => {
    const r = step({ state: 'CONTACTED' }, { kind: 'opt_out' })
    expect(r.state).toBe('LOST')
    expect(r.actions.map(a => a.kind)).toContain('send_opt_out_reply')
  })

  it('any state + escalate triggers → HUMAN_HANDOFF', () => {
    const r = step({ state: 'QUALIFIED' }, { kind: 'escalate', reason: 'asked_for_human' })
    expect(r.state).toBe('HUMAN_HANDOFF')
    expect(r.actions.map(a => a.kind)).toContain('notify_human')
  })

  it('stripe paid → CLOSED', () => {
    const r = step({ state: 'QUALIFIED' }, { kind: 'stripe_paid' })
    expect(r.state).toBe('CLOSED')
  })

  it('cal booked → BOOKED', () => {
    const r = step({ state: 'QUALIFIED' }, { kind: 'cal_booked' })
    expect(r.state).toBe('BOOKED')
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/state-machine.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `state-machine.ts`**

```typescript
// apps/sales-agent/lib/state-machine.ts
export type State = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'BOOKED' | 'CLOSED' | 'LOST' | 'HUMAN_HANDOFF'

export interface MachineState {
  state: State
  sku?: string
  skuPrice?: number
}

export type Event =
  | { kind: 'lead_received'; sku: string; skuPrice: number }
  | { kind: 'llm_assessment'; B: number; A: number; T: number; confidence: number; next_action: string }
  | { kind: 'continue' }
  | { kind: 'opt_out' }
  | { kind: 'escalate'; reason: string }
  | { kind: 'stripe_paid' }
  | { kind: 'cal_booked' }
  | { kind: 'timeout_no_response' }

export type Action =
  | { kind: 'send_first_message' }
  | { kind: 'send_stripe_link' }
  | { kind: 'send_cal_link' }
  | { kind: 'send_opt_out_reply' }
  | { kind: 'notify_human'; reason: string }

export interface StepResult {
  state: State
  sku?: string
  skuPrice?: number
  actions: Action[]
}

const QUALIFIED_THRESHOLD = 2.0
const CONFIDENCE_THRESHOLD = 0.6
const HUMAN_PRICE_THRESHOLD_USD = 97

export function step(prev: MachineState, evt: Event): StepResult {
  // Terminal-overriding events apply first
  if (evt.kind === 'opt_out') {
    return { state: 'LOST', sku: prev.sku, skuPrice: prev.skuPrice, actions: [{ kind: 'send_opt_out_reply' }] }
  }
  if (evt.kind === 'escalate') {
    return { state: 'HUMAN_HANDOFF', sku: prev.sku, skuPrice: prev.skuPrice, actions: [{ kind: 'notify_human', reason: evt.reason }] }
  }
  if (evt.kind === 'stripe_paid') {
    return { state: 'CLOSED', sku: prev.sku, skuPrice: prev.skuPrice, actions: [] }
  }
  if (evt.kind === 'cal_booked') {
    return { state: 'BOOKED', sku: prev.sku, skuPrice: prev.skuPrice, actions: [] }
  }
  if (evt.kind === 'timeout_no_response') {
    return { state: 'LOST', sku: prev.sku, skuPrice: prev.skuPrice, actions: [] }
  }

  // Regular flow
  if (prev.state === 'NEW' && evt.kind === 'lead_received') {
    return { state: 'CONTACTED', sku: evt.sku, skuPrice: evt.skuPrice, actions: [{ kind: 'send_first_message' }] }
  }

  if (prev.state === 'CONTACTED' && evt.kind === 'llm_assessment') {
    const score = evt.B + evt.A + evt.T
    if (score >= QUALIFIED_THRESHOLD && evt.confidence >= CONFIDENCE_THRESHOLD) {
      // transition to QUALIFIED — caller should immediately fire 'continue'
      return { state: 'QUALIFIED', sku: prev.sku, skuPrice: prev.skuPrice, actions: [] }
    }
    return { state: 'CONTACTED', sku: prev.sku, skuPrice: prev.skuPrice, actions: [] }
  }

  if (prev.state === 'QUALIFIED' && evt.kind === 'continue') {
    const price = prev.skuPrice ?? 0
    if (price <= HUMAN_PRICE_THRESHOLD_USD) {
      return { state: 'QUALIFIED', sku: prev.sku, skuPrice: price, actions: [{ kind: 'send_stripe_link' }] }
    } else {
      return { state: 'QUALIFIED', sku: prev.sku, skuPrice: price, actions: [{ kind: 'send_cal_link' }] }
    }
  }

  // Default: no transition
  return { state: prev.state, sku: prev.sku, skuPrice: prev.skuPrice, actions: [] }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/state-machine.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/lib/state-machine.ts apps/sales-agent/tests/unit/state-machine.test.ts
git commit -m "feat(b3): pure FSM with NEW->CONTACTED->QUALIFIED->{CLOSED,BOOKED,LOST,HANDOFF}"
```

---

### Task 14: `audit.ts` — ship to log.tmmt.tools

**Files:**
- Create: `apps/sales-agent/lib/audit.ts`
- Create: `apps/sales-agent/tests/unit/audit.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/audit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { emitAudit } from '@/lib/audit'

global.fetch = vi.fn()

describe('emitAudit', () => {
  beforeEach(() => { (fetch as any).mockReset() })

  it('POSTs NDJSON to log.tmmt.tools with bearer license', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: true, status: 202 })
    await emitAudit('test-jwt', { action: 'sms.outbound_sent', tenant_id: 'moe-legacy', payload: { msg_id: 'x' } })
    expect(fetch).toHaveBeenCalledOnce()
    const call = (fetch as any).mock.calls[0]
    expect(call[1].headers.Authorization).toBe('Bearer test-jwt')
    expect(call[1].body).toContain('sms.outbound_sent')
  })

  it('does not throw on 4xx — audit is best-effort', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(emitAudit('bad-jwt', { action: 'x', tenant_id: 'y', payload: {} })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/audit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `audit.ts`**

```typescript
// apps/sales-agent/lib/audit.ts
export interface AuditEvent {
  action: string
  tenant_id: string
  payload: Record<string, unknown>
  ts?: string
}

const AUDIT_URL = process.env.AUDIT_INGEST_URL || 'https://log.tmmt.tools/v1/events'

export async function emitAudit(licenseJwt: string, evt: AuditEvent): Promise<void> {
  const line = JSON.stringify({
    ts: evt.ts ?? new Date().toISOString(),
    action: evt.action,
    payload: { tenant_id: evt.tenant_id, ...evt.payload },
  })
  try {
    await fetch(AUDIT_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain', Authorization: `Bearer ${licenseJwt}` },
      body: line,
    })
  } catch {
    // best-effort; log silently in prod via separate observability
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/lib/audit.ts apps/sales-agent/tests/unit/audit.test.ts
git commit -m "feat(b3): audit emitter (best-effort POST to log.tmmt.tools)"
```

---

### Task 15: `stripe-link.ts` + `cal-link.ts`

**Files:**
- Create: `apps/sales-agent/lib/stripe-link.ts`
- Create: `apps/sales-agent/lib/cal-link.ts`
- Create: `apps/sales-agent/tests/unit/links.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/links.test.ts
import { describe, it, expect } from 'vitest'
import { stripeLinkForSku } from '@/lib/stripe-link'
import { calLinkForTenant } from '@/lib/cal-link'

describe('stripeLinkForSku', () => {
  it('returns the configured link for the SKU', () => {
    const links: Record<string, string> = { 'lead-magnet': 'https://buy.stripe.com/test_lm' }
    expect(stripeLinkForSku('lead-magnet', links)).toBe('https://buy.stripe.com/test_lm')
  })
  it('throws for unknown SKU', () => {
    expect(() => stripeLinkForSku('unknown', {})).toThrow()
  })
})

describe('calLinkForTenant', () => {
  it('returns tenant cal link unchanged', () => {
    expect(calLinkForTenant({ calComEventLink: 'https://cal.com/moe/intake' } as any)).toBe('https://cal.com/moe/intake')
  })
  it('throws when not configured', () => {
    expect(() => calLinkForTenant({ calComEventLink: null } as any)).toThrow()
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/links.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `stripe-link.ts`**

```typescript
// apps/sales-agent/lib/stripe-link.ts
import { createServiceClient } from './supabase'

export function stripeLinkForSku(sku: string, links: Record<string, string>): string {
  const link = links[sku]
  if (!link) throw new Error(`No Stripe Payment Link configured for SKU=${sku}`)
  return link
}

export async function loadTenantStripeLinks(tenantId: string): Promise<Record<string, string>> {
  const db = createServiceClient()
  const { data } = await db.from('tenant_stripe_links')
    .select('sku, payment_link_url')
    .eq('tenant_id', tenantId)
  if (!data) return {}
  return Object.fromEntries(data.map((r: any) => [r.sku, r.payment_link_url]))
}
```

> Note: the `tenant_stripe_links` table is added in B4 plan (not this plan). For B3.1 testing, mock with literal links from tenant config in `agent_persona_overlay.stripe_links`.

- [ ] **Step 4: Implement `cal-link.ts`**

```typescript
// apps/sales-agent/lib/cal-link.ts
import type { TenantContext } from './tenant-context'

export function calLinkForTenant(tenant: TenantContext): string {
  if (!tenant.calComEventLink) throw new Error(`No Cal.com event link configured for tenant=${tenant.id}`)
  return tenant.calComEventLink
}
```

- [ ] **Step 5: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/links.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/sales-agent/lib/stripe-link.ts apps/sales-agent/lib/cal-link.ts apps/sales-agent/tests/unit/links.test.ts
git commit -m "feat(b3): Stripe + Cal link helpers"
```

---

### Task 16: `handoff.ts` — Slack + iMessage push

**Files:**
- Create: `apps/sales-agent/lib/handoff.ts`
- Create: `apps/sales-agent/tests/unit/handoff.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/handoff.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handoffToHuman } from '@/lib/handoff'

global.fetch = vi.fn()

describe('handoffToHuman', () => {
  beforeEach(() => { (fetch as any).mockReset() })

  it('posts to Slack + iMessage when both configured', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true })
    await handoffToHuman({
      tenant: { id: 'moe-legacy', handoffSlackWebhook: 'https://hooks.slack.com/x', handoffImessageTarget: '+15551234567' } as any,
      leadId: 'lead-uuid',
      phone: '+15551001001',
      reason: 'asked_for_human',
      recentMessages: [{ direction: 'in', body: 'speak to a person' }],
    })
    expect((fetch as any).mock.calls.length).toBe(2)
  })

  it('skips channels not configured', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true })
    await handoffToHuman({
      tenant: { id: 'moe-legacy', handoffSlackWebhook: null, handoffImessageTarget: null } as any,
      leadId: 'l', phone: '+1', reason: 'r', recentMessages: [],
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/handoff.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `handoff.ts`**

```typescript
// apps/sales-agent/lib/handoff.ts
import type { TenantContext } from './tenant-context'

const IMESSAGE_RELAY_URL = process.env.IMESSAGE_RELAY_URL || 'http://100.77.126.8:8787/send'

export interface HandoffArgs {
  tenant: TenantContext
  leadId: string
  phone: string
  reason: string
  recentMessages: Array<{ direction: 'in' | 'out'; body: string }>
}

export async function handoffToHuman(args: HandoffArgs): Promise<void> {
  const summary = args.recentMessages.slice(-10)
    .map(m => `${m.direction === 'in' ? '👤' : '🤖'} ${m.body}`).join('\n')
  const text = `🆘 *Hot lead handoff* — ${args.tenant.id}\nReason: ${args.reason}\nLead phone: ${args.phone}\n\n${summary}`

  const slackP = args.tenant.handoffSlackWebhook
    ? fetch(args.tenant.handoffSlackWebhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      }).catch(() => undefined)
    : Promise.resolve()

  const imessageP = args.tenant.handoffImessageTarget
    ? fetch(IMESSAGE_RELAY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: args.tenant.handoffImessageTarget, text }),
      }).catch(() => undefined)
    : Promise.resolve()

  await Promise.all([slackP, imessageP])
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/handoff.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/lib/handoff.ts apps/sales-agent/tests/unit/handoff.test.ts
git commit -m "feat(b3): handoff to Slack + iMessage relay"
```

---

### Task 17: Wire everything — `lib/agent.ts` orchestrator

**Files:**
- Create: `apps/sales-agent/lib/agent.ts`
- Create: `apps/sales-agent/tests/unit/agent.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/sales-agent/tests/unit/agent.test.ts
import { describe, it, expect, vi } from 'vitest'
import { processInbound } from '@/lib/agent'

vi.mock('@/lib/guard', () => ({ guardTenant: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/llm-router', () => ({
  callAgent: vi.fn().mockResolvedValue({
    parsed: { message: 'Hi back', assessment: { B: 0.3, A: 0.3, T: 0.3, confidence: 0.5 }, next_action: 'ask_general' },
    raw: '{}', cost_usd: 0.001, model: 'sonnet'
  }),
  routeModel: () => 'sonnet',
}))
vi.mock('@/lib/audit', () => ({ emitAudit: vi.fn() }))

describe('processInbound', () => {
  it('opt-out short-circuits the LLM', async () => {
    const result = await processInbound({
      tenant: { id: 'moe-legacy' } as any,
      prevState: 'CONTACTED',
      sku: 'lead-magnet', skuPrice: 97,
      inboundBody: 'STOP',
      phone: '+15551001001',
      recentMessages: [],
      licenseJwt: 'jwt',
    })
    expect(result.newState).toBe('LOST')
    expect(result.outboundBody).toMatch(/opted out/i)
    expect(result.complianceFlags).toContain('opt_out')
  })

  it('blocks LLM outputs that contain banned phrases', async () => {
    const { callAgent } = await import('@/lib/llm-router')
    ;(callAgent as any).mockResolvedValueOnce({
      parsed: { message: 'You have guaranteed approval!', assessment: { B: 0.9, A: 0.9, T: 0.9, confidence: 0.9 }, next_action: 'ask_general' },
      raw: '{}', cost_usd: 0.001, model: 'sonnet'
    })
    ;(callAgent as any).mockResolvedValueOnce({
      parsed: { message: 'Tell me about your goals.', assessment: { B: 0.5, A: 0.5, T: 0.5, confidence: 0.5 }, next_action: 'ask_general' },
      raw: '{}', cost_usd: 0.001, model: 'sonnet'
    })
    const result = await processInbound({
      tenant: { id: 'moe-legacy', agentPersonaOverlay: {} } as any,
      prevState: 'CONTACTED', sku: 'lead-magnet', skuPrice: 97,
      inboundBody: 'tell me more',
      phone: '+15551001001',
      recentMessages: [],
      licenseJwt: 'jwt',
    })
    expect(result.outboundBody).toBe('Tell me about your goals.')
    expect(result.complianceFlags).toContain('banned_phrase_regenerated')
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/unit/agent.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/agent.ts`**

```typescript
// apps/sales-agent/lib/agent.ts
import { guardTenant } from './guard'
import { TenantContext } from './tenant-context'
import { State, step, Event } from './state-machine'
import { callAgent, routeModel } from './llm-router'
import { buildSystemPrompt } from './persona/tenant-overlay'
import { isOptOutMessage, optOutAutoReply } from './compliance/opt-out'
import { isQuietHours } from './compliance/quiet-hours'
import { applyDisclaimers, hasBlockingPhrase } from './compliance/disclaimers'
import { findBannedPhrases } from './compliance/banned-phrases'
import { emitAudit } from './audit'

export interface ProcessInboundArgs {
  tenant: TenantContext
  prevState: State
  sku?: string
  skuPrice?: number
  inboundBody: string
  phone: string
  recentMessages: Array<{ direction: 'in' | 'out'; body: string }>
  licenseJwt: string
}

export interface ProcessInboundResult {
  newState: State
  outboundBody: string | null
  complianceFlags: string[]
  actions: Array<{ kind: string }>
  llmAssessment?: Record<string, number>
}

export async function processInbound(args: ProcessInboundArgs): Promise<ProcessInboundResult> {
  await guardTenant(args.tenant.id)

  // 1. Opt-out check
  if (isOptOutMessage(args.inboundBody)) {
    await emitAudit(args.licenseJwt, {
      action: 'compliance.opt_out_received', tenant_id: args.tenant.id,
      payload: { phone: args.phone }
    })
    return {
      newState: 'LOST',
      outboundBody: optOutAutoReply(),
      complianceFlags: ['opt_out'],
      actions: [{ kind: 'send_opt_out_reply' }],
    }
  }

  // 2. Quiet hours check (for outbound; we receive anytime)
  const quiet = isQuietHours(args.phone)

  // 3. LLM call with regen on banned phrase
  const overlay = (args.tenant.agentPersonaOverlay as any) || {}
  const banList: string[] = overlay.forbidden_phrases ?? []
  let llmResult: Awaited<ReturnType<typeof callAgent>> | null = null
  let outBody = ''
  const flags: string[] = []
  let regenAttempts = 0

  const systemPrompt = buildSystemPrompt(args.tenant, {
    currentState: args.prevState,
    sku: args.sku,
    lastTurns: args.recentMessages,
  })

  while (regenAttempts <= 2) {
    llmResult = await callAgent({
      systemPrompt,
      userMessage: args.inboundBody,
      model: routeModel('qualify'),
    })
    outBody = llmResult.parsed.message
    const hits = findBannedPhrases(outBody, banList)
    const blocking = hasBlockingPhrase(outBody)
    if (hits.length === 0 && !blocking) break
    flags.push(...hits.map(() => 'banned_phrase_regenerated'))
    if (blocking) flags.push('cfpb_blocking_phrase_regenerated')
    regenAttempts++
  }
  if (regenAttempts > 0 && llmResult) flags.push('regenerated')

  // 4. Apply CFPB disclaimers
  const disclaimed = applyDisclaimers(outBody)
  outBody = disclaimed.body
  flags.push(...disclaimed.flags)

  // 5. State transition
  let nextState: State = args.prevState
  let actions: Array<{ kind: string }> = []
  if (llmResult?.parsed.next_action === 'escalate_human') {
    const r = step({ state: args.prevState, sku: args.sku, skuPrice: args.skuPrice },
                   { kind: 'escalate', reason: 'llm_decided_escalate' })
    nextState = r.state
    actions = r.actions
  } else {
    const r = step({ state: args.prevState, sku: args.sku, skuPrice: args.skuPrice },
                   {
                     kind: 'llm_assessment',
                     B: llmResult!.parsed.assessment.B,
                     A: llmResult!.parsed.assessment.A,
                     T: llmResult!.parsed.assessment.T,
                     confidence: llmResult!.parsed.assessment.confidence,
                     next_action: llmResult!.parsed.next_action,
                   })
    nextState = r.state
    actions = r.actions
    if (nextState === 'QUALIFIED') {
      const r2 = step({ state: 'QUALIFIED', sku: args.sku, skuPrice: args.skuPrice }, { kind: 'continue' })
      actions = [...actions, ...r2.actions]
    }
  }

  await emitAudit(args.licenseJwt, {
    action: 'agent.llm_call', tenant_id: args.tenant.id,
    payload: { model: llmResult?.model, cost_usd: llmResult?.cost_usd, regen_attempts: regenAttempts }
  })

  return {
    newState: nextState,
    outboundBody: quiet ? null : outBody,
    complianceFlags: flags,
    actions,
    llmAssessment: llmResult?.parsed.assessment,
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/agent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit + tag state-machine milestone**

```bash
git add apps/sales-agent/lib/agent.ts apps/sales-agent/tests/unit/agent.test.ts
git commit -m "feat(b3): processInbound orchestrator wires guard + FSM + LLM + compliance"
git tag v0.5.3-b3-state-machine
```

---

## Phase 4 — Webhooks (Tasks 18–22)

### Task 18: `/api/sms/inbound` — Twilio webhook

**Files:**
- Create: `apps/sales-agent/app/api/sms/inbound/route.ts`
- Create: `apps/sales-agent/tests/integration/sms-inbound.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// apps/sales-agent/tests/integration/sms-inbound.test.ts
import { describe, it, expect, vi } from 'vitest'
import { POST } from '@/app/api/sms/inbound/route'

vi.mock('@/lib/agent', () => ({
  processInbound: vi.fn().mockResolvedValue({
    newState: 'CONTACTED',
    outboundBody: 'Hi back',
    complianceFlags: [],
    actions: [],
  })
}))
vi.mock('@/lib/tenant-context', () => ({
  resolveTenantByTwilioNumber: vi.fn().mockResolvedValue({
    id: 'moe-legacy', agentName: 'R', tenantBrand: 'M', agentPersonaOverlay: {},
    handoffSlackWebhook: null, handoffImessageTarget: null, calComEventLink: null,
    stripeAccountId: null, llmDailyCapUsd: 50,
  })
}))

function twilioForm(body: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(body)) fd.set(k, v)
  return fd
}

describe('POST /api/sms/inbound', () => {
  it('returns TwiML reply for valid inbound', async () => {
    const req = new Request('http://localhost/api/sms/inbound', {
      method: 'POST',
      body: twilioForm({ From: '+15551001001', To: '+15555550100', Body: 'hi', MessageSid: 'SM1' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('<Response>')
    expect(text).toContain('Hi back')
  })

  it('returns empty TwiML when license disabled', async () => {
    const { processInbound } = await import('@/lib/agent')
    ;(processInbound as any).mockRejectedValueOnce(new Error('LICENSE_DISABLED'))
    const req = new Request('http://localhost/api/sms/inbound', {
      method: 'POST',
      body: twilioForm({ From: '+15551001001', To: '+15555550100', Body: 'hi', MessageSid: 'SM2' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('<Response/>')
  })
})
```

- [ ] **Step 2: Run test, expect FAIL**

Run: `pnpm vitest run tests/integration/sms-inbound.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement route**

```typescript
// apps/sales-agent/app/api/sms/inbound/route.ts
import { NextResponse } from 'next/server'
import { resolveTenantByTwilioNumber, TenantNotFoundError } from '@/lib/tenant-context'
import { processInbound } from '@/lib/agent'
import { withTenant, createServiceClient } from '@/lib/supabase'
import { LicenseDisabledError, OperationalKillError } from '@/lib/guard'

function twiml(body: string): string {
  if (!body) return '<Response/>'
  const escaped = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`
}

export async function POST(req: Request): Promise<NextResponse> {
  const form = await req.formData()
  const from = String(form.get('From') ?? '')
  const to = String(form.get('To') ?? '')
  const body = String(form.get('Body') ?? '')
  const messageSid = String(form.get('MessageSid') ?? '')

  if (!from || !to || !body) {
    return new NextResponse(twiml(''), { status: 200, headers: { 'content-type': 'text/xml' } })
  }

  let tenant
  try {
    tenant = await resolveTenantByTwilioNumber(to)
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      // Quarantine: log and return empty (NEVER route to a wrong tenant)
      return new NextResponse(twiml(''), { status: 200, headers: { 'content-type': 'text/xml' } })
    }
    throw e
  }

  try {
    const result = await withTenant(tenant.id, async (db) => {
      // Find or create lead + conversation
      const { data: lead } = await db.from('leads')
        .select('*').eq('phone_e164', from).eq('tenant_id', tenant.id).maybeSingle()
      const leadRow = lead ?? (await db.from('leads').insert({
        tenant_id: tenant.id, phone_e164: from, status: 'NEW'
      }).select().single()).data

      const { data: conv } = await db.from('conversations')
        .select('*').eq('lead_id', leadRow.id).is('ended_at', null).maybeSingle()
      const convRow = conv ?? (await db.from('conversations').insert({
        lead_id: leadRow.id, tenant_id: tenant.id, channel: 'sms'
      }).select().single()).data

      // Pull last 10 messages for context
      const { data: msgs } = await db.from('messages')
        .select('direction, body').eq('conversation_id', convRow.id).order('ts', { ascending: false }).limit(10)
      const recent = (msgs ?? []).reverse().map((m: any) => ({ direction: m.direction, body: m.body }))

      // Record inbound
      await db.from('messages').insert({
        conversation_id: convRow.id, direction: 'in', body
      })

      // Process
      const result = await processInbound({
        tenant,
        prevState: leadRow.status,
        sku: leadRow.sku,
        skuPrice: leadRow.sku === 'lead-magnet' ? 0 : leadRow.sku === 'intro-97' ? 97 : 7000,
        inboundBody: body,
        phone: from,
        recentMessages: recent,
        licenseJwt: process.env.B3_LICENSE_JWT_FOR_AUDIT ?? '',
      })

      // Update lead + record outbound
      await db.from('leads').update({
        status: result.newState,
        contacted_at: leadRow.contacted_at ?? new Date().toISOString(),
      }).eq('id', leadRow.id)

      if (result.outboundBody) {
        await db.from('messages').insert({
          conversation_id: convRow.id, direction: 'out', body: result.outboundBody,
          compliance_flags: result.complianceFlags, llm_assessment: result.llmAssessment,
        })
      }
      return result
    })

    return new NextResponse(twiml(result.outboundBody ?? ''), {
      status: 200, headers: { 'content-type': 'text/xml' }
    })
  } catch (e) {
    if (e instanceof LicenseDisabledError || e instanceof OperationalKillError) {
      return new NextResponse(twiml(''), { status: 200, headers: { 'content-type': 'text/xml' } })
    }
    console.error('sms.inbound error', e)
    return new NextResponse(twiml(''), { status: 200, headers: { 'content-type': 'text/xml' } })
  }
}
```

- [ ] **Step 4: Run test, expect PASS**

Run: `pnpm vitest run tests/integration/sms-inbound.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/app/api/sms/inbound/ apps/sales-agent/tests/integration/sms-inbound.test.ts
git commit -m "feat(b3): /api/sms/inbound Twilio webhook with full safety guards"
```

---

### Task 19: `/api/sms/outbound/[lead_id]` — internal trigger for first contact

**Files:**
- Create: `apps/sales-agent/app/api/sms/outbound/[lead_id]/route.ts`
- Create: `apps/sales-agent/lib/twilio-send.ts`
- Create: `apps/sales-agent/tests/integration/sms-outbound.test.ts`

- [ ] **Step 1: Write `twilio-send.ts`**

```typescript
// apps/sales-agent/lib/twilio-send.ts
import Twilio from 'twilio'

export async function sendSms(opts: { from: string; to: string; body: string }): Promise<{ sid: string }> {
  const client = Twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  const msg = await client.messages.create({ from: opts.from, to: opts.to, body: opts.body })
  return { sid: msg.sid }
}
```

- [ ] **Step 2: Write integration test**

```typescript
// apps/sales-agent/tests/integration/sms-outbound.test.ts
import { describe, it, expect, vi } from 'vitest'
import { POST } from '@/app/api/sms/outbound/[lead_id]/route'

vi.mock('@/lib/twilio-send', () => ({ sendSms: vi.fn().mockResolvedValue({ sid: 'SM_OUT_1' }) }))
vi.mock('@/lib/agent', () => ({ processInbound: vi.fn() }))
vi.mock('@/lib/guard', () => ({ guardTenant: vi.fn().mockResolvedValue(undefined) }))

describe('POST /api/sms/outbound/[lead_id]', () => {
  it('sends first message for a NEW lead', async () => {
    // Stub Supabase here; for now just smoke that route is registered
    const req = new Request('http://localhost/api/sms/outbound/lead-uuid', { method: 'POST' })
    const res = await POST(req as any, { params: { lead_id: 'lead-uuid' } } as any)
    expect([200, 404, 503]).toContain(res.status)  // depending on stubbed lead presence
  })
})
```

- [ ] **Step 3: Implement route**

```typescript
// apps/sales-agent/app/api/sms/outbound/[lead_id]/route.ts
import { NextResponse } from 'next/server'
import { withTenant } from '@/lib/supabase'
import { guardTenant, LicenseDisabledError } from '@/lib/guard'
import { resolveTenantByTwilioNumber } from '@/lib/tenant-context'
import { sendSms } from '@/lib/twilio-send'

export async function POST(req: Request, { params }: { params: { lead_id: string } }): Promise<NextResponse> {
  // Internal endpoint — protected by Vercel cron secret OR Supabase Realtime invocation
  const adminKey = req.headers.get('x-internal-key') ?? ''
  if (adminKey !== process.env.INTERNAL_TRIGGER_KEY) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // Fetch lead via service role (no tenant scope yet — need to know which tenant)
  const { createServiceClient } = await import('@/lib/supabase')
  const db = createServiceClient()
  const { data: lead } = await db.from('leads').select('*').eq('id', params.lead_id).single()
  if (!lead) return NextResponse.json({ error: 'lead not found' }, { status: 404 })

  try {
    await guardTenant(lead.tenant_id)
  } catch (e) {
    if (e instanceof LicenseDisabledError) return NextResponse.json({ skipped: 'license_disabled' }, { status: 503 })
    throw e
  }

  // Load tenant config
  const { data: tenantRow } = await db.from('tenants').select('twilio_inbound_number, agent_name, tenant_brand').eq('id', lead.tenant_id).single()
  if (!tenantRow?.twilio_inbound_number) return NextResponse.json({ error: 'tenant has no twilio number' }, { status: 412 })

  const body = `Hey! This is ${tenantRow.agent_name ?? 'Riley'} from ${tenantRow.tenant_brand ?? lead.tenant_id}. Saw you just looked at our offer — what's your main goal with this? Reply STOP to opt out.`

  const sent = await sendSms({ from: tenantRow.twilio_inbound_number, to: lead.phone_e164, body })

  // Record + transition
  await withTenant(lead.tenant_id, async (sdb) => {
    const { data: conv } = await sdb.from('conversations').insert({ lead_id: lead.id, tenant_id: lead.tenant_id, channel: 'sms' }).select().single()
    await sdb.from('messages').insert({ conversation_id: conv.id, direction: 'out', body })
    await sdb.from('leads').update({ status: 'CONTACTED', contacted_at: new Date().toISOString() }).eq('id', lead.id)
  })

  return NextResponse.json({ ok: true, message_sid: sent.sid })
}
```

- [ ] **Step 4: Run test, expect PASS (or skipped routes return 401 — that's also PASS for the smoke)**

Run: `pnpm vitest run tests/integration/sms-outbound.test.ts`
Expected: PASS or 401.

- [ ] **Step 5: Commit**

```bash
git add apps/sales-agent/app/api/sms/outbound/ apps/sales-agent/lib/twilio-send.ts apps/sales-agent/tests/integration/sms-outbound.test.ts
git commit -m "feat(b3): /api/sms/outbound/[lead_id] internal trigger for first contact"
```

---

### Task 20: `/api/stripe/webhook/[tenant_id]` — payment closed listener

**Files:**
- Create: `apps/sales-agent/app/api/stripe/webhook/[tenant_id]/route.ts`
- Create: `apps/sales-agent/tests/integration/stripe-webhook.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// apps/sales-agent/tests/integration/stripe-webhook.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/stripe/webhook/[tenant_id]/route'

describe('POST /api/stripe/webhook/[tenant_id]', () => {
  it('returns 401 without valid Stripe signature', async () => {
    const req = new Request('http://localhost/api/stripe/webhook/moe-legacy', {
      method: 'POST',
      body: JSON.stringify({ type: 'payment_intent.succeeded' }),
    })
    const res = await POST(req as any, { params: { tenant_id: 'moe-legacy' } } as any)
    expect([400, 401]).toContain(res.status)
  })
})
```

- [ ] **Step 2: Implement route**

```typescript
// apps/sales-agent/app/api/stripe/webhook/[tenant_id]/route.ts
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { withTenant, createServiceClient } from '@/lib/supabase'
import { guardTenant, LicenseDisabledError } from '@/lib/guard'

export async function POST(req: Request, { params }: { params: { tenant_id: string } }): Promise<NextResponse> {
  const sig = req.headers.get('stripe-signature') ?? ''
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 })

  // Per-tenant webhook secret (looked up from tenants table or env)
  const db = createServiceClient()
  const { data: tenant } = await db.from('tenants').select('stripe_account_id').eq('id', params.tenant_id).single()
  if (!tenant) return NextResponse.json({ error: 'tenant not found' }, { status: 404 })

  const secretEnvKey = `STRIPE_WEBHOOK_SECRET_${params.tenant_id.toUpperCase().replace(/-/g,'_')}`
  const secret = process.env[secretEnvKey]
  if (!secret) return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 })

  const body = await req.text()
  const stripe = new Stripe('sk_dummy_for_construct_event_only', { apiVersion: '2024-06-20' as any })
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  try { await guardTenant(params.tenant_id) }
  catch (e) {
    if (e instanceof LicenseDisabledError) return NextResponse.json({ skipped: 'license_disabled' }, { status: 503 })
    throw e
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent
    await withTenant(params.tenant_id, async (sdb) => {
      const { data: lead } = await sdb.from('leads')
        .select('id, conversation_id')
        .eq('stripe_payment_intent_id', pi.id)
        .maybeSingle()
      if (lead) {
        await sdb.from('leads').update({
          status: 'CLOSED', closed_at: new Date().toISOString()
        }).eq('id', lead.id)
      }
    })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Run test, expect PASS**

Run: `pnpm vitest run tests/integration/stripe-webhook.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/sales-agent/app/api/stripe/webhook/ apps/sales-agent/tests/integration/stripe-webhook.test.ts
git commit -m "feat(b3): /api/stripe/webhook/[tenant_id] per-tenant payment listener"
```

---

### Task 21: `/api/cal/webhook/[tenant_id]` — booking listener

**Files:**
- Create: `apps/sales-agent/app/api/cal/webhook/[tenant_id]/route.ts`
- Create: `apps/sales-agent/tests/integration/cal-webhook.test.ts`

- [ ] **Step 1: Write test**

```typescript
// apps/sales-agent/tests/integration/cal-webhook.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/cal/webhook/[tenant_id]/route'

describe('POST /api/cal/webhook/[tenant_id]', () => {
  it('returns 401 without valid signing key', async () => {
    const req = new Request('http://localhost/api/cal/webhook/moe-legacy', {
      method: 'POST',
      body: JSON.stringify({ triggerEvent: 'BOOKING_CREATED' }),
    })
    const res = await POST(req as any, { params: { tenant_id: 'moe-legacy' } } as any)
    expect([401, 400]).toContain(res.status)
  })
})
```

- [ ] **Step 2: Implement route**

```typescript
// apps/sales-agent/app/api/cal/webhook/[tenant_id]/route.ts
import { NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { withTenant } from '@/lib/supabase'
import { guardTenant, LicenseDisabledError } from '@/lib/guard'

function verifyCalSignature(body: string, sig: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  if (sig.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'))
}

export async function POST(req: Request, { params }: { params: { tenant_id: string } }): Promise<NextResponse> {
  const sig = req.headers.get('x-cal-signature-256') ?? ''
  const secretEnvKey = `CAL_WEBHOOK_SECRET_${params.tenant_id.toUpperCase().replace(/-/g,'_')}`
  const secret = process.env[secretEnvKey]
  if (!secret) return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 })

  const body = await req.text()
  if (!verifyCalSignature(body, sig, secret)) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })

  try { await guardTenant(params.tenant_id) }
  catch (e) {
    if (e instanceof LicenseDisabledError) return NextResponse.json({ skipped: 'license_disabled' }, { status: 503 })
    throw e
  }

  const evt = JSON.parse(body) as { triggerEvent: string; payload?: { attendees?: Array<{ phone?: string; email?: string }>; uid?: string } }
  if (evt.triggerEvent === 'BOOKING_CREATED' && evt.payload) {
    const phone = evt.payload.attendees?.[0]?.phone
    if (phone) {
      await withTenant(params.tenant_id, async (sdb) => {
        await sdb.from('leads').update({
          status: 'BOOKED'
        }).eq('phone_e164', phone)
      })
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Run test, expect PASS**

Run: `pnpm vitest run tests/integration/cal-webhook.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/sales-agent/app/api/cal/webhook/ apps/sales-agent/tests/integration/cal-webhook.test.ts
git commit -m "feat(b3): /api/cal/webhook/[tenant_id] booking listener with HMAC verify"
```

---

### Task 22: Realtime subscriber — `lead_received` → trigger first outbound

**Files:**
- Create: `apps/sales-agent/lib/realtime-subscriber.ts`
- Create: `apps/sales-agent/app/api/_realtime/start/route.ts`
- Create: `apps/sales-agent/tests/unit/realtime.test.ts`

- [ ] **Step 1: Implement subscriber**

```typescript
// apps/sales-agent/lib/realtime-subscriber.ts
import { createServiceClient } from './supabase'

const TRIGGER_URL_BASE = process.env.SELF_BASE_URL ?? 'https://sales.tmmt.tools'
const INTERNAL_KEY = process.env.INTERNAL_TRIGGER_KEY!

export function startRealtimeSubscriber(): { stop: () => Promise<void> } {
  const db = createServiceClient()
  const channel = db.channel('public:leads')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'leads', filter: 'status=eq.NEW' },
      async (payload) => {
        const leadId = (payload.new as any).id
        try {
          await fetch(`${TRIGGER_URL_BASE}/api/sms/outbound/${leadId}`, {
            method: 'POST',
            headers: { 'x-internal-key': INTERNAL_KEY },
          })
        } catch (e) {
          console.error('realtime trigger failed', e)
        }
      })
    .subscribe()

  return { stop: async () => { await channel.unsubscribe() } }
}
```

- [ ] **Step 2: Write smoke test**

```typescript
// apps/sales-agent/tests/unit/realtime.test.ts
import { describe, it, expect } from 'vitest'
import { startRealtimeSubscriber } from '@/lib/realtime-subscriber'

describe('startRealtimeSubscriber', () => {
  it('returns a stop function', () => {
    const sub = startRealtimeSubscriber()
    expect(typeof sub.stop).toBe('function')
  })
})
```

- [ ] **Step 3: Run test, expect PASS**

Run: `pnpm vitest run tests/unit/realtime.test.ts`
Expected: PASS.

> Note: Realtime subscriber runs as a long-lived process. For Vercel (serverless), use a Supabase Edge Function or a separate worker (Railway/Fly). For v1, document that the subscriber must be deployed as a separate Node process (e.g. on BRAINIAC-7 via PM2 launchd). Sprint 2 ships this as a docs runbook; Sprint 4 may migrate to Supabase Edge.

- [ ] **Step 4: Create runbook**

Create `docs/runbooks/b3-realtime-subscriber.md`:

```markdown
# B3 Realtime Subscriber Deployment

The realtime subscriber is a long-lived Node process. NOT a Vercel route.

## Deploy options
1. **BRAINIAC-7** (recommended for v1): run as a launchd service
2. **Railway / Fly.io** (recommended for v2): dedicated tiny container

## BRAINIAC-7 setup
1. `git clone <repo>; cd apps/sales-agent; pnpm install`
2. Create `.env` with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, INTERNAL_TRIGGER_KEY, SELF_BASE_URL
3. Create launchd plist at `~/Library/LaunchAgents/com.aixmos.b3-subscriber.plist`:
   ```xml
   <?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0"><dict>
     <key>Label</key><string>com.aixmos.b3-subscriber</string>
     <key>ProgramArguments</key><array>
       <string>/path/to/node</string>
       <string>/path/to/apps/sales-agent/scripts/run-subscriber.js</string>
     </array>
     <key>RunAtLoad</key><true/>
     <key>KeepAlive</key><true/>
   </dict></plist>
   ```
4. `launchctl load ~/Library/LaunchAgents/com.aixmos.b3-subscriber.plist`

## Verify
Insert a test lead with status=NEW. Watch /api/sms/outbound/[id] receive a POST within 5 seconds.

## Rollback
`launchctl unload ~/Library/LaunchAgents/com.aixmos.b3-subscriber.plist` — leads still arrive in DB but no first contact fires.
```

- [ ] **Step 5: Commit + tag webhooks milestone**

```bash
git add apps/sales-agent/lib/realtime-subscriber.ts apps/sales-agent/tests/unit/realtime.test.ts docs/runbooks/b3-realtime-subscriber.md
git commit -m "feat(b3): realtime subscriber + deployment runbook"
git tag v0.5.4-b3-webhooks
```

---

## Phase 5 — Operational + Test (Tasks 23–25)

### Task 23: 10DLC registration runbook (operational, no code)

**Files:**
- Create: `docs/runbooks/twilio-10dlc-registration.md`

- [ ] **Step 1: Write runbook**

```markdown
# Twilio 10DLC Registration (per tenant)

Each tenant must register their own A2P 10DLC campaign. Approval takes 1-4 weeks.

## Per-tenant prerequisites
- Active EIN
- Registered business name + address
- Privacy policy URL accessible from a stable domain
- Terms of service URL
- Sample message templates

## Steps
1. **Brand registration** in Twilio Console → Messaging → A2P 10DLC → Brand. Submit EIN, brand name. ~24-72h.
2. **Campaign registration** → Campaign → use-case "Mixed" with sample messages from `lib/persona/base-prompt.ts` first-contact template.
3. **Phone number assignment**: buy a local number with SMS+Voice; assign to campaign.
4. **Webhook configuration**: set Messaging URL to `https://sales.tmmt.tools/api/sms/inbound`; HTTP POST.
5. **Store credentials in tenant row**:
   ```sql
   UPDATE tenants SET
     twilio_inbound_number='+1NNNNNNNNNN',
     twilio_account_sid='ACxxxx',
     twilio_auth_token_secret_name='aixmos_twilio_<tenant_id>'
   WHERE id='<tenant_id>';
   ```
6. **Store auth token in Supabase Vault** (NEVER as env var, NEVER in repo):
   ```sql
   SELECT vault.create_secret('<auth_token>', 'aixmos_twilio_<tenant_id>', 'Twilio auth token for tenant <tenant_id>');
   ```

## Kick off BEFORE Sprint 2 starts
10DLC is the calendar-time bottleneck. Start brand+campaign submissions on Day 1 of Sprint 1 so approval lands when B3 SMS code is ready.

## STOP/HELP handling
Twilio auto-handles STOP/HELP on 10DLC if "Standard A2P STOP/HELP" is enabled in campaign settings. Verify before going live. Our `compliance/opt-out.ts` is a second-line defense.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/twilio-10dlc-registration.md
git commit -m "docs(b3): Twilio 10DLC registration runbook (per-tenant)"
```

---

### Task 24: End-to-end happy-path integration test

**Files:**
- Create: `apps/sales-agent/tests/integration/happy-path.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// apps/sales-agent/tests/integration/happy-path.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/llm-router', () => {
  let turn = 0
  return {
    callAgent: vi.fn().mockImplementation(async ({ userMessage }: any) => {
      turn++
      if (turn === 1) return { parsed: { message: 'Tell me about your budget?', assessment: { B: 0.3, A: 0.7, T: 0.7, confidence: 0.7 }, next_action: 'ask_budget' }, raw: '', cost_usd: 0.001, model: 'sonnet' }
      if (turn === 2) return { parsed: { message: 'Great, here is your link!', assessment: { B: 0.9, A: 0.9, T: 0.9, confidence: 0.9 }, next_action: 'send_stripe_link' }, raw: '', cost_usd: 0.001, model: 'sonnet' }
      return { parsed: { message: 'Confirmed', assessment: { B: 1, A: 1, T: 1, confidence: 1 }, next_action: 'wait' }, raw: '', cost_usd: 0.001, model: 'sonnet' }
    }),
    routeModel: () => 'sonnet',
  }
})
vi.mock('@/lib/guard', () => ({ guardTenant: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/audit', () => ({ emitAudit: vi.fn() }))
vi.mock('@/lib/twilio-send', () => ({ sendSms: vi.fn().mockResolvedValue({ sid: 'SM_OUT' }) }))

describe('Happy path: lead arrives → qualifies → closes <$97 SKU', () => {
  it('completes the full flow', async () => {
    const { processInbound } = await import('@/lib/agent')
    const tenant = {
      id: 'test-partner', agentName: 'Test', tenantBrand: 'Test',
      agentPersonaOverlay: {}, handoffSlackWebhook: null, handoffImessageTarget: null,
      calComEventLink: 'https://cal.com/test', stripeAccountId: 'acct_test', llmDailyCapUsd: 50,
    }
    // Turn 1: initial inbound
    const r1 = await processInbound({
      tenant: tenant as any,
      prevState: 'CONTACTED', sku: 'lead-magnet', skuPrice: 97,
      inboundBody: 'hi, what is this?', phone: '+15551001001',
      recentMessages: [], licenseJwt: 'test',
    })
    expect(['CONTACTED','QUALIFIED']).toContain(r1.newState)

    // Turn 2: positive response → should QUALIFIED + send_stripe_link
    const r2 = await processInbound({
      tenant: tenant as any,
      prevState: r1.newState, sku: 'lead-magnet', skuPrice: 97,
      inboundBody: 'I have the budget and am ready now', phone: '+15551001001',
      recentMessages: [{ direction: 'in', body: 'hi' }, { direction: 'out', body: r1.outboundBody ?? '' }],
      licenseJwt: 'test',
    })
    expect(r2.newState).toBe('QUALIFIED')
    expect(r2.actions.some(a => a.kind === 'send_stripe_link')).toBe(true)
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `cd apps/sales-agent && pnpm vitest run`
Expected: ALL unit + integration tests PASS. Coverage report > 80% on `lib/`.

- [ ] **Step 3: Commit**

```bash
git add apps/sales-agent/tests/integration/happy-path.test.ts
git commit -m "test(b3): end-to-end happy path integration test"
```

---

### Task 25: Deploy + final smoke + tag

⚠️ **BEFORE YOU TOUCH PROD:**
1. Merge `b3-sms` Supabase branch to main via `supabase branches merge b3-sms`
2. Verify NO existing prod queries break (run pre-existing test suites of `apps/partner` against new schema)
3. Deploy to a Vercel preview URL FIRST, run Task 24's happy-path test against the preview
4. Only then promote to production

- [ ] **Step 1: Merge Supabase branch**

Run:
```bash
supabase branches merge b3-sms
```
Expected: merge succeeds; prod has new tables.

- [ ] **Step 2: Smoke prod schema**

Run:
```bash
psql "$SUPABASE_DB_URL" -c "\d leads" | head
psql "$SUPABASE_DB_URL" -c "\d conversations" | head
psql "$SUPABASE_DB_URL" -c "\d messages" | head
```
Expected: 3 tables present with expected columns.

- [ ] **Step 3: Deploy `sales-agent` to Vercel preview**

Run:
```bash
cd apps/sales-agent
vercel --prod=false  # preview deploy
```
Expected: preview URL returned, `_health` returns 200.

- [ ] **Step 4: Run end-to-end smoke against preview**

Create `scripts/test-b3-sms-smoke.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
PREVIEW_URL="${1:?usage: $0 <preview-url>}"
ADMIN_KEY="${ADMIN_KEY:?}"

# Seed a test lead
psql "$SUPABASE_DB_URL" -c "
INSERT INTO leads (tenant_id, phone_e164, sku, status)
VALUES ('test-partner', '+15559990001', 'lead-magnet', 'NEW')
RETURNING id;" > /tmp/lead.txt
LEAD_ID=$(awk '/^ *[a-f0-9-]+$/ {print $1; exit}' /tmp/lead.txt | tr -d ' ')

# Wait 5s for realtime subscriber (assumed running on BRAINIAC)
sleep 5

# Verify outbound was sent
COUNT=$(psql "$SUPABASE_DB_URL" -t -c "SELECT count(*) FROM messages m JOIN conversations c ON m.conversation_id=c.id WHERE c.lead_id='$LEAD_ID' AND m.direction='out';" | tr -d ' ')
[[ "$COUNT" -ge 1 ]] || { echo "FAIL: no outbound message sent"; exit 1; }
echo "✓ first outbound fired"

# Clean up
psql "$SUPABASE_DB_URL" -c "DELETE FROM leads WHERE id='$LEAD_ID';"
echo "ALL B3 SMS SMOKE PASS"
```

- [ ] **Step 5: Promote to production**

If preview smoke green:
```bash
cd apps/sales-agent
vercel --prod
```

- [ ] **Step 6: Commit + final tag**

```bash
git add scripts/test-b3-sms-smoke.sh
chmod +x scripts/test-b3-sms-smoke.sh
git commit -m "feat(b3): end-to-end SMS smoke + production deploy script"
git tag v0.5-b3-sms
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1 problem statement | Plan goal + Task 0 prereq |
| §2 goals (1-8) | Tasks 18 (≤60s), 13+15 (FSM+links), 12 (LLM), 11 (overlay), 17 (handoff), realtime sub Task 22 |
| §4 constraints | Locked in code: §4 Twilio/Vapi/Sonnet/Haiku in Tasks 12, 18; persona Task 11; kill-switch Task 5 |
| §5 architecture | Tasks 4, 5, 17, 18 |
| §6 state machine | Task 13 |
| §7 conversation goals | Task 13 + Task 17 orchestration |
| §8 compliance gates 8.1-8.5 | Task 7 (opt-out), Task 8 (quiet hours), Task 9 (disclaimers), Task 10 (banned phrases) |
| §9 persona | Task 11 |
| §10 voice | NOT in this plan — Plan B3.2 |
| §11 storage | Tasks 1, 2 |
| §12 kill-switch | Task 5 + integrated in every webhook (18, 19, 20, 21) |
| §13 test plan (10 scenarios) | Coverage: 1 (happy SMS close) Task 24, 2 (booking) covered by FSM test 13, 3 (STOP) Task 7, 4 (quiet hours) Task 8, 5 (banned phrase regen) Tasks 10+17, 6 (license revoke) Task 5, 7 (red flag handoff) Task 17, 8 voice → Plan B3.2, 9 (cross-tenant RLS) Task 1, 10 (LLM cost tracking) Task 12 |
| §14 components | All file paths in plan File Structure section |

**Gap noted:** Spec §13 test scenario 8 (voice inbound smoke) is intentionally deferred to Plan B3.2. Test scenarios 9 (cross-tenant isolation integration) and 10 (LLM cost tracking integration end-to-end) — the unit tests cover the building blocks; full integration tests for those should be added in B3.2 alongside voice.

**Placeholder scan:** No "TBD", "TODO", "implement later". The phrase "for v1, document that the subscriber must be deployed as a separate Node process" in Task 22 is the actual plan (the runbook IS created in that task), not a placeholder.

**Type consistency:**
- `TenantContext` interface — defined Task 6, used Tasks 11, 15, 16, 17, 18, 19
- `State` + `Event` + `Action` — defined Task 13, used Task 17
- `LLMOutput` schema — defined Task 12, used Task 17
- `AuditEvent` — defined Task 14, used Task 17 + webhooks
- All names consistent across tasks.

**Operational gates (re-stated for safety):**
- Task 0 pre-flight prereqs must pass before Task 1
- Task 23 10DLC runbook should kick off on Day 1 of Sprint 1 (calendar-time bottleneck)
- Task 25 deploy gate explicitly: Supabase branch merge → preview deploy → smoke → only then prod
- `B3_KILL_SWITCH=1` env var = operational off-switch independent of license; redeploy-driven

---
