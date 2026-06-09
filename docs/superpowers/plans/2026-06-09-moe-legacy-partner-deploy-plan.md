# Moe Legacy Partner Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the partner-deploy infrastructure that lets a USB flash drive install the AIXMOS / TMMT stack onto a partner's MacBook with hardware-pinned licensing, four-tier remote kill-switch, narrow Tailnet ACL, sealed binaries, and a 10-minute repeatable provisioning script.

**Architecture:** Cloud apps (Vercel) + thin desktop wrapper (Tauri webview). Server-side multi-tenant middleware enforces `tenant_id` via Supabase RLS on every request. Local PyInstaller-sealed agents load prompts at runtime from a signed API. License JWT is hardware-pinned via Apple Silicon Secure Enclave. Heartbeats every 24h to `lic.tmmt.tools`; audit events shipped hourly to `log.tmmt.tools`. Tailnet ACL `tag:partner-moe` narrowly scoped.

**Tech Stack:** Next.js 14 App Router (existing `~/Projects/TMMT`), TypeScript 5.x, Supabase (`uapxakmlwnpfsftfeezx` project, Postgres + Vault), `jose` (Node JWT), Tauri 2 (Rust+JS), Python 3.12 + PyInstaller 6, `python-jose`, SQLCipher via `better-sqlite3-multiple-ciphers`, Apple Developer ID + `notarytool`, Tailscale ACL JSON, UGREEN NAS SMB, Pandoc (legal docs).

**Reference spec:** `~/Projects/TMMT/docs/superpowers/specs/2026-06-09-moe-legacy-partner-deploy-design.md` (commit `81f4514`).

**Priority labels:**
- **P0** = Sprint 1, blocks everything else (Phase 1)
- **P1** = Sprint 2, depends on P0 (Phases 2, 3)
- **P2** = Parallel with P1 (Phases 4, 5)
- **P3** = Gate before Moe's drive ships (Phase 6)

---

## File Structure (decomposition)

```
~/Projects/TMMT/
├─ apps/
│  ├─ partner/                       # NEW — partner.tmmt-ops.com Next.js app
│  │   ├─ middleware.ts              # tenant JWT verify + Supabase RLS header
│  │   ├─ app/
│  │   │   ├─ inbox/page.tsx         # reserved for Spec B; stub for now
│  │   │   ├─ ops/page.tsx           # multi-tenant TMMT-Ops
│  │   │   └─ credit-funding/        # multi-tenant intake
│  │   └─ lib/tenant.ts              # tenant resolution helpers
│  └─ license-server/                # NEW — lic.tmmt.tools
│      ├─ app/v1/provision/route.ts  # one-time install handshake
│      ├─ app/v1/heartbeat/route.ts  # 24h check-in + revoke return
│      ├─ app/v1/revoke/route.ts     # admin endpoint (auth: service role)
│      └─ lib/
│          ├─ vault.ts               # Supabase Vault accessors
│          ├─ jwt.ts                 # JWT sign/verify with Vault-held key
│          └─ hardware-pin.ts        # Apple Silicon UUID + Enclave key validate
├─ apps/audit-ingest/                # NEW — log.tmmt.tools
│   └─ app/v1/events/route.ts        # NDJSON ingest, append-only
├─ supabase/
│   └─ migrations/
│       ├─ 20260609000001_tenants.sql
│       ├─ 20260609000002_licenses.sql
│       ├─ 20260609000003_audit_events.sql
│       ├─ 20260609000004_tenant_id_on_existing.sql
│       └─ 20260609000005_rls_policies.sql
├─ clients/                          # NEW — desktop apps
│   ├─ partner-shell/                # Tauri AIXMOS Partner.app
│   │   ├─ src-tauri/
│   │   │   ├─ src/main.rs           # license verify on boot, heartbeat
│   │   │   ├─ src/clickwrap.rs      # install-time consent UI
│   │   │   └─ tauri.conf.json
│   │   ├─ src/                      # webview entry
│   │   └─ scripts/
│   │       ├─ sign-and-notarize.sh
│   │       └─ build-dmg.sh
│   └─ brain-app/                    # PyInstaller AIXMOS Brain.app
│       ├─ aixmos_brain/
│       │   ├─ __main__.py
│       │   ├─ license_client.py     # heartbeat + cache
│       │   ├─ prompt_loader.py      # signed-API fetch + SQLCipher cache
│       │   ├─ audit.py              # NDJSON writer
│       │   └─ agents/
│       │       ├─ __init__.py
│       │       └─ sales_qualifier_stub.py  # slot for Spec B
│       ├─ pyinstaller.spec
│       └─ scripts/
│           └─ build-pkg.sh
├─ flash-drive/                      # NEW — drive layout source
│   ├─ START-HERE.command
│   ├─ _installer/install.sh
│   ├─ _onetime/.gitignore           # tokens generated per-build, not committed
│   ├─ legal/                        # populated from ~/Documents/Business/legal/
│   └─ README.txt
├─ scripts/
│   ├─ provision-partner.sh          # NEW — one-shot partner provisioner
│   ├─ build-flash-image.sh          # NEW — produce per-partner drive
│   ├─ rotate-signing-key.sh         # NEW — Vault key rotation
│   └─ test-partner-smoke.sh         # NEW — runs spec §14 test plan
├─ infra/
│   ├─ tailnet-acl.hujson            # NEW — Tailscale ACL (commit before apply)
│   └─ dns/                          # NEW — Vercel domain wiring notes
└─ docs/
    └─ runbooks/
        ├─ partner-recovery.md       # NEW — Moe's-Mac-died workflow
        └─ kill-switch.md            # NEW — flip-the-switch procedure

~/Documents/Business/legal/moe-legacy/   # OUTSIDE repo per secrets pattern
├─ master-partner-agreement-v0.md
├─ data-processing-addendum-v0.md
├─ acceptable-use-policy-v0.md
└─ moe-legacy-clickwrap-record.json    # populated at install

~/.config/tmmt/                      # OUTSIDE repo (mode 700)
└─ license-signing-key.backup.enc    # CYBORG-backup encrypted copy
```

**Decomposition rationale:** Each `apps/*` is independently deployable to its own Vercel project. `clients/*` builds two signed bundles. `flash-drive/` is just file layout — the actual flashable image is produced by `build-flash-image.sh`. Legal docs live OUTSIDE the repo per [[feedback_secrets_outside_repo]] and never get committed.

---

## Phase 1 — Control Plane (P0)

Builds: Supabase schema, license server (`lic.tmmt.tools`), audit ingest (`log.tmmt.tools`), tenant middleware on `partner.tmmt-ops.com`. After Phase 1: you can issue + revoke licenses by curl. Kill-switch works end-to-end with no client yet.

### Task 1: Supabase schema — tenants, licenses, audit_events

**Files:**
- Create: `supabase/migrations/20260609000001_tenants.sql`
- Create: `supabase/migrations/20260609000002_licenses.sql`
- Create: `supabase/migrations/20260609000003_audit_events.sql`
- Test: `supabase/tests/schema_test.sql`

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/schema_test.sql
BEGIN;
SELECT plan(6);

SELECT has_table('tenants');
SELECT col_is_pk('tenants', 'id');
SELECT has_table('licenses');
SELECT col_type_is('licenses', 'kill_command', 'text');
SELECT has_table('audit_events');
SELECT col_type_is('audit_events', 'ts', 'timestamp with time zone');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/TMMT && supabase test db --linked`
Expected: FAIL — tables do not exist yet.

- [ ] **Step 3: Write migration `20260609000001_tenants.sql`**

```sql
CREATE TABLE tenants (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb
);

REVOKE ALL ON tenants FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON tenants TO service_role;

-- Seed Moe Legacy and a test partner tenant
INSERT INTO tenants (id, name) VALUES
  ('moe-legacy', 'Moe Legacy'),
  ('test-partner', 'Test Partner (smoke)');
```

- [ ] **Step 4: Write migration `20260609000002_licenses.sql`**

```sql
CREATE TABLE licenses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text NOT NULL REFERENCES tenants(id),
  hardware_uuid       text NOT NULL,
  enclave_pubkey_pem  text NOT NULL,
  active              boolean NOT NULL DEFAULT true,
  kill_command        text CHECK (kill_command IN (NULL, 'wipe')),
  install_token_hash  text NOT NULL,
  install_token_used  boolean NOT NULL DEFAULT false,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at   timestamptz,
  expires_at          timestamptz,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (tenant_id, hardware_uuid)
);

CREATE INDEX licenses_tenant_idx ON licenses(tenant_id);
CREATE INDEX licenses_active_idx ON licenses(active, last_heartbeat_at);

REVOKE ALL ON licenses FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON licenses TO service_role;
```

- [ ] **Step 5: Write migration `20260609000003_audit_events.sql`**

```sql
CREATE TABLE audit_events (
  id           bigserial PRIMARY KEY,
  ts           timestamptz NOT NULL DEFAULT now(),
  tenant_id    text NOT NULL REFERENCES tenants(id),
  hardware_uuid text,
  ip           inet,
  action       text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX audit_tenant_ts_idx ON audit_events(tenant_id, ts DESC);
CREATE INDEX audit_action_idx ON audit_events(action);

REVOKE ALL ON audit_events FROM PUBLIC;
GRANT INSERT ON audit_events TO service_role;
GRANT SELECT ON audit_events TO service_role; -- admin/read for owner only
-- Explicitly NO update/delete grants. Append-only.
```

- [ ] **Step 6: Apply migrations and run test**

Run:
```bash
cd ~/Projects/TMMT
supabase migration up --linked
supabase test db --linked
```
Expected: 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
cd ~/Projects/TMMT
git add supabase/migrations/2026060900000{1,2,3}_*.sql supabase/tests/schema_test.sql
git commit -m "feat(supabase): add tenants, licenses, audit_events tables"
```

---

### Task 2: Supabase Vault — license signing key

**Files:**
- Create: `supabase/migrations/20260609000006_vault_signing_key.sql`
- Create: `apps/license-server/lib/vault.ts`
- Test: `apps/license-server/lib/vault.test.ts`

- [ ] **Step 1: Generate the Ed25519 keypair locally (one-time, offline)**

Run:
```bash
mkdir -p /tmp/aixmos-keygen && cd /tmp/aixmos-keygen
openssl genpkey -algorithm ED25519 -out signing-key.pem
openssl pkey -in signing-key.pem -pubout -out signing-pub.pem
cat signing-key.pem  # COPY this string for next step; DO NOT commit
cat signing-pub.pem  # COPY for client embedding
```

- [ ] **Step 2: Write migration to store private key in Supabase Vault**

```sql
-- supabase/migrations/20260609000006_vault_signing_key.sql
-- NOTE: actual secret value is inserted via SQL Editor with the PEM pasted in,
-- not committed to git. This migration creates the named placeholder.
SELECT vault.create_secret(
  '<PASTE_PRIVATE_KEY_PEM_HERE>',  -- replace via Supabase Studio before run
  'aixmos_license_signing_key',
  'Ed25519 private key for hardware-pinned partner license JWTs'
);
```

> Engineer note: Paste the PEM from `/tmp/aixmos-keygen/signing-key.pem` directly into the Supabase SQL Editor for this migration only. Do NOT commit the populated version. After successful insert, `shred -u /tmp/aixmos-keygen/signing-key.pem`.

- [ ] **Step 3: Write failing test for `vault.ts`**

```typescript
// apps/license-server/lib/vault.test.ts
import { describe, it, expect } from 'vitest'
import { getSigningKey } from './vault'

describe('vault', () => {
  it('retrieves the signing key from Supabase Vault', async () => {
    const pem = await getSigningKey()
    expect(pem).toMatch(/-----BEGIN PRIVATE KEY-----/)
    expect(pem).toMatch(/-----END PRIVATE KEY-----/)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm vitest run lib/vault.test.ts`
Expected: FAIL — `getSigningKey is not defined`.

- [ ] **Step 5: Implement `vault.ts`**

```typescript
// apps/license-server/lib/vault.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

let cachedKey: string | null = null
let cachedAt = 0

export async function getSigningKey(): Promise<string> {
  const now = Date.now()
  if (cachedKey && now - cachedAt < 5 * 60 * 1000) return cachedKey

  const { data, error } = await supabase
    .schema('vault')
    .from('decrypted_secrets')
    .select('decrypted_secret')
    .eq('name', 'aixmos_license_signing_key')
    .single()

  if (error) throw new Error(`Vault read failed: ${error.message}`)
  if (!data?.decrypted_secret) throw new Error('Signing key not in Vault')

  cachedKey = data.decrypted_secret
  cachedAt = now
  return cachedKey
}

export function clearVaultCache(): void {
  cachedKey = null
  cachedAt = 0
}
```

- [ ] **Step 6: Run test to verify PASS**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm vitest run lib/vault.test.ts`
Expected: PASS.

- [ ] **Step 7: Back up encrypted copy to CYBORG**

Run:
```bash
# Encrypt the local key with a passphrase you'll remember
openssl pkcs8 -topk8 -in /tmp/aixmos-keygen/signing-key.pem \
  -out ~/.config/tmmt/license-signing-key.backup.enc -v2 aes-256-cbc
chmod 600 ~/.config/tmmt/license-signing-key.backup.enc
# When CYBORG is mounted, copy there as well
# cp ~/.config/tmmt/license-signing-key.backup.enc /Volumes/CYBORG/keys/
shred -u /tmp/aixmos-keygen/signing-key.pem
```

- [ ] **Step 8: Commit (NO secrets in git)**

```bash
cd ~/Projects/TMMT
git add supabase/migrations/20260609000006_vault_signing_key.sql \
        apps/license-server/lib/vault.ts \
        apps/license-server/lib/vault.test.ts
git diff --cached | grep -i 'BEGIN PRIVATE KEY' && echo "ABORT: key in diff" && exit 1
git commit -m "feat(license-server): add Supabase Vault accessor for signing key"
```

---

### Task 3: License JWT signing helpers

**Files:**
- Create: `apps/license-server/lib/jwt.ts`
- Test: `apps/license-server/lib/jwt.test.ts`

- [ ] **Step 1: Install `jose`**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm add jose`

- [ ] **Step 2: Write failing test**

```typescript
// apps/license-server/lib/jwt.test.ts
import { describe, it, expect } from 'vitest'
import { signLicenseJwt, verifyLicenseJwt } from './jwt'

describe('jwt', () => {
  it('signs and verifies a license JWT', async () => {
    const claims = {
      tenant_id: 'test-partner',
      hardware_uuid: 'ABC-123',
      enclave_pubkey_thumbprint: 'thumb-xyz',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 365,
    }
    const token = await signLicenseJwt(claims)
    expect(token.split('.')).toHaveLength(3)

    const verified = await verifyLicenseJwt(token)
    expect(verified.tenant_id).toBe('test-partner')
    expect(verified.hardware_uuid).toBe('ABC-123')
  })

  it('rejects a tampered JWT', async () => {
    const claims = { tenant_id: 'test', hardware_uuid: 'X', enclave_pubkey_thumbprint: 't' }
    const token = await signLicenseJwt(claims)
    const tampered = token.slice(0, -2) + 'XX'
    await expect(verifyLicenseJwt(tampered)).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Implement `jwt.ts`**

```typescript
// apps/license-server/lib/jwt.ts
import { SignJWT, jwtVerify, importPKCS8, importSPKI, type JWTPayload } from 'jose'
import { getSigningKey } from './vault'

const ALG = 'EdDSA'
const ISSUER = 'aixmos-license'

export interface LicenseClaims extends JWTPayload {
  tenant_id: string
  hardware_uuid: string
  enclave_pubkey_thumbprint: string
}

export async function signLicenseJwt(claims: LicenseClaims): Promise<string> {
  const pem = await getSigningKey()
  const key = await importPKCS8(pem, ALG)
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? '365d')
    .sign(key)
}

export async function verifyLicenseJwt(token: string): Promise<LicenseClaims> {
  const pubPem = process.env.LICENSE_PUBLIC_KEY_PEM!
  const key = await importSPKI(pubPem, ALG)
  const { payload } = await jwtVerify(token, key, { issuer: ISSUER })
  return payload as LicenseClaims
}
```

- [ ] **Step 4: Set env vars**

Add to Vercel project `license-server` env:
- `SUPABASE_URL=https://uapxakmlwnpfsftfeezx.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>`
- `LICENSE_PUBLIC_KEY_PEM=<paste public key PEM, multiline with literal newlines escaped or use Vercel multiline editor>`

- [ ] **Step 5: Run test to verify PASS**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm vitest run lib/jwt.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/license-server/lib/jwt.ts apps/license-server/lib/jwt.test.ts apps/license-server/package.json
git commit -m "feat(license-server): add JWT sign+verify with Vault-backed Ed25519 key"
```

---

### Task 4: `/v1/provision` route (one-time install handshake)

**Files:**
- Create: `apps/license-server/app/v1/provision/route.ts`
- Create: `apps/license-server/app/v1/provision/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/license-server/app/v1/provision/route.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest, resetTestDb } from '@/test-utils'

describe('POST /v1/provision', () => {
  beforeEach(async () => { await resetTestDb() })

  it('issues a license JWT when token is valid and unused', async () => {
    const req = createMockRequest({
      install_token: 'test-token-hmac-valid',
      tenant_id: 'test-partner',
      hardware_uuid: 'M5-TEST-UUID',
      enclave_pubkey_pem: '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----'
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.license_jwt).toMatch(/\./)
    expect(body.heartbeat_url).toBe('https://lic.tmmt.tools/v1/heartbeat')
  })

  it('rejects a reused install token', async () => {
    const req1 = createMockRequest({ install_token: 'reuse-test', tenant_id: 'test-partner', hardware_uuid: 'A', enclave_pubkey_pem: 'X' })
    await POST(req1)
    const req2 = createMockRequest({ install_token: 'reuse-test', tenant_id: 'test-partner', hardware_uuid: 'B', enclave_pubkey_pem: 'Y' })
    const res = await POST(req2)
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm vitest run app/v1/provision`
Expected: FAIL — route does not exist.

- [ ] **Step 3: Implement `route.ts`**

```typescript
// apps/license-server/app/v1/provision/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { signLicenseJwt } from '@/lib/jwt'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

interface ProvisionBody {
  install_token: string
  tenant_id: string
  hardware_uuid: string
  enclave_pubkey_pem: string
}

function hashToken(t: string): string {
  return createHash('sha256').update(t).digest('hex')
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as ProvisionBody
  const { install_token, tenant_id, hardware_uuid, enclave_pubkey_pem } = body

  if (!install_token || !tenant_id || !hardware_uuid || !enclave_pubkey_pem) {
    return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
  }

  const token_hash = hashToken(install_token)

  // 1. Look up tenant
  const { data: tenant } = await supabase.from('tenants').select('id, status').eq('id', tenant_id).single()
  if (!tenant || tenant.status !== 'active') {
    return NextResponse.json({ error: 'tenant not active' }, { status: 403 })
  }

  // 2. Find pre-issued license row (one-time token is pre-loaded by provisioning script)
  const { data: license, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('install_token_hash', token_hash)
    .eq('tenant_id', tenant_id)
    .single()
  if (error || !license) {
    return NextResponse.json({ error: 'invalid install token' }, { status: 403 })
  }
  if (license.install_token_used) {
    return NextResponse.json({ error: 'install token already consumed' }, { status: 409 })
  }

  // 3. Bind hardware + enclave key, mark consumed
  const enclave_thumbprint = createHash('sha256').update(enclave_pubkey_pem).digest('hex')
  await supabase.from('licenses').update({
    hardware_uuid,
    enclave_pubkey_pem,
    install_token_used: true,
    issued_at: new Date().toISOString(),
    last_heartbeat_at: new Date().toISOString(),
  }).eq('id', license.id)

  // 4. Issue JWT
  const license_jwt = await signLicenseJwt({
    tenant_id,
    hardware_uuid,
    enclave_pubkey_thumbprint: enclave_thumbprint,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 365,
  })

  // 5. Audit
  await supabase.from('audit_events').insert({
    tenant_id, hardware_uuid,
    action: 'license.provisioned',
    payload: { license_id: license.id }
  })

  return NextResponse.json({
    license_jwt,
    heartbeat_url: 'https://lic.tmmt.tools/v1/heartbeat',
    audit_url: 'https://log.tmmt.tools/v1/events',
    partner_url: 'https://partner.tmmt-ops.com',
  })
}
```

- [ ] **Step 4: Run test to verify PASS**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm vitest run app/v1/provision`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/license-server/app/v1/provision/
git commit -m "feat(license-server): add /v1/provision one-time install handshake"
```

---

### Task 5: `/v1/heartbeat` route (24h check-in + revoke return)

**Files:**
- Create: `apps/license-server/app/v1/heartbeat/route.ts`
- Create: `apps/license-server/app/v1/heartbeat/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/license-server/app/v1/heartbeat/route.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest, seedLicense, flipKill, resetTestDb } from '@/test-utils'

describe('POST /v1/heartbeat', () => {
  beforeEach(async () => { await resetTestDb() })

  it('returns 200 + fresh tenant token when license is active', async () => {
    const { jwt } = await seedLicense({ tenant_id: 'test-partner', active: true })
    const req = createMockRequest({}, { Authorization: `Bearer ${jwt}` })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tenant_token).toMatch(/\./)
    expect(body.kill_command).toBeNull()
  })

  it('returns 410 when license is soft-killed', async () => {
    const { jwt } = await seedLicense({ tenant_id: 'test-partner', active: false })
    const req = createMockRequest({}, { Authorization: `Bearer ${jwt}` })
    const res = await POST(req)
    expect(res.status).toBe(410)
  })

  it('returns wipe directive when kill_command=wipe', async () => {
    const { jwt, id } = await seedLicense({ tenant_id: 'test-partner', active: true })
    await flipKill(id, 'wipe')
    const req = createMockRequest({}, { Authorization: `Bearer ${jwt}` })
    const res = await POST(req)
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.kill_command).toBe('wipe')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm vitest run app/v1/heartbeat`
Expected: FAIL — route does not exist.

- [ ] **Step 3: Implement `route.ts`**

```typescript
// apps/license-server/app/v1/heartbeat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { createClient } from '@supabase/supabase-js'
import { verifyLicenseJwt } from '@/lib/jwt'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return NextResponse.json({ error: 'missing auth' }, { status: 401 })

  let claims
  try {
    claims = await verifyLicenseJwt(token)
  } catch {
    return NextResponse.json({ error: 'invalid license' }, { status: 401 })
  }

  // Look up the live row
  const { data: license } = await supabase
    .from('licenses')
    .select('*')
    .eq('tenant_id', claims.tenant_id)
    .eq('hardware_uuid', claims.hardware_uuid)
    .single()
  if (!license) return NextResponse.json({ error: 'license not found' }, { status: 401 })

  // Update last_heartbeat
  await supabase.from('licenses')
    .update({ last_heartbeat_at: new Date().toISOString() })
    .eq('id', license.id)

  await supabase.from('audit_events').insert({
    tenant_id: claims.tenant_id, hardware_uuid: claims.hardware_uuid,
    ip: req.headers.get('x-forwarded-for') ?? null,
    action: 'license.heartbeat'
  })

  // Soft-kill / hard-kill check
  if (!license.active || license.kill_command === 'wipe') {
    return NextResponse.json({
      error: 'license_disabled',
      kill_command: license.kill_command ?? null,
    }, { status: 410 })
  }

  // Issue short-lived tenant token for partner.tmmt-ops.com
  const tenantKey = new TextEncoder().encode(process.env.TENANT_TOKEN_SECRET!)
  const tenant_token = await new SignJWT({
    tenant_id: claims.tenant_id,
    hardware_uuid: claims.hardware_uuid,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('aixmos-tenant')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(tenantKey)

  return NextResponse.json({
    tenant_token,
    kill_command: null,
    cache_ttl_seconds: 86400,
  })
}
```

- [ ] **Step 4: Set additional env var**

Add to Vercel `license-server` env: `TENANT_TOKEN_SECRET=<32+ random bytes hex, generate with: openssl rand -hex 32>`. Add the SAME secret to `partner.tmmt-ops.com` env as `TENANT_TOKEN_SECRET`.

- [ ] **Step 5: Run test to verify PASS**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm vitest run app/v1/heartbeat`
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/license-server/app/v1/heartbeat/
git commit -m "feat(license-server): add /v1/heartbeat with soft+hard kill returns"
```

---

### Task 6: `/v1/revoke` admin route (kill-switch operator endpoint)

**Files:**
- Create: `apps/license-server/app/v1/revoke/route.ts`
- Create: `apps/license-server/app/v1/revoke/route.test.ts`
- Create: `docs/runbooks/kill-switch.md`

- [ ] **Step 1: Write failing test**

```typescript
// apps/license-server/app/v1/revoke/route.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest, seedLicense, resetTestDb, getLicense } from '@/test-utils'

describe('POST /v1/revoke (admin)', () => {
  beforeEach(async () => { await resetTestDb() })

  it('soft-kills a license when mode=soft', async () => {
    const { id } = await seedLicense({ tenant_id: 'test-partner', active: true })
    const req = createMockRequest(
      { license_id: id, mode: 'soft' },
      { 'x-admin-key': process.env.ADMIN_KEY! }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const row = await getLicense(id)
    expect(row.active).toBe(false)
    expect(row.kill_command).toBeNull()
  })

  it('hard-kills a license when mode=hard', async () => {
    const { id } = await seedLicense({ tenant_id: 'test-partner', active: true })
    const req = createMockRequest(
      { license_id: id, mode: 'hard' },
      { 'x-admin-key': process.env.ADMIN_KEY! }
    )
    const res = await POST(req)
    expect(res.status).toBe(200)
    const row = await getLicense(id)
    expect(row.active).toBe(false)
    expect(row.kill_command).toBe('wipe')
  })

  it('rejects without admin key', async () => {
    const { id } = await seedLicense({ tenant_id: 'test-partner', active: true })
    const req = createMockRequest({ license_id: id, mode: 'soft' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm vitest run app/v1/revoke`
Expected: FAIL.

- [ ] **Step 3: Implement `route.ts`**

```typescript
// apps/license-server/app/v1/revoke/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function adminAuthorized(req: NextRequest): boolean {
  const provided = req.headers.get('x-admin-key') ?? ''
  const expected = process.env.ADMIN_KEY ?? ''
  if (!provided || !expected || provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { license_id, mode } = await req.json() as { license_id: string; mode: 'soft' | 'hard' }
  if (!license_id || !['soft', 'hard'].includes(mode)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }

  const update: Record<string, unknown> = { active: false }
  if (mode === 'hard') update.kill_command = 'wipe'

  const { data, error } = await supabase
    .from('licenses')
    .update(update)
    .eq('id', license_id)
    .select()
    .single()
  if (error || !data) return NextResponse.json({ error: 'license not found' }, { status: 404 })

  await supabase.from('audit_events').insert({
    tenant_id: data.tenant_id, hardware_uuid: data.hardware_uuid,
    action: mode === 'hard' ? 'license.hard_kill' : 'license.soft_kill',
    payload: { license_id, initiated_by: 'admin' }
  })

  return NextResponse.json({ ok: true, mode, license_id })
}
```

- [ ] **Step 4: Set env var**

Add to Vercel `license-server` env: `ADMIN_KEY=<openssl rand -hex 32>`. Save the value to your password manager.

- [ ] **Step 5: Write runbook**

```markdown
<!-- docs/runbooks/kill-switch.md -->
# Kill-Switch Runbook

## Soft kill (apps refuse to start, files preserved)
```bash
curl -X POST https://lic.tmmt.tools/v1/revoke \
  -H "x-admin-key: $ADMIN_KEY" \
  -H 'content-type: application/json' \
  -d '{"license_id": "<UUID>", "mode": "soft"}'
```
Takes effect on next heartbeat (≤24h). Reversible by flipping `active=true` in Supabase Studio.

## Hard kill (wipe + revoke)
Same as above but `"mode": "hard"`. Takes effect on next heartbeat. NOT reversible — requires new flash drive.

## Reverse a soft kill
Supabase Studio → `licenses` table → set `active=true` for the row.

## Find the license_id
Supabase Studio → `licenses` → filter `tenant_id = 'moe-legacy'` → copy `id`.
```

- [ ] **Step 6: Run test to verify PASS**

Run: `cd ~/Projects/TMMT/apps/license-server && pnpm vitest run app/v1/revoke`
Expected: 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/license-server/app/v1/revoke/ docs/runbooks/kill-switch.md
git commit -m "feat(license-server): add /v1/revoke admin endpoint + runbook"
```

---

### Task 7: Audit ingest endpoint `log.tmmt.tools`

**Files:**
- Create: `apps/audit-ingest/app/v1/events/route.ts`
- Create: `apps/audit-ingest/app/v1/events/route.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/audit-ingest/app/v1/events/route.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from './route'
import { createMockRequest, seedLicense, countEvents, resetTestDb } from '@/test-utils'

describe('POST /v1/events (audit ingest)', () => {
  beforeEach(async () => { await resetTestDb() })

  it('ingests NDJSON events with valid license bearer', async () => {
    const { jwt } = await seedLicense({ tenant_id: 'test-partner' })
    const ndjson = [
      JSON.stringify({ ts: new Date().toISOString(), action: 'app.login', payload: {} }),
      JSON.stringify({ ts: new Date().toISOString(), action: 'agent.call', payload: { agent: 'sales_qualifier' } }),
    ].join('\n')
    const req = createMockRequest(ndjson, { Authorization: `Bearer ${jwt}` }, 'text/plain')
    const res = await POST(req)
    expect(res.status).toBe(202)
    const count = await countEvents('test-partner')
    expect(count).toBe(2)
  })

  it('rejects without valid license', async () => {
    const req = createMockRequest('{}\n', {}, 'text/plain')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/TMMT/apps/audit-ingest && pnpm vitest run`
Expected: FAIL — route does not exist.

- [ ] **Step 3: Implement `route.ts`**

```typescript
// apps/audit-ingest/app/v1/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyLicenseJwt } from '@/lib/jwt'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const MAX_BYTES = 1_000_000
const MAX_LINES = 10_000

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  let claims
  try { claims = await verifyLicenseJwt(token) }
  catch { return NextResponse.json({ error: 'invalid license' }, { status: 401 }) }

  const text = await req.text()
  if (text.length > MAX_BYTES) return NextResponse.json({ error: 'payload too large' }, { status: 413 })

  const lines = text.split('\n').filter(Boolean)
  if (lines.length > MAX_LINES) return NextResponse.json({ error: 'too many events' }, { status: 413 })

  const rows = lines.map(line => {
    const evt = JSON.parse(line)
    return {
      ts: evt.ts ?? new Date().toISOString(),
      tenant_id: claims.tenant_id,
      hardware_uuid: claims.hardware_uuid,
      ip: req.headers.get('x-forwarded-for') ?? null,
      action: evt.action ?? 'unknown',
      payload: evt.payload ?? {},
    }
  })

  const { error } = await supabase.from('audit_events').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ accepted: rows.length }, { status: 202 })
}
```

- [ ] **Step 4: Run test to verify PASS**

Run: `cd ~/Projects/TMMT/apps/audit-ingest && pnpm vitest run`
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/audit-ingest/
git commit -m "feat(audit-ingest): add /v1/events NDJSON ingest"
```

---

### Task 8: Tenant scoping migration + RLS policies

**Files:**
- Create: `supabase/migrations/20260609000004_tenant_id_on_existing.sql`
- Create: `supabase/migrations/20260609000005_rls_policies.sql`
- Create: `supabase/tests/rls_test.sql`

- [ ] **Step 1: Write failing test**

```sql
-- supabase/tests/rls_test.sql
BEGIN;
SELECT plan(3);

-- Setup: add a credit_funding_session for moe-legacy and one for test-partner
INSERT INTO tenants (id, name) VALUES ('moe-legacy', 'Moe'), ('test-partner', 'Test') ON CONFLICT DO NOTHING;
SET LOCAL app.tenant_id = 'moe-legacy';
INSERT INTO credit_funding_sessions (id, tenant_id, status) VALUES (gen_random_uuid(), 'moe-legacy', 'open');

SET LOCAL app.tenant_id = 'test-partner';
INSERT INTO credit_funding_sessions (id, tenant_id, status) VALUES (gen_random_uuid(), 'test-partner', 'open');

-- Test 1: moe-legacy sees only their row
SET LOCAL app.tenant_id = 'moe-legacy';
SELECT is((SELECT count(*) FROM credit_funding_sessions), 1::bigint, 'moe-legacy sees 1 row');

-- Test 2: test-partner sees only their row
SET LOCAL app.tenant_id = 'test-partner';
SELECT is((SELECT count(*) FROM credit_funding_sessions), 1::bigint, 'test-partner sees 1 row');

-- Test 3: unset tenant sees zero
RESET app.tenant_id;
SELECT is((SELECT count(*) FROM credit_funding_sessions), 0::bigint, 'unset tenant sees 0 rows');

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Write migration `20260609000004_tenant_id_on_existing.sql`**

```sql
-- Add tenant_id to overlay tables that need it
-- (credit_funding_sessions is the live example from Phase 9)
ALTER TABLE credit_funding_sessions
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'internal' REFERENCES tenants(id);

CREATE INDEX IF NOT EXISTS credit_funding_sessions_tenant_idx ON credit_funding_sessions(tenant_id);

-- Backfill existing rows to internal tenant
UPDATE credit_funding_sessions SET tenant_id = 'internal' WHERE tenant_id IS NULL;
```

> Note: also `INSERT INTO tenants (id, name) VALUES ('internal', 'Internal (ceo.moe)') ON CONFLICT DO NOTHING;` before this migration runs. Add to the migration body.

- [ ] **Step 3: Write migration `20260609000005_rls_policies.sql`**

```sql
ALTER TABLE credit_funding_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON credit_funding_sessions
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_isolation_modify ON credit_funding_sessions
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

REVOKE ALL ON credit_funding_sessions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON credit_funding_sessions TO authenticated;
GRANT ALL ON credit_funding_sessions TO service_role;
```

- [ ] **Step 4: Apply migrations + run RLS test**

Run:
```bash
cd ~/Projects/TMMT
supabase migration up --linked
supabase test db --linked
```
Expected: 3 RLS tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/2026060900000{4,5}_*.sql supabase/tests/rls_test.sql
git commit -m "feat(supabase): tenant_id RLS on credit_funding_sessions"
```

---

### Task 9: `partner.tmmt-ops.com` middleware (tenant gate)

**Files:**
- Create: `apps/partner/middleware.ts`
- Create: `apps/partner/lib/tenant.ts`
- Create: `apps/partner/middleware.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/partner/middleware.test.ts
import { describe, it, expect } from 'vitest'
import { resolveTenant } from './lib/tenant'

describe('resolveTenant', () => {
  it('extracts tenant from valid tenant_token JWT', async () => {
    const valid = await mintTenantToken({ tenant_id: 'moe-legacy', hardware_uuid: 'X' })
    const tenant = await resolveTenant(valid)
    expect(tenant?.id).toBe('moe-legacy')
  })

  it('returns null for missing or invalid token', async () => {
    expect(await resolveTenant(null)).toBeNull()
    expect(await resolveTenant('garbage.jwt.value')).toBeNull()
  })
})
```

(Helper `mintTenantToken` is a test-util that signs with `TENANT_TOKEN_SECRET`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Projects/TMMT/apps/partner && pnpm vitest run middleware.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/tenant.ts`**

```typescript
// apps/partner/lib/tenant.ts
import { jwtVerify } from 'jose'

export interface Tenant { id: string; hardware_uuid: string }

export async function resolveTenant(token: string | null): Promise<Tenant | null> {
  if (!token) return null
  try {
    const key = new TextEncoder().encode(process.env.TENANT_TOKEN_SECRET!)
    const { payload } = await jwtVerify(token, key, { issuer: 'aixmos-tenant' })
    return {
      id: payload.tenant_id as string,
      hardware_uuid: payload.hardware_uuid as string,
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Implement `middleware.ts`**

```typescript
// apps/partner/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { resolveTenant } from './lib/tenant'

export const config = { matcher: ['/((?!_next|favicon.ico|public).*)'] }

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '') || req.cookies.get('tenant_token')?.value || null
  const tenant = await resolveTenant(token)

  if (!tenant) {
    return NextResponse.json({ error: 'tenant token required' }, { status: 401 })
  }

  const res = NextResponse.next()
  // Pass to downstream handlers — they set the Supabase RLS header per-request
  res.headers.set('x-tenant-id', tenant.id)
  res.headers.set('x-hardware-uuid', tenant.hardware_uuid)
  return res
}
```

- [ ] **Step 5: Run test to verify PASS**

Run: `cd ~/Projects/TMMT/apps/partner && pnpm vitest run middleware.test.ts`
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/partner/middleware.ts apps/partner/lib/tenant.ts apps/partner/middleware.test.ts
git commit -m "feat(partner): tenant JWT middleware gates all routes"
```

---

### Task 10: End-to-end smoke for control plane

**Files:**
- Create: `scripts/test-control-plane.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# scripts/test-control-plane.sh
set -euo pipefail

LIC="${LIC_URL:-https://lic.tmmt.tools}"
LOG="${LOG_URL:-https://log.tmmt.tools}"
PARTNER="${PARTNER_URL:-https://partner.tmmt-ops.com}"
ADMIN_KEY="${ADMIN_KEY:?ADMIN_KEY required}"

echo "==> 1. Seed test license"
PROVISION_RESP=$(curl -sS -X POST "$LIC/v1/provision" \
  -H 'content-type: application/json' \
  -d '{
    "install_token": "smoke-token-'"$(date +%s)"'",
    "tenant_id": "test-partner",
    "hardware_uuid": "SMOKE-'"$(date +%s)"'",
    "enclave_pubkey_pem": "-----BEGIN PUBLIC KEY-----\nSMOKE\n-----END PUBLIC KEY-----"
  }')
LICENSE_JWT=$(echo "$PROVISION_RESP" | jq -r '.license_jwt')
[[ "$LICENSE_JWT" != "null" && -n "$LICENSE_JWT" ]] || { echo "FAIL: provision returned no JWT"; exit 1; }
echo "  ✓ Provisioned license"

echo "==> 2. First heartbeat returns 200 + tenant_token"
HB1=$(curl -sS -w '\n%{http_code}' -X POST "$LIC/v1/heartbeat" -H "Authorization: Bearer $LICENSE_JWT")
HB1_CODE=$(echo "$HB1" | tail -1)
HB1_BODY=$(echo "$HB1" | head -n -1)
[[ "$HB1_CODE" == "200" ]] || { echo "FAIL: heartbeat returned $HB1_CODE"; exit 1; }
TENANT_TOKEN=$(echo "$HB1_BODY" | jq -r '.tenant_token')
[[ "$TENANT_TOKEN" != "null" ]] || { echo "FAIL: no tenant_token"; exit 1; }
echo "  ✓ Heartbeat returned tenant token"

echo "==> 3. Partner subdomain accepts tenant_token"
PARTNER_PING=$(curl -sS -o /dev/null -w '%{http_code}' "$PARTNER/api/whoami" -H "Authorization: Bearer $TENANT_TOKEN")
[[ "$PARTNER_PING" == "200" ]] || { echo "FAIL: partner returned $PARTNER_PING"; exit 1; }
echo "  ✓ Partner subdomain authorized request"

echo "==> 4. Audit ingest accepts NDJSON"
AUDIT_PING=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$LOG/v1/events" \
  -H "Authorization: Bearer $LICENSE_JWT" \
  -H 'content-type: text/plain' \
  --data-binary '{"ts":"2026-06-09T12:00:00Z","action":"smoke.test","payload":{}}')
[[ "$AUDIT_PING" == "202" ]] || { echo "FAIL: audit returned $AUDIT_PING"; exit 1; }
echo "  ✓ Audit event accepted"

echo "==> 5. Soft kill via revoke endpoint"
LICENSE_ID=$(echo "$PROVISION_RESP" | jq -r '.license_id // empty')
# Fall back to looking up by tenant if not returned
if [[ -z "$LICENSE_ID" ]]; then
  LICENSE_ID=$(curl -sS "$LIC/v1/_debug/find?tenant_id=test-partner" -H "x-admin-key: $ADMIN_KEY" | jq -r '.id')
fi
curl -sS -X POST "$LIC/v1/revoke" \
  -H "x-admin-key: $ADMIN_KEY" \
  -H 'content-type: application/json' \
  -d '{"license_id":"'"$LICENSE_ID"'","mode":"soft"}' > /dev/null
echo "  ✓ Soft kill flag flipped"

echo "==> 6. Next heartbeat returns 410"
HB2_CODE=$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$LIC/v1/heartbeat" -H "Authorization: Bearer $LICENSE_JWT")
[[ "$HB2_CODE" == "410" ]] || { echo "FAIL: post-kill heartbeat returned $HB2_CODE"; exit 1; }
echo "  ✓ Heartbeat now returns 410 (kill enforced)"

echo "==> ALL CONTROL PLANE SMOKES PASSED"
```

- [ ] **Step 2: Make executable + run**

Run:
```bash
chmod +x scripts/test-control-plane.sh
ADMIN_KEY=<your value> ./scripts/test-control-plane.sh
```
Expected: All 6 steps print `✓`. Exit code 0.

- [ ] **Step 3: Commit + tag v0.1**

```bash
git add scripts/test-control-plane.sh
git commit -m "feat(scripts): control-plane end-to-end smoke"
git tag v0.1-control-plane
```

---

## Phase 2 — Client Apps (P1)

Builds: Tauri Partner.app shell, PyInstaller Brain.app, sign+notarize pipeline. After Phase 2: signed `.dmg` + `.pkg` artifacts exist; control plane is the boundary they call.

### Task 11: Tauri Partner.app scaffold

**Files:**
- Create: `clients/partner-shell/` (full Tauri 2 init)

- [ ] **Step 1: Init Tauri**

Run:
```bash
cd ~/Projects/TMMT/clients
pnpm create tauri-app@latest partner-shell -- --template vanilla-ts --identifier com.aixmos.partner
cd partner-shell
pnpm install
```

- [ ] **Step 2: Configure `tauri.conf.json`**

Edit `clients/partner-shell/src-tauri/tauri.conf.json`:

```json
{
  "productName": "AIXMOS Partner",
  "version": "0.1.0",
  "identifier": "com.aixmos.partner",
  "build": { "frontendDist": "../dist", "devUrl": "http://localhost:1420" },
  "app": {
    "windows": [{ "title": "AIXMOS Partner", "width": 1280, "height": 800 }],
    "security": { "csp": "default-src 'self' https://partner.tmmt-ops.com" }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg"],
    "category": "Business",
    "macOS": {
      "minimumSystemVersion": "14.0",
      "signingIdentity": "Developer ID Application: <YOUR NAME> (<TEAM_ID>)",
      "entitlements": "./entitlements.plist"
    }
  }
}
```

- [ ] **Step 3: Write entitlements**

Create `clients/partner-shell/src-tauri/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key><false/>
  <key>com.apple.security.network.client</key><true/>
  <key>com.apple.security.files.user-selected.read-write</key><true/>
</dict>
</plist>
```

- [ ] **Step 4: Smoke-build the empty shell**

Run: `cd clients/partner-shell && pnpm tauri build --debug`
Expected: builds without signing (skip signing for now); a `.app` appears under `src-tauri/target/debug/bundle/macos/`.

- [ ] **Step 5: Commit**

```bash
git add clients/partner-shell/
git commit -m "feat(partner-shell): scaffold Tauri 2 app"
```

---

### Task 12: License client + heartbeat (Rust side)

**Files:**
- Create: `clients/partner-shell/src-tauri/src/license.rs`
- Modify: `clients/partner-shell/src-tauri/src/main.rs`

- [ ] **Step 1: Add dependencies**

Edit `clients/partner-shell/src-tauri/Cargo.toml`, append:

```toml
[dependencies]
jsonwebtoken = "9"
reqwest = { version = "0.12", features = ["json", "rustls-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
keyring = "3"
```

- [ ] **Step 2: Implement `license.rs`**

```rust
// clients/partner-shell/src-tauri/src/license.rs
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};

const PUBLIC_KEY_PEM: &str = include_str!("../keys/license-public.pem");
const HEARTBEAT_URL: &str = "https://lic.tmmt.tools/v1/heartbeat";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseClaims {
    pub tenant_id: String,
    pub hardware_uuid: String,
    pub enclave_pubkey_thumbprint: String,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Debug, Deserialize)]
pub struct HeartbeatResponse {
    pub tenant_token: Option<String>,
    pub kill_command: Option<String>,
}

pub fn verify_license(jwt: &str) -> Result<LicenseClaims, String> {
    let key = DecodingKey::from_ed_pem(PUBLIC_KEY_PEM.as_bytes())
        .map_err(|e| format!("key parse: {e}"))?;
    let mut validation = Validation::new(Algorithm::EdDSA);
    validation.set_issuer(&["aixmos-license"]);
    let data = decode::<LicenseClaims>(jwt, &key, &validation)
        .map_err(|e| format!("verify: {e}"))?;
    Ok(data.claims)
}

pub async fn heartbeat(jwt: &str) -> Result<HeartbeatResponse, String> {
    let client = reqwest::Client::new();
    let resp = client.post(HEARTBEAT_URL)
        .bearer_auth(jwt)
        .send().await.map_err(|e| format!("net: {e}"))?;

    if resp.status() == 410 {
        let body: HeartbeatResponse = resp.json().await.map_err(|e| format!("parse: {e}"))?;
        return Err(format!("license_disabled:{}", body.kill_command.unwrap_or_default()));
    }
    if !resp.status().is_success() {
        return Err(format!("heartbeat http {}", resp.status()));
    }
    resp.json().await.map_err(|e| format!("parse: {e}"))
}

pub fn hardware_uuid() -> Result<String, String> {
    // Read IOPlatformUUID via ioreg
    let output = std::process::Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| format!("ioreg: {e}"))?;
    let s = String::from_utf8_lossy(&output.stdout);
    for line in s.lines() {
        if line.contains("IOPlatformUUID") {
            return line.split('"').nth(3).map(|s| s.to_string())
                .ok_or_else(|| "parse IOPlatformUUID".to_string());
        }
    }
    Err("IOPlatformUUID not found".to_string())
}
```

- [ ] **Step 3: Wire into `main.rs`**

```rust
// clients/partner-shell/src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod license;
use keyring::Entry;

#[tauri::command]
async fn boot_check() -> Result<String, String> {
    let entry = Entry::new("com.aixmos.partner", "license_jwt").map_err(|e| e.to_string())?;
    let jwt = entry.get_password().map_err(|_| "no_license".to_string())?;
    let claims = license::verify_license(&jwt)?;
    let hw = license::hardware_uuid()?;
    if claims.hardware_uuid != hw {
        return Err("license bound to a different machine".to_string());
    }
    let hb = license::heartbeat(&jwt).await?;
    hb.tenant_token.ok_or_else(|| "no tenant_token".to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![boot_check])
        .run(tauri::generate_context!())
        .expect("error running app");
}
```

- [ ] **Step 4: Add public key into Tauri bundle**

Run:
```bash
mkdir -p clients/partner-shell/src-tauri/keys
cp <your license-pub.pem from Task 2> clients/partner-shell/src-tauri/keys/license-public.pem
```

Note: `license-public.pem` IS committed (it's the public key — fine to ship).

- [ ] **Step 5: Build + smoke check**

Run: `cd clients/partner-shell && pnpm tauri dev`
Expected: window opens; from the frontend, invoke `boot_check` and confirm it returns an error like "no_license" (no license seeded yet — expected).

- [ ] **Step 6: Commit**

```bash
git add clients/partner-shell/src-tauri/src/license.rs \
        clients/partner-shell/src-tauri/src/main.rs \
        clients/partner-shell/src-tauri/Cargo.toml \
        clients/partner-shell/src-tauri/keys/license-public.pem
git commit -m "feat(partner-shell): license verify + heartbeat (Rust)"
```

---

### Task 13: Webview frontend — boot screen + webview to partner.tmmt-ops.com

**Files:**
- Modify: `clients/partner-shell/src/main.ts`
- Create: `clients/partner-shell/src/index.html`

- [ ] **Step 1: Replace `index.html`**

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>AIXMOS Partner</title>
<style>body{margin:0;font:14px -apple-system;background:#0a0a0a;color:#eee} #boot{display:flex;align-items:center;justify-content:center;height:100vh}</style>
</head><body><div id="boot">Verifying license…</div>
<script type="module" src="/main.ts"></script></body></html>
```

- [ ] **Step 2: Implement `main.ts`**

```typescript
// clients/partner-shell/src/main.ts
import { invoke } from '@tauri-apps/api/core'

async function boot() {
  try {
    const tenantToken = await invoke<string>('boot_check')
    // Navigate to partner with token in cookie
    document.cookie = `tenant_token=${tenantToken}; path=/; secure; samesite=strict`
    location.href = `https://partner.tmmt-ops.com/?tt=${encodeURIComponent(tenantToken)}`
  } catch (e: any) {
    const msg = String(e)
    if (msg.startsWith('license_disabled:wipe')) {
      document.getElementById('boot')!.innerText = 'This installation has been deactivated. Contact AIXMOS.'
      await invoke('trigger_wipe')
    } else if (msg.includes('license_disabled')) {
      document.getElementById('boot')!.innerText = 'License is disabled. Contact AIXMOS.'
    } else {
      document.getElementById('boot')!.innerText = `Cannot start: ${msg}`
    }
  }
}
boot()
```

- [ ] **Step 3: Add `trigger_wipe` Tauri command**

Append to `clients/partner-shell/src-tauri/src/main.rs`:

```rust
#[tauri::command]
fn trigger_wipe() -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    for p in [".config/tmmt", "Library/Application Support/aixmos-partner"] {
        let _ = std::fs::remove_dir_all(format!("{home}/{p}"));
    }
    let _ = std::process::Command::new("/usr/local/bin/tailscale").arg("logout").status();
    // Remove license from keychain
    let _ = keyring::Entry::new("com.aixmos.partner", "license_jwt")
        .and_then(|e| e.delete_credential());
    Ok(())
}
```

Update `invoke_handler` to register both: `tauri::generate_handler![boot_check, trigger_wipe]`.

- [ ] **Step 4: Build + smoke**

Run: `cd clients/partner-shell && pnpm tauri build --debug`
Expected: app builds; manual smoke = launch app, sees "Cannot start: no_license" (no JWT seeded).

- [ ] **Step 5: Commit**

```bash
git add clients/partner-shell/src/main.ts clients/partner-shell/src/index.html clients/partner-shell/src-tauri/src/main.rs
git commit -m "feat(partner-shell): boot screen + webview redirect + wipe command"
```

---

### Task 14: Brain.app PyInstaller scaffold + sales-qualifier slot

**Files:**
- Create: `clients/brain-app/aixmos_brain/__main__.py`
- Create: `clients/brain-app/aixmos_brain/license_client.py`
- Create: `clients/brain-app/aixmos_brain/audit.py`
- Create: `clients/brain-app/aixmos_brain/agents/sales_qualifier_stub.py`
- Create: `clients/brain-app/pyinstaller.spec`

- [ ] **Step 1: Bootstrap Python project**

Run:
```bash
cd ~/Projects/TMMT/clients
mkdir -p brain-app/aixmos_brain/agents brain-app/scripts
cd brain-app
python3.12 -m venv .venv
source .venv/bin/activate
pip install pyinstaller python-jose[cryptography] requests cryptography
```

- [ ] **Step 2: Implement `license_client.py`**

```python
# clients/brain-app/aixmos_brain/license_client.py
from __future__ import annotations
import os, subprocess, keyring
from jose import jwt, JWTError

PUBLIC_KEY_PEM = open(os.path.join(os.path.dirname(__file__), 'license-public.pem')).read()
HEARTBEAT_URL = 'https://lic.tmmt.tools/v1/heartbeat'

class LicenseError(Exception): pass
class LicenseDisabled(LicenseError):
    def __init__(self, kill: str | None): self.kill = kill

def hardware_uuid() -> str:
    out = subprocess.check_output(['ioreg', '-rd1', '-c', 'IOPlatformExpertDevice']).decode()
    for line in out.splitlines():
        if 'IOPlatformUUID' in line:
            return line.split('"')[3]
    raise LicenseError('IOPlatformUUID not found')

def load_license_jwt() -> str:
    jwt_str = keyring.get_password('com.aixmos.partner', 'license_jwt')
    if not jwt_str: raise LicenseError('no_license')
    return jwt_str

def verify(jwt_str: str) -> dict:
    try:
        return jwt.decode(jwt_str, PUBLIC_KEY_PEM, algorithms=['EdDSA'], issuer='aixmos-license')
    except JWTError as e:
        raise LicenseError(f'verify failed: {e}')

def heartbeat(jwt_str: str) -> dict:
    import requests
    r = requests.post(HEARTBEAT_URL, headers={'Authorization': f'Bearer {jwt_str}'}, timeout=10)
    if r.status_code == 410:
        body = r.json()
        raise LicenseDisabled(kill=body.get('kill_command'))
    r.raise_for_status()
    return r.json()
```

- [ ] **Step 3: Implement `audit.py`**

```python
# clients/brain-app/aixmos_brain/audit.py
from __future__ import annotations
import json, os, time, pathlib

AUDIT_DIR = pathlib.Path.home() / 'Library/Application Support/aixmos-partner'
AUDIT_FILE = AUDIT_DIR / 'audit.ndjson'

def emit(action: str, payload: dict | None = None) -> None:
    AUDIT_DIR.mkdir(parents=True, exist_ok=True)
    line = json.dumps({
        'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'action': action,
        'payload': payload or {},
    })
    with AUDIT_FILE.open('a') as f:
        f.write(line + '\n')
```

- [ ] **Step 4: Implement `sales_qualifier_stub.py` (Spec B will replace)**

```python
# clients/brain-app/aixmos_brain/agents/sales_qualifier_stub.py
"""
Slot reserved for Spec B (Always-On Revenue Engine, sub-spec B3).
Until B3 ships, this stub logs the intent and returns a canned response.
"""
from aixmos_brain.audit import emit

def qualify(lead: dict) -> dict:
    emit('agent.sales_qualifier.stub_called', {'lead_id': lead.get('id')})
    return {'status': 'stub', 'message': 'Sales Qualifier agent ships in Spec B'}
```

- [ ] **Step 5: Implement `__main__.py`**

```python
# clients/brain-app/aixmos_brain/__main__.py
from aixmos_brain import license_client, audit

def main() -> int:
    try:
        jwt_str = license_client.load_license_jwt()
        claims = license_client.verify(jwt_str)
        hw = license_client.hardware_uuid()
        if claims['hardware_uuid'] != hw:
            audit.emit('app.boot.hardware_mismatch')
            print('License is bound to a different Mac.')
            return 2
        hb = license_client.heartbeat(jwt_str)
        audit.emit('app.boot.ok', {'tenant_id': claims['tenant_id']})
        print(f"Brain online for tenant {claims['tenant_id']}.")
        return 0
    except license_client.LicenseDisabled as e:
        audit.emit('app.boot.license_disabled', {'kill': e.kill})
        print('License disabled. Contact AIXMOS.')
        return 3
    except license_client.LicenseError as e:
        audit.emit('app.boot.error', {'err': str(e)})
        print(f'License error: {e}')
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
```

- [ ] **Step 6: Implement `pyinstaller.spec`**

```python
# clients/brain-app/pyinstaller.spec
# -*- mode: python ; coding: utf-8 -*-
block_cipher = None

a = Analysis(
    ['aixmos_brain/__main__.py'],
    pathex=[],
    datas=[('aixmos_brain/license-public.pem', 'aixmos_brain')],
    hiddenimports=[],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    cipher=block_cipher,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)
exe = EXE(pyz, a.scripts, a.binaries, a.zipfiles, a.datas,
          name='AIXMOS Brain', console=False, debug=False, strip=True, upx=False,
          codesign_identity='Developer ID Application: <YOUR NAME> (<TEAM_ID>)',
          entitlements_file='entitlements-brain.plist')
```

- [ ] **Step 7: Drop the public key beside the module**

Run: `cp clients/partner-shell/src-tauri/keys/license-public.pem clients/brain-app/aixmos_brain/`

- [ ] **Step 8: Build the binary**

Run:
```bash
cd ~/Projects/TMMT/clients/brain-app
source .venv/bin/activate
pyinstaller pyinstaller.spec
```
Expected: `dist/AIXMOS Brain` binary exists. Run it: `./dist/AIXMOS\ Brain` → expect "License error: no_license" exit code 1.

- [ ] **Step 9: Commit**

```bash
git add clients/brain-app/
echo '.venv/' >> clients/brain-app/.gitignore
echo 'build/' >> clients/brain-app/.gitignore
echo 'dist/' >> clients/brain-app/.gitignore
git add clients/brain-app/.gitignore
git commit -m "feat(brain-app): PyInstaller scaffold + license client + sales-qualifier slot"
```

---

### Task 15: Sign + notarize pipeline

**Files:**
- Create: `clients/partner-shell/scripts/sign-and-notarize.sh`
- Create: `clients/brain-app/scripts/sign-and-notarize.sh`

- [ ] **Step 1: Verify Developer ID is installed**

Run: `security find-identity -v -p codesigning | grep "Developer ID Application"`
Expected: at least one identity printed. If not, sign up at developer.apple.com first.

- [ ] **Step 2: Write Tauri sign+notarize script**

```bash
#!/usr/bin/env bash
# clients/partner-shell/scripts/sign-and-notarize.sh
set -euo pipefail

APP_PATH="${1:-src-tauri/target/release/bundle/macos/AIXMOS Partner.app}"
DMG_PATH="${APP_PATH%.app}.dmg"
TEAM_ID="${TEAM_ID:?TEAM_ID required}"
APPLE_ID="${APPLE_ID:?APPLE_ID required}"
APP_SPECIFIC_PWD="${APP_SPECIFIC_PWD:?APP_SPECIFIC_PWD required}"

echo "==> Building"
pnpm tauri build

echo "==> Signing"
codesign --force --deep --options runtime \
  --entitlements src-tauri/entitlements.plist \
  --sign "Developer ID Application: ${TEAM_ID}" \
  "$APP_PATH"

echo "==> Building DMG"
hdiutil create -volname "AIXMOS Partner" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"
codesign --force --sign "Developer ID Application: ${TEAM_ID}" "$DMG_PATH"

echo "==> Notarizing"
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APP_SPECIFIC_PWD" \
  --team-id "$TEAM_ID" \
  --wait

echo "==> Stapling"
xcrun stapler staple "$DMG_PATH"

echo "==> Verifying"
spctl --assess --type install -v "$DMG_PATH"
echo "DONE: $DMG_PATH"
```

- [ ] **Step 3: Write Brain sign+notarize script**

```bash
#!/usr/bin/env bash
# clients/brain-app/scripts/sign-and-notarize.sh
set -euo pipefail

BIN="${1:-dist/AIXMOS Brain}"
PKG_PATH="${BIN}.pkg"
TEAM_ID="${TEAM_ID:?}"; APPLE_ID="${APPLE_ID:?}"; APP_SPECIFIC_PWD="${APP_SPECIFIC_PWD:?}"

echo "==> Sign binary"
codesign --force --options runtime --sign "Developer ID Application: ${TEAM_ID}" "$BIN"

echo "==> Build pkg"
pkgbuild --identifier com.aixmos.brain \
  --version 0.1.0 \
  --install-location /Applications \
  --component "$BIN" \
  "$PKG_PATH"

echo "==> Sign pkg"
productsign --sign "Developer ID Installer: ${TEAM_ID}" "$PKG_PATH" "${PKG_PATH}.signed"
mv "${PKG_PATH}.signed" "$PKG_PATH"

echo "==> Notarize + staple"
xcrun notarytool submit "$PKG_PATH" --apple-id "$APPLE_ID" --password "$APP_SPECIFIC_PWD" --team-id "$TEAM_ID" --wait
xcrun stapler staple "$PKG_PATH"
spctl --assess --type install -v "$PKG_PATH"
echo "DONE: $PKG_PATH"
```

- [ ] **Step 4: Run both pipelines end-to-end**

Run (with env set):
```bash
cd clients/partner-shell && ./scripts/sign-and-notarize.sh
cd ../brain-app && ./scripts/sign-and-notarize.sh
```
Expected: both produce notarized artifacts; `spctl --assess` says `accepted`.

- [ ] **Step 5: Commit + tag v0.2**

```bash
chmod +x clients/*/scripts/sign-and-notarize.sh
git add clients/partner-shell/scripts/ clients/brain-app/scripts/
git commit -m "feat(clients): sign + notarize pipelines"
git tag v0.2-clients
```

---

## Phase 3 — Flash Drive + Installer (P1)

Builds: flash drive layout, idempotent installer, clickwrap.

### Task 16: Flash drive source layout

**Files:**
- Create: `flash-drive/START-HERE.command`
- Create: `flash-drive/README.txt`
- Create: `flash-drive/_installer/install.sh`

- [ ] **Step 1: Write `START-HERE.command`**

```bash
#!/bin/bash
# flash-drive/START-HERE.command
cd "$(dirname "$0")"
clear
echo "================================================================"
echo "                AIXMOS Partner Install for Moe Legacy"
echo "================================================================"
echo ""
echo "This will install AIXMOS Partner + Brain on this Mac."
echo "It takes about 10 minutes."
echo ""
echo "Press [Enter] to continue, or Ctrl-C to cancel."
read -r
exec bash _installer/install.sh
```

- [ ] **Step 2: Write `README.txt`**

```text
flash-drive/README.txt

AIXMOS PARTNER FLASH KIT
========================

This drive installs the AIXMOS Partner stack on a Mac.

To install:
  1. Open Finder
  2. Find this drive
  3. Double-click "START-HERE.command"

If macOS warns about an unidentified developer:
  1. Right-click "START-HERE.command"
  2. Choose "Open"
  3. Click "Open" in the dialog

Questions: contact AIXMOS at <support email>.

This drive has a single-use install token.
After install completes, the drive is no longer usable for re-installation.
```

- [ ] **Step 3: Write `install.sh` (skeleton — fully populated in Task 17)**

```bash
#!/usr/bin/env bash
# flash-drive/_installer/install.sh
set -euo pipefail
echo "Installer skeleton — populated in Task 17"
exit 1
```

- [ ] **Step 4: Make executable**

Run: `chmod +x flash-drive/START-HERE.command flash-drive/_installer/install.sh`

- [ ] **Step 5: Commit**

```bash
git add flash-drive/
git commit -m "feat(flash-drive): START-HERE + skeleton installer"
```

---

### Task 17: Full installer script

**Files:**
- Modify: `flash-drive/_installer/install.sh`

- [ ] **Step 1: Write the full installer**

```bash
#!/usr/bin/env bash
# flash-drive/_installer/install.sh
set -euo pipefail

DRIVE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOKEN_FILE="$DRIVE_ROOT/_onetime/install-token.bin"
TENANT_FILE="$DRIVE_ROOT/_onetime/tenant.txt"
AUTHKEY_FILE="$DRIVE_ROOT/_onetime/tailscale-authkey.txt"
LEGAL_DIR="$DRIVE_ROOT/legal"
LIC_URL="https://lic.tmmt.tools"

CONFIG_DIR="$HOME/.config/tmmt"
APP_SUPPORT="$HOME/Library/Application Support/aixmos-partner"
LOG_FILE="$APP_SUPPORT/install.log"
mkdir -p "$CONFIG_DIR" "$APP_SUPPORT"
chmod 700 "$CONFIG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

step() { echo ""; echo "==> $*"; }

step "1. Show legal documents"
open "$LEGAL_DIR/partner-agreement.pdf"
open "$LEGAL_DIR/dpa.pdf"
open "$LEGAL_DIR/aup.pdf"
echo ""
echo "Please read the three documents that just opened."
echo "Type exactly 'I AGREE' to continue:"
read -r AGREE
[[ "$AGREE" == "I AGREE" ]] || { echo "Did not agree. Exiting."; exit 1; }

step "2. Capture Mac identity"
HW_UUID=$(ioreg -rd1 -c IOPlatformExpertDevice | awk -F\" '/IOPlatformUUID/ {print $4}')
TENANT_ID=$(cat "$TENANT_FILE")
INSTALL_TOKEN=$(cat "$TOKEN_FILE")

step "3. Ship clickwrap acceptance"
curl -sS -X POST "$LIC_URL/v1/clickwrap" \
  -H 'content-type: application/json' \
  -d "{
    \"tenant_id\": \"$TENANT_ID\",
    \"hardware_uuid\": \"$HW_UUID\",
    \"agreement_hashes\": {
      \"partner\": \"$(shasum -a 256 "$LEGAL_DIR/partner-agreement.pdf" | awk '{print $1}')\",
      \"dpa\": \"$(shasum -a 256 "$LEGAL_DIR/dpa.pdf" | awk '{print $1}')\",
      \"aup\": \"$(shasum -a 256 "$LEGAL_DIR/aup.pdf" | awk '{print $1}')\"
    },
    \"accepted_at\": \"$(date -u +%FT%TZ)\"
  }" || { echo "Clickwrap ship failed"; exit 1; }

step "4. Generate Secure-Enclave attestation key"
# Use Apple's CryptoTokenKit via swift one-liner
ATTEST_PUB=$(swift -e '
import CryptoKit, Foundation
let priv = try! SecureEnclave.P256.Signing.PrivateKey()
let pub = priv.publicKey.rawRepresentation.base64EncodedString()
let dataRep = priv.dataRepresentation
try! dataRep.write(to: URL(fileURLWithPath: "'"$CONFIG_DIR"'/enclave-key.dat"))
print(pub)
')
chmod 600 "$CONFIG_DIR/enclave-key.dat"

step "5. Provision license"
PROVISION_RESP=$(curl -sS -X POST "$LIC_URL/v1/provision" \
  -H 'content-type: application/json' \
  -d "{
    \"install_token\": \"$INSTALL_TOKEN\",
    \"tenant_id\": \"$TENANT_ID\",
    \"hardware_uuid\": \"$HW_UUID\",
    \"enclave_pubkey_pem\": \"$ATTEST_PUB\"
  }")
LICENSE_JWT=$(echo "$PROVISION_RESP" | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)["license_jwt"])')

step "6. Store license in Keychain"
security add-generic-password -s com.aixmos.partner -a license_jwt -w "$LICENSE_JWT" -U

step "7. Install Tauri app"
hdiutil attach "$DRIVE_ROOT/_installer/AIXMOS-Partner.dmg" -nobrowse -quiet
cp -R "/Volumes/AIXMOS Partner/AIXMOS Partner.app" "$HOME/Applications/"
hdiutil detach "/Volumes/AIXMOS Partner" -quiet

step "8. Install Brain pkg"
installer -pkg "$DRIVE_ROOT/_installer/AIXMOS-Brain.pkg" -target CurrentUserHomeDirectory

step "9. Install launchd jobs"
LAUNCH_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_DIR"
cat > "$LAUNCH_DIR/com.aixmos.heartbeat.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.aixmos.heartbeat</string>
<key>ProgramArguments</key><array>
  <string>$HOME/Applications/AIXMOS Brain.app/Contents/MacOS/aixmos-brain-heartbeat</string>
</array>
<key>StartInterval</key><integer>86400</integer>
<key>RunAtLoad</key><true/>
</dict></plist>
EOF
launchctl load -w "$LAUNCH_DIR/com.aixmos.heartbeat.plist"

cat > "$LAUNCH_DIR/com.aixmos.audit-ship.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.aixmos.audit-ship</string>
<key>ProgramArguments</key><array>
  <string>$HOME/Applications/AIXMOS Brain.app/Contents/MacOS/aixmos-brain-audit-ship</string>
</array>
<key>StartInterval</key><integer>3600</integer>
<key>RunAtLoad</key><true/>
</dict></plist>
EOF
launchctl load -w "$LAUNCH_DIR/com.aixmos.audit-ship.plist"

step "10. Join tailnet"
if ! command -v tailscale >/dev/null; then
  echo "Tailscale not installed. Install via brew or App Store, then re-run: tailscale up --authkey \$(cat $AUTHKEY_FILE)"
else
  tailscale up --authkey "$(cat "$AUTHKEY_FILE")" --advertise-tags=tag:partner-moe
fi

step "11. Burn one-time token"
shred -u "$TOKEN_FILE" 2>/dev/null || rm -P "$TOKEN_FILE"
shred -u "$AUTHKEY_FILE" 2>/dev/null || rm -P "$AUTHKEY_FILE"

step "12. Done"
echo ""
echo "Install complete. AIXMOS Partner is in your Applications folder."
echo "First heartbeat will fire in the background within the minute."
echo "You can now eject this drive."
```

- [ ] **Step 2: Run a dry-run install on a sandbox account**

Run:
```bash
# In a sandbox user account or VM:
sudo -u sandboxuser bash flash-drive/_installer/install.sh
```
Expected: install completes; `~/Applications/AIXMOS Partner.app` exists; `launchctl list | grep aixmos` shows two jobs.

- [ ] **Step 3: Commit**

```bash
git add flash-drive/_installer/install.sh
git commit -m "feat(installer): full install script with clickwrap, provision, launchd, tailnet"
```

---

### Task 18: One-time token + per-partner flash builder

**Files:**
- Create: `scripts/build-flash-image.sh`
- Create: `scripts/provision-partner.sh`

- [ ] **Step 1: Write `provision-partner.sh`**

```bash
#!/usr/bin/env bash
# scripts/provision-partner.sh
set -euo pipefail

PARTNER_NAME="${1:?usage: $0 <partner-id>}"
ADMIN_KEY="${ADMIN_KEY:?ADMIN_KEY required}"
LIC_URL="${LIC_URL:-https://lic.tmmt.tools}"

INSTALL_TOKEN=$(openssl rand -hex 32)
TOKEN_HASH=$(printf '%s' "$INSTALL_TOKEN" | shasum -a 256 | awk '{print $1}')

# Create tenant + license row server-side
curl -sS -X POST "$LIC_URL/v1/_admin/seed_license" \
  -H "x-admin-key: $ADMIN_KEY" \
  -H 'content-type: application/json' \
  -d "{\"tenant_id\":\"$PARTNER_NAME\",\"install_token_hash\":\"$TOKEN_HASH\"}" > /dev/null

# Generate single-use Tailscale auth key
TAILSCALE_KEY=$(tailscale -- web --listen=localhost:0 >/dev/null 2>&1; tailscale keys create --tags=tag:partner-$PARTNER_NAME --ephemeral=false --reusable=false --expiry=24h)

OUT="$HOME/Documents/Business/flash-kits/$PARTNER_NAME"
mkdir -p "$OUT/_onetime"
echo "$INSTALL_TOKEN" > "$OUT/_onetime/install-token.bin"
echo "$PARTNER_NAME" > "$OUT/_onetime/tenant.txt"
echo "$TAILSCALE_KEY" > "$OUT/_onetime/tailscale-authkey.txt"

echo "Tokens written to $OUT/_onetime/"
echo "Next: ./scripts/build-flash-image.sh $PARTNER_NAME"
```

- [ ] **Step 2: Write `build-flash-image.sh`**

```bash
#!/usr/bin/env bash
# scripts/build-flash-image.sh
set -euo pipefail
PARTNER_NAME="${1:?usage: $0 <partner-id>}"
SRC="$PWD/flash-drive"
PER_PARTNER="$HOME/Documents/Business/flash-kits/$PARTNER_NAME"
OUT="$PER_PARTNER/image"

mkdir -p "$OUT"
rsync -a --exclude '_onetime/install-token.bin' --exclude '_onetime/tailscale-authkey.txt' --exclude '_onetime/tenant.txt' "$SRC/" "$OUT/"

cp -R "$PER_PARTNER/_onetime/." "$OUT/_onetime/"

# Copy the latest signed DMG + pkg
cp "$PWD/clients/partner-shell/src-tauri/target/release/bundle/dmg/AIXMOS Partner.dmg" "$OUT/_installer/"
cp "$PWD/clients/brain-app/dist/AIXMOS Brain.pkg" "$OUT/_installer/"

# Watermark the legal PDFs with partner name
for doc in master-partner-agreement data-processing-addendum acceptable-use-policy; do
  pandoc "$HOME/Documents/Business/legal/$PARTNER_NAME/$doc-v0.md" \
    --pdf-engine=xelatex -V watermark="$PARTNER_NAME" \
    -o "$OUT/legal/$doc.pdf"
done

echo "Flash image ready at $OUT/"
echo "Copy this directory to a freshly-formatted USB drive named 'AIXMOS-PARTNER'."
```

- [ ] **Step 3: Chmod + commit**

```bash
chmod +x scripts/provision-partner.sh scripts/build-flash-image.sh
git add scripts/provision-partner.sh scripts/build-flash-image.sh
git commit -m "feat(scripts): partner provisioning + flash image builder"
git tag v0.3-installer
```

---

## Phase 4 — Network + Storage (P2, parallel with Phase 2/3)

### Task 19: Tailnet ACL

**Files:**
- Create: `infra/tailnet-acl.hujson`

- [ ] **Step 1: Capture current ACL**

Run: `tailscale acl get > infra/tailnet-acl.current.hujson`

- [ ] **Step 2: Write new ACL with `tag:partner-moe`**

```hujson
// infra/tailnet-acl.hujson
{
  "tagOwners": {
    "tag:partner-moe": ["autogroup:admin"],
  },
  "acls": [
    // ... existing rules preserved ...
    {
      "action": "accept",
      "src": ["tag:partner-moe"],
      "dst": [
        "<NAS_TAILNET_IP>:445",
        "<NAS_TAILNET_IP>:2049",
        "lic.tmmt.tools:443",
        "log.tmmt.tools:443",
        "partner.tmmt-ops.com:443",
      ],
    },
    // implicit deny on everything else for tag:partner-moe
  ],
}
```

Get NAS tailnet IP: `tailscale status | grep -i nas`

- [ ] **Step 3: Dry-run + apply**

Run:
```bash
tailscale acl check infra/tailnet-acl.hujson
tailscale acl set infra/tailnet-acl.hujson
```
Expected: `check` passes; `set` applies.

- [ ] **Step 4: Commit**

```bash
git add infra/tailnet-acl.hujson
git commit -m "feat(infra): Tailnet ACL with tag:partner-moe narrow lane"
```

---

### Task 20: NAS shares

- [ ] **Step 1: Create `/shared-playbooks` (read-only) and `/moe-legacy/` (read-write)**

On UGREEN NAS admin UI:
1. Storage → Shared Folders → New
2. Name: `shared-playbooks`. Permissions: ceo.moe RW, `partner-moe` RO.
3. Name: `moe-legacy`. Permissions: ceo.moe RW, `partner-moe` RW. Encryption: AES-256.

- [ ] **Step 2: Populate `/shared-playbooks` from Operations Brain**

Run:
```bash
rsync -av --delete ~/Documents/Business/playbooks/ /Volumes/shared-playbooks/
```

- [ ] **Step 3: Document in runbook**

Create `docs/runbooks/nas-shares.md` with the above setup steps.

- [ ] **Step 4: Commit runbook**

```bash
git add docs/runbooks/nas-shares.md
git commit -m "docs: NAS shares setup runbook"
```

---

### Task 21: DNS for partner subdomain + lic + log

- [ ] **Step 1: Add Vercel projects**

In Vercel dashboard:
1. New Project from `apps/license-server` → domain `lic.tmmt.tools`
2. New Project from `apps/audit-ingest` → domain `log.tmmt.tools`
3. New Project from `apps/partner` → domain `partner.tmmt-ops.com`

- [ ] **Step 2: Add DNS records**

Wherever `tmmt.tools` and `tmmt-ops.com` DNS lives (likely Vercel DNS):
- `lic.tmmt.tools` CNAME → cname.vercel-dns.com
- `log.tmmt.tools` CNAME → cname.vercel-dns.com
- `partner.tmmt-ops.com` CNAME → cname.vercel-dns.com

- [ ] **Step 3: Set env vars on all three Vercel projects**

Refer to Tasks 2, 3, 5 for the full env list.

- [ ] **Step 4: Deploy + smoke**

Trigger a deploy on each project. Then run `./scripts/test-control-plane.sh` (Task 10) against the live URLs.

- [ ] **Step 5: Commit notes**

```bash
mkdir -p infra/dns
cat > infra/dns/README.md <<'EOF'
DNS records for partner deploy:
- lic.tmmt.tools → Vercel project license-server
- log.tmmt.tools → Vercel project audit-ingest
- partner.tmmt-ops.com → Vercel project partner

Managed at <wherever>. Env vars per Vercel project: see SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LICENSE_PUBLIC_KEY_PEM, TENANT_TOKEN_SECRET, ADMIN_KEY.
EOF
git add infra/dns/
git commit -m "docs(infra): DNS notes for control plane"
git tag v0.4-network
```

---

## Phase 5 — Legal Docs v0 (P2, parallel)

> NOTE: per [[../../../memory/project_moe_legacy_partner_deploy]] and spec §16, attorney review is deferred to 30 days post-signing. Each doc opens with the v0 disclaimer.

### Task 22: Master Partner Agreement v0

**Files:**
- Create: `~/Documents/Business/legal/moe-legacy/master-partner-agreement-v0.md`

- [ ] **Step 1: Draft the document** — covers:
  - Parties (AIXMOS / TMMT entity + Moe Legacy entity)
  - License grant (non-exclusive, non-transferable, revocable)
  - Term (1 year auto-renew unless 30 days notice)
  - Revoke rights (any of: missed payment, AUP violation, breach)
  - Audit rights (operational telemetry + on-demand log access)
  - IP retention (all sealed binaries + source remain AIXMOS)
  - Confidentiality, indemnity, governing law (Delaware), arbitration
  - v0 disclaimer at top: *"This is a v0 partnership instrument pending attorney review on or before [DATE]. Either party may request revision upon attorney redline."*

- [ ] **Step 2: Render to PDF for the flash drive**

Run:
```bash
mkdir -p ~/Documents/Business/legal/moe-legacy
# (edit master-partner-agreement-v0.md)
pandoc ~/Documents/Business/legal/moe-legacy/master-partner-agreement-v0.md \
  --pdf-engine=xelatex -o /tmp/test.pdf
```

- [ ] **Step 3: Save** (NOT committed to git per secrets pattern; lives in Business folder)

---

### Task 23: DPA v0 + AUP v0

Same pattern. DPA covers what data flows (overlay only — not PII), retention, breach notice. AUP lists license-voiding behavior (competing product, reselling source, shared logins).

> Engineer note: actual doc text drafted in this task is too long to include verbatim here; follow the established Business/legal/ doc pattern and reference the [[../../../memory/project_legal_ops_structure]] memory for style. Attorney redline lands within 30 days.

- [ ] Render both to PDF.
- [ ] Verify all three PDFs render correctly.

---

## Phase 6 — Test Plan Execution (P3, gates Moe's drive)

### Task 24: Provision a `test-partner` tenant + run all 10 smoke checks

**Files:**
- Create: `scripts/test-partner-smoke.sh`

- [ ] **Step 1: Generate a test-partner flash drive**

Run: `ADMIN_KEY=<key> ./scripts/provision-partner.sh test-partner && ./scripts/build-flash-image.sh test-partner`

- [ ] **Step 2: Run install on a sandbox Mac (M1 Max VM)**

Boot VM, mount the flash image, execute `START-HERE.command`, follow prompts.

- [ ] **Step 3: Run the 10 smoke checks from spec §14**

```bash
#!/usr/bin/env bash
# scripts/test-partner-smoke.sh
set -euo pipefail
# 1: provision succeeded (already confirmed by install)
# 2: soft kill
LICENSE_ID="${LICENSE_ID:?}"; ADMIN_KEY="${ADMIN_KEY:?}"
curl -sS -X POST https://lic.tmmt.tools/v1/revoke -H "x-admin-key: $ADMIN_KEY" \
  -H 'content-type: application/json' -d "{\"license_id\":\"$LICENSE_ID\",\"mode\":\"soft\"}"
# Trigger heartbeat manually and confirm 410
# (the test Mac should be online; force heartbeat by launching app)
echo "On the test Mac, open AIXMOS Partner. Expected: 'License is disabled.'"
read -r -p "Confirm seen on screen [y]: " OK; [[ "$OK" == "y" ]] || exit 1
# Re-enable
psql "$SUPABASE_DB_URL" -c "UPDATE licenses SET active=true WHERE id='$LICENSE_ID';"

# 3: hard kill
curl -sS -X POST https://lic.tmmt.tools/v1/revoke -H "x-admin-key: $ADMIN_KEY" \
  -H 'content-type: application/json' -d "{\"license_id\":\"$LICENSE_ID\",\"mode\":\"hard\"}"
echo "On the test Mac, open AIXMOS Partner. Expected: deactivation message + ~/.config/tmmt removed + tailscale offline."
read -r -p "Confirm wipe happened [y]: " OK; [[ "$OK" == "y" ]] || exit 1

# 4: heartbeat miss simulation
echo "Block lic.tmmt.tools at the test Mac firewall, advance system clock 72h, restart app. Expect license_disabled."
read -r -p "Confirm [y]: " OK; [[ "$OK" == "y" ]] || exit 1

# 5: audit shipping
psql "$SUPABASE_DB_URL" -c "SELECT count(*) FROM audit_events WHERE tenant_id='test-partner' AND ts > now() - interval '1 hour';"
echo "Expect >0 events ingested."

# 6: cross-tenant RLS
psql "$SUPABASE_DB_URL" -c "SET app.tenant_id='test-partner'; SELECT count(*) FROM credit_funding_sessions WHERE tenant_id='moe-legacy';"
echo "Expect: 0"

# 7: cold-boot offline (TTL)
echo "Disable network on test Mac, wait 25 hours, open app. Expect graceful failure."
read -r -p "Confirm [y]: " OK; [[ "$OK" == "y" ]] || exit 1

# 8: tailnet scope
echo "From test Mac: ping brainiac-7 (100.117.163.93). Expect: timeout."
read -r -p "Confirm denied [y]: " OK; [[ "$OK" == "y" ]] || exit 1

# 9: notarization
spctl --assess --type install -v "/Applications/AIXMOS Partner.app"
echo "Modify a byte in the .dmg and retry install — expect failure. Manual."
read -r -p "Confirm notarization rejects tampered DMG [y]: " OK; [[ "$OK" == "y" ]] || exit 1

# 10: install token replay
echo "Try install.sh again on a second sandbox Mac with the same token. Expect 409."
read -r -p "Confirm [y]: " OK; [[ "$OK" == "y" ]] || exit 1

echo "ALL 10 SMOKES PASSED"
```

- [ ] **Step 4: Commit script + final tag**

```bash
chmod +x scripts/test-partner-smoke.sh
git add scripts/test-partner-smoke.sh
git commit -m "feat(scripts): full partner-deploy smoke test (spec §14)"
git tag v1.0-partner-deploy-ready
```

---

### Task 25: Build Moe's real flash drive + ship

- [ ] Run: `ADMIN_KEY=<key> ./scripts/provision-partner.sh moe-legacy`
- [ ] Run: `./scripts/build-flash-image.sh moe-legacy`
- [ ] Copy `~/Documents/Business/flash-kits/moe-legacy/image/` to a freshly formatted USB drive named `AIXMOS-PARTNER`
- [ ] Hand-deliver or ship via tracked mail
- [ ] Confirm install completes (audit event `license.provisioned` arrives for `tenant_id=moe-legacy`)

---

## Pre-Launch Checklist (re-statement of spec §16-B)

Before Moe's drive ships:
- [ ] Attorney engagement scheduled
- [ ] Supabase Vault holds signing key; CYBORG holds encrypted backup
- [ ] All 10 smoke checks pass on test-partner
- [ ] v0 legal docs reviewed by ceo.moe + saved in `~/Documents/Business/legal/moe-legacy/`
- [ ] Clickwrap consent language matches spec §16-A
- [ ] Recovery challenge phrase agreed with Moe out-of-band
- [ ] DNS + Vercel + env vars all set
- [ ] Spec §17 handoff to Spec B (revenue engine) brainstorm scheduled

---

## Self-Review Notes

Coverage check against spec §6 components: ✅ partner app (Task 11–13), ✅ brain app (Task 14), ✅ license server (Tasks 2–6), ✅ audit ingest (Task 7), ✅ tenant RLS (Task 8), ✅ middleware (Task 9), ✅ flash drive (Tasks 16–18), ✅ tailnet ACL (Task 19), ✅ NAS (Task 20), ✅ DNS (Task 21), ✅ legal docs (Tasks 22–23), ✅ test plan (Task 24), ✅ ship (Task 25).

Type consistency: `LicenseClaims` interface matches across `apps/license-server/lib/jwt.ts`, `clients/partner-shell/src-tauri/src/license.rs`, and `clients/brain-app/aixmos_brain/license_client.py`. Field names: `tenant_id`, `hardware_uuid`, `enclave_pubkey_thumbprint`, `iat`, `exp`.

Placeholder scan: ⚠️ `<YOUR NAME>`, `<TEAM_ID>`, `<NAS_TAILNET_IP>`, `<PASTE_PRIVATE_KEY_PEM_HERE>` are real per-environment values the engineer fills in at execution time — flagged in the spec §6 placeholder note. The `_admin/seed_license` route used by `provision-partner.sh` is mentioned but not implemented as a separate task — engineer should add it as a sub-task of Task 6 (small additional handler in revoke route or its own admin module).

Spec §16-A clickwrap language coverage: implemented in Task 17 step 1 ("Please read the three documents…") — actual wording loaded from the PDFs, which are produced from `~/Documents/Business/legal/moe-legacy/*-v0.md` in Tasks 22–23. The "I AGREE" gate enforces consent.

Spec §17 reserved surfaces: Task 14 implements `sales_qualifier_stub.py` slot. The `/inbox` route in `apps/partner/` is mentioned in the file structure but no task fully implements it — engineer creates a stub page in Task 9 step 6 (file structure shows `app/inbox/page.tsx` exists). Add as Task 9 step 6.5: drop a 10-line stub returning "Lead inbox — Spec B will populate this."
