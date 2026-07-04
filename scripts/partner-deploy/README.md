# Partner Deploy — v1

White-label partner install for the AIXMOS stack. Designed against the Moe Legacy deploy spec at `docs/superpowers/specs/2026-06-09-moe-legacy-partner-deploy-design.md`. Built on **owner-protection-first** invariants.

## What this is

A flash-drive provisioning system that:

1. Drops the AIXMOS Partner stack onto a partner's Mac (white-labeled, tenant-scoped)
2. Pins it to their hardware (Apple Silicon UUID + Secure Enclave attestation)
3. Wires four-tier kill-switch infrastructure (soft / hard / heartbeat / audit)
4. Keeps **all signing keys + revocation control on owner-side infra** (Supabase Vault + CYBORG backup)
5. Records radically-transparent clickwrap consent (§16-A of spec, verbatim)
6. Documents a clean recovery path if the partner's Mac is lost or stolen

## Owner-protection invariants (these are NOT optional)

1. **License signing key never leaves owner infra.** Lives in Supabase Vault. Partner's Mac gets a signed JWT, not the key.
2. **Partner can never disable the kill-switch agent.** Owned by root (or admin in v1 without root), monitored by separate watchdog.
3. **Every partner-side action audits BEFORE it executes** wherever possible. Audit-first pattern. Append to `audit.ndjson`, hourly ship.
4. **Install token is one-shot.** Replay must fail. Enforced at the Supabase `partner_install_tokens.used_at IS NOT NULL` gate.
5. **Owner can wipe partner install at any time** with one command (`owner/kill-partner.sh --tier=hard`).
6. **Tailscale ACL is narrowed to `tag:partner-<name>`.** Partner sees NAS + license + log + partner subdomain. Nothing else.
7. **Source code never on partner disk.** Apps are sealed (v1 stub — see "Stub vs hardened" below). Cloud apps run server-side on Vercel.
8. **Cross-tenant RLS is enforced at the DB layer.** Partner cannot see another tenant's rows, even with a stolen service-role key (v1 limitation noted).

## Partner-protection invariants (these are also not optional)

1. **Clickwrap consent shows EXACTLY what is transmitted** (§16-A verbatim). No hidden telemetry.
2. **No screen recording, no client data, no other apps.** This is enforced by what we don't ship — there is no screen-capture binary on the partner's Mac.
3. **Disable does NOT delete partner's client data.** Partner's PII lives in his own GHL + ClickUp accounts which we do not touch. Wipe removes our app, not his data.
4. **Audit log is shippable to partner on request.** They have a right to know what was logged.
5. **Recovery via out-of-band challenge phrase** so an attacker with stolen hardware can't impersonate.
6. **Self-service uninstall path documented.** Partner can opt out of the partnership at any time and we'll help them clean up.

## Directory layout

```
partner-deploy/
├── README.md                  # this file
├── owner/                     # scripts ceo.moe runs FROM HIS OWN MAC
│   ├── verify-readiness.sh    # pre-flight before flashing partner's USB
│   ├── issue-license.sh       # mint license + one-time install token for a partner
│   ├── kill-partner.sh        # 4-tier kill switch (soft / hard / heartbeat-test / audit-only)
│   ├── recovery-flow.sh       # 7-step new-Mac flow from spec §16-#5
│   └── audit-readout.sh       # pull last N hours of partner audit events
├── partner-payload/           # files that get dropped on PARTNER's Mac at install
│   ├── attestation.py         # Apple Silicon UUID + Secure Enclave key generation
│   ├── kill-switch-agent.py   # local agent: polls license, executes wipe/disable directives
│   ├── heartbeat.py           # 24h heartbeat to Supabase
│   ├── audit-shipper.py       # hourly upload of audit.ndjson to Supabase
│   └── launchd/
│       ├── tools.aixmos.partner.killswitch.plist  # runs every 15 min
│       ├── tools.aixmos.partner.heartbeat.plist   # runs every 24h
│       └── tools.aixmos.partner.audit.plist       # runs every hour
├── consent/
│   └── clickwrap.html         # §16-A consent UI rendered at install time
├── sql/
│   └── 20260609_partner_tenancy.sql   # migration: partner_licenses + heartbeats + audit + install_tokens + RLS
├── tests/
│   └── dry-run.sh             # runs full install on tenant='test-partner' against owner's own Mac
├── provision-partner.sh       # main installer — runs ON PARTNER'S MAC from USB
└── START-HERE.command         # double-click entry point on the USB
```

## Stub vs hardened (be honest about this)

**HARDENED — actually works today:**

- Hardware UUID + Secure Enclave key generation (uses macOS native APIs)
- Tailscale install + tag assignment (real)
- Clickwrap consent capture + PDF email
- Supabase row-poll kill-switch (real — uses existing project `uapxakmlwnpfsftfeezx`)
- Heartbeat to Supabase (real)
- Audit ship to Supabase (real)
- launchd plist install + load (real)
- One-time install token enforcement (real — DB-backed)
- Cross-tenant RLS (real, enforced by the migration in `sql/`)
- Owner-side kill switch (real — one command flips the row)

**v1 STUB — must be replaced before Moe Legacy plug-in day:**

- **`lic.tmmt.tools` / `log.tmmt.tools` / `partner.tmmt-ops.com` subdomains.** v1 talks to Supabase directly via the public anon endpoint. These subdomains MUST be provisioned in production (§16-B checklist).
- **Sealed PyInstaller binaries.** v1 ships .py source. v2 replaces with signed .pkg per spec §11. Until v2: Moe's Mac has the agent source in `/usr/local/aixmos/`, mode 0700, owner=root. Not "sealed" but not browseable either.
- **Apple-notarized Tauri shell.** v1 ships a `.webloc` shortcut to `https://tmmt-ops.vercel.app/partner?t=moe-legacy`. v2 replaces with notarized DMG per spec §7. Until v2: partner uses browser; UX is functional but not the full desktop-app experience.
- **License JWT signing.** v1 uses Supabase row state as the source of truth (no JWT yet). v2 introduces signed JWTs once the signing infra ships per §16-#2.
- **Prompt streaming from NAS.** v1 reads prompts from the Vercel app at runtime. v2 routes through NAS over Tailscale per §11.

Anything stub-marked above will FAIL the `owner/verify-readiness.sh` pre-flight in `--strict` mode. Don't ship Moe's USB until pre-flight passes in strict mode.

## Usage (owner-side, in order)

```bash
# 1. Pre-flight check before flashing Moe's drive
./owner/verify-readiness.sh --partner=moe-legacy --strict

# 2. Apply the tenancy migration to Supabase (one-time, idempotent)
psql "$SUPABASE_DB_URL" -f sql/20260609_partner_tenancy.sql

# 3. Issue Moe's license + install token
./owner/issue-license.sh \
  --partner=moe-legacy \
  --partner-email="partner@example.com" \
  --challenge-phrase="$(openssl rand -hex 6)"
# Outputs: install token (one-time), license row ID, challenge phrase to share OOB

# 4. Burn the USB drive (manual; see TODO in verify-readiness)
#    Drop these files onto /Volumes/AIXMOS-PARTNER/:
#    - START-HERE.command
#    - provision-partner.sh
#    - partner-payload/ (whole tree)
#    - consent/clickwrap.html
#    - .install-token (from step 3)
#    - .partner-config (tenant_id, partner name, etc.)

# 5. Ship USB to Moe. Moe runs START-HERE.command. Provisioning runs.

# 6. Confirm install worked (heartbeat appears in Supabase)
./owner/audit-readout.sh --partner=moe-legacy --last=1h
```

## Kill-switch usage (owner-side)

```bash
# Soft kill (license disable, next heartbeat returns 410)
./owner/kill-partner.sh --partner=moe-legacy --tier=soft

# Hard kill (wipe + revoke + rotate)
./owner/kill-partner.sh --partner=moe-legacy --tier=hard --confirm="MOE LEGACY"

# Roll back soft kill
./owner/kill-partner.sh --partner=moe-legacy --tier=restore
```

Hard kill is irreversible (requires a new flash drive to reinstall). Soft kill flips one row and is reversible by reverting.

## Test before Moe (REQUIRED)

```bash
# Full test suite (spec §14, all 10 cases)
./tests/dry-run.sh
```

This provisions `tenant='test-partner'` on the current Mac, exercises the four kill tiers, and verifies cross-tenant RLS. Run on ceo.moe's M1 Max or a spare Mac. **All 10 must pass before Moe's USB ships.**

## Recovery (when Moe's Mac dies)

```bash
./owner/recovery-flow.sh --partner=moe-legacy
```

Walks the 7-step flow from spec §16-#5: verify identity via challenge phrase + last 4 of contract phone → revoke old license → reissue → ship new USB → audit log shows both Mac UUIDs.

## What this script CANNOT do (matters for the spec gate)

- **Apply the Supabase migration.** You must run `psql -f sql/...` yourself. Migration is in this repo, but applying it is a deliberate owner-side action (see [[project_supabase_migration_drift]]).
- **Sign / notarize DMG or PyInstaller pkg.** Requires Apple Developer ID. Not in this v1.
- **Provision Vercel subdomains.** Manual DNS + Vercel domain config. v1 uses the existing `tmmt-ops.vercel.app` host.
- **Configure Tailscale `tag:partner-moe` ACL.** Manual one-time config in the Tailscale admin console. v1 documents the JSON; you paste it.
- **Send the attorney email** (separate workstream — see `~/Documents/Business/legal/moe-legacy/`).

## Cross-references

- Design spec: `docs/superpowers/specs/2026-06-09-moe-legacy-partner-deploy-design.md`
- Attorney workstream: `~/Documents/Business/legal/moe-legacy/`
- Memory: `~/.claude/projects/-Users-ceo-moe/memory/project_moe_legacy_partner_deploy.md`
- Secrets pattern: `~/.config/tmmt/<svc>.env` per `feedback_secrets_outside_repo`
- Existing partner-test scaffold: `scripts/create-partner-test-user.mjs`
