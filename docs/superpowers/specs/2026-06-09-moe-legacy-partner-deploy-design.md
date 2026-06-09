# Moe Legacy Partner Deploy — Design Spec

- **Date:** 2026-06-09
- **Author:** ceo.moe (AIXMOS537)
- **Status:** Draft, awaiting user review before plan phase
- **Partner:** Moe Legacy (first exclusive partner deploy)
- **Target machine:** Moe's M5 MacBook Pro (his only computer, daily driver)

## 1. Problem Statement

Moe Legacy is the first exclusive-partnership deploy of the full AIXMOS / TMMT stack onto a non-internal machine. Today:

- The stack lives across ceo.moe's M5 (carry), M1 Max (work), BRAINIAC-7 (Windows hub), CYBORG USB drives, UGREEN NAS, and four Vercel apps.
- Everything we've built — TMMT-Ops, Mission Control, Credit/Funding Engine, AIXMOS agents, Operations Brain, playbooks — is currently designed for internal use.
- Moe needs all of it as his daily working environment because he has no other workstation.
- We must protect the IP (sealed binaries, no source on his disk), maintain a remote kill-switch in case the partnership sours, and make it repeatable for future partners.
- Moe stores his existing client data in GHL and ClickUp forms — those remain his system of record. Our stack adds an automation/brain overlay, not a database replacement.

## 2. Goals

1. Flash-drive install: plug in → ~10 minutes → working environment, no manual sysadmin.
2. Moe runs as both an **operator on shared clients** AND a **reseller with his own clients** (dual-tenant mode on one Mac).
3. All four kill-switch tiers in place (soft / hard / heartbeat / audit) — defense in depth.
4. Source code never on Moe's disk; sealed binaries only.
5. Narrow tailnet ACL — no lateral access to BRAINIAC, ceo.moe's Macs, iPhone, or other partner nodes.
6. Repeatable: partner #2, partner #3 should be a ~10-minute provisioning script, not a bespoke build.
7. Comply with [feedback_middleman_only.md](../../../memory/feedback_middleman_only.md) — Moe is a reseller/affiliate, no operating-business obligation on our side.
8. Comply with [feedback_secrets_outside_repo.md](../../../memory/feedback_secrets_outside_repo.md) — his keys live in `~/.config/tmmt/*.env` (mode 600), never in the repo or app bundle.

## 3. Non-Goals

- Mobile/iOS deploy for Moe (out of scope for v1; he uses his Mac all day).
- Migrating Moe's existing GHL or ClickUp data into Supabase (he keeps his system of record; we only overlay).
- Offline-first operation — internet is assumed (Mac he uses all day); we degrade gracefully through brief disconnects but do NOT silently bypass license check.
- Open-source distribution of the partner kit — flash-drive-only, one-time install token, no public download.
- Building an entirely new operating business on Moe's side — middleman/reseller posture only.

## 4. Constraints (from brainstorming)

| Decision | Choice |
|---|---|
| Moe's role | Dual: operator on shared clients + reseller with his own |
| Kill-switch | All four (soft, hard, heartbeat, audit) |
| Tailnet/NAS scope | Narrow lane: NAS read-only on `/shared-playbooks` + read-write on `/moe-legacy/` + `lic.tmmt.tools` + `log.tmmt.tools` + `partner.tmmt-ops.com` only |
| IP visibility | Sealed binaries; source stays on Vercel/NAS |
| Data tenancy | Moe's PII stays in his GHL + ClickUp (his existing source of truth). Supabase overlay holds only audit logs, agent run metadata, credit-funding session state — scoped by `tenant_id='moe-legacy'` via RLS |

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  MOE'S M5 MACBOOK PRO                                       │
│                                                             │
│  ~/Applications/                                            │
│   ├─ AIXMOS Partner.app    (Tauri shell, notarized)         │
│   └─ AIXMOS Brain.app      (PyInstaller agents, sealed)     │
│                                                             │
│  ~/Library/Application Support/aixmos-partner/              │
│   ├─ license.jwt           (HW-pinned: SoC UUID + Enclave) │
│   ├─ cache.db              (encrypted SQLite, prompts TTL)  │
│   └─ audit.ndjson          (rolling, shipped hourly)        │
│                                                             │
│  macOS Keychain                                             │
│   └─ aixmos.license-key    (secure-enclave-backed)          │
│                                                             │
│  ~/.config/tmmt/                                            │
│   ├─ moe-legacy.env        (his GHL+ClickUp+Slack, mode 600)│
│   └─ tailscale-up.command  (one-tap join, tag:partner-moe)  │
│                                                             │
│  Launchd (always-on):                                       │
│   com.aixmos.heartbeat     (24h → lic.tmmt.tools)           │
│   com.aixmos.audit-ship    (1h  → log.tmmt.tools)           │
│   com.aixmos.killswitch    (on signal: wipe + revoke)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Tailscale (tag:partner-moe)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  CONTROL PLANE (ceo.moe owned)                              │
│                                                             │
│  Vercel:   partner.tmmt-ops.com   (tenant=moe-legacy gate)  │
│  Vercel:   lic.tmmt.tools         (heartbeat + revoke API)  │
│  Vercel:   log.tmmt.tools         (audit ingest, append-only)│
│  Supabase: uapxakmlwnpfsftfeezx   (tenant_id RLS everywhere)│
│  NAS:      /shared-playbooks (RO) + /moe-legacy/ (RW)        │
└─────────────────────────────────────────────────────────────┘
```

## 6. Components

| Component | Location | Responsibility | Owner |
|---|---|---|---|
| AIXMOS Partner.app | Moe's Mac, sealed | Tauri webview shell → `partner.tmmt-ops.com` with HW-signed tenant JWT in Authorization header | ceo.moe |
| AIXMOS Brain.app | Moe's Mac, sealed | PyInstaller-bundled agents; loads prompts from `lic.tmmt.tools` on session start, caches encrypted in `cache.db` with 24h TTL | ceo.moe |
| Partner web app | Vercel `partner.tmmt-ops.com` | Multi-tenant TMMT-Ops / Mission Control / Credit-Funding intake; middleware enforces tenant JWT on every request | ceo.moe |
| License server | Vercel `lic.tmmt.tools` | Issues HW-pinned JWTs at install (`/v1/provision`), heartbeats (`/v1/heartbeat`), enforces revoke decisions | ceo.moe |
| Audit ingest | Vercel `log.tmmt.tools` | NDJSON append-only endpoint; writes to Supabase `audit_events` table | ceo.moe |
| Supabase RLS | Existing project `uapxakmlwnpfsftfeezx` | `tenant_id` column on every overlay table; RLS policies deny cross-tenant reads | ceo.moe |
| NAS shares | UGREEN NAS | `/shared-playbooks` (read-only mount) + `/moe-legacy/` (Moe's working space) | ceo.moe |
| Tailnet ACL | ceo.moe's tailnet | `tag:partner-moe` allowed: NAS + lic + log + partner only. Everything else implicit deny | ceo.moe |
| Flash drive | Physical USB | One-time install bundle; token burns after first use | ceo.moe |
| Legal acceptance | Clickwrap on install | Partner agreement + DPA acceptance; record shipped to `log.tmmt.tools` with Mac UUID + timestamp + IP | ceo.moe (legal review pending) |

## 7. Flash Drive Layout

`/Volumes/AIXMOS-PARTNER/`
```
├─ START-HERE.command            ← Moe double-clicks this
├─ legal/
│   ├─ partner-agreement.pdf     (watermarked at install with his Mac UUID)
│   └─ dpa.pdf                   (data processing addendum)
├─ _installer/
│   ├─ install.sh                (idempotent, runs as Moe, no sudo)
│   ├─ AIXMOS-Partner.dmg        (signed + Apple-notarized Tauri shell)
│   ├─ AIXMOS-Brain.pkg          (signed PyInstaller bundle)
│   └─ tailscale-authkey.txt     (single-use, expires 24h, tag:partner-moe)
├─ _onetime/
│   └─ install-token.bin         (HMAC, valid for ONE install)
└─ README.txt
```

## 8. Install Sequence

1. Moe plugs the flash drive and runs `START-HERE.command`.
2. Clickwrap shows partnership agreement + DPA. Must type "I AGREE" → acceptance ships to `log.tmmt.tools` (Mac UUID + timestamp + IP + agreement hash).
3. Installer calls `lic.tmmt.tools/v1/provision` with the one-time HMAC token + Apple Silicon hardware UUID + a Secure-Enclave-generated device-attestation key.
4. Server issues a HW-pinned license JWT, marks the install token consumed, registers `tenant=moe-legacy` if first-time, opens Tailscale ACL for this node, returns DMG/pkg verification hashes.
5. Installer verifies hashes, drops apps in `~/Applications`, writes `~/Library/Application Support/aixmos-partner/`, stages launchd plists, joins tailnet, mounts NAS shares.
6. First heartbeat fires immediately to confirm round-trip; first app launch warm.
7. Flash drive's one-time token is now burned; the drive is inert.

## 9. Boot Sequence (every app cold-start)

1. Moe opens AIXMOS Partner.app.
2. App reads `~/Library/.../license.jwt` → verifies HW pin (Apple Silicon hardware UUID + Secure-Enclave-stored attestation key match this device).
3. App calls `lic.tmmt.tools/v1/heartbeat` with HMAC-signed body containing license ID, app version, action counters since last heartbeat.
4. Server checks: license active? tenant not flagged for kill? last heartbeat within 72h?
5. Server returns 200 + fresh tenant token (15-min TTL) OR 410 Gone (kill signal) OR 451 (legal hold).
6. On 200: Tauri webview loads `partner.tmmt-ops.com` with `Authorization: Bearer <tenant-token>`.
7. Every page load: Next.js middleware re-validates tenant token, sets Supabase RLS header `app.tenant_id = 'moe-legacy'`.
8. Every action: appended to local `audit.ndjson`. Hourly launchd job ships file to `log.tmmt.tools`.

## 10. Kill-Switch Design (defense in depth)

| Tier | Trigger | Effect | Time to take effect | Reversible |
|---|---|---|---|---|
| **Soft kill** | Flip `licenses.active=false` row in Supabase | Next heartbeat returns 410 → apps refuse to start, Vercel middleware 401s every request | ≤ 24h (next heartbeat) | Yes — flip back to true |
| **Hard kill** | Set `licenses.kill_command='wipe'` | Heartbeat returns wipe directive → launchd job removes `~/.config/tmmt`, `~/Library/.../aixmos-partner/`, Keychain entries, runs `tailscale logout`. Server-side: rotate tenant JWT signing secret, revoke Tailscale node key, invalidate Supabase RLS by mass-rotating tenant-scoped service role | ≤ 24h | No — requires a new flash drive |
| **Heartbeat miss** | No heartbeat call for 72h | Auto-disable license (same effect as soft kill) | 72h | Yes if Moe reconnects |
| **Audit always-on** | N/A — always | Every install/login/agent-call/data-export/credit-funding-session lands in Supabase `audit_events`. Mac UUID, tenant ID, IP, action, timestamp | Live | N/A — paper trail for legal |

### Why all four (not just one)

- **Soft alone** is easy to bypass if Moe controls his network (block heartbeat → no 410 ever arrives → apps keep working). Heartbeat-miss catches that.
- **Hard alone** is irreversible — too aggressive for "minor disagreement, want to pause and talk."
- **Heartbeat alone** has a 72h gap.
- **Audit alone** gives no operational control, only a paper trail.

The combination: 90% of disputes resolve at soft-kill tier; serious cases escalate to hard kill; heartbeat catches sandbagging; audit is the legal backstop.

## 11. IP Protection

- **Source never leaves Vercel.** The TMMT-Ops, Mission Control, and Credit-Funding apps run server-side. Moe's Tauri shell is a small notarized webview (~5–15 MB; exact size set during build).
- **Agents sealed.** PyInstaller binary, `.pyc` only, prompts loaded at runtime from signed API → encrypted local cache → wiped on kill.
- **Playbooks (Operations Brain etc.) streamed from NAS** via Tailscale-only mount. Read through the app, no portable copy unless explicitly exported. Exports are watermarked with tenant ID + timestamp + audit log entry.
- **DMG + pkg Apple-notarized + signed with ceo.moe's Developer ID.** Tampering breaks the signature; macOS refuses to launch.
- **One-time install token** means the flash drive can't be cloned and reused on a second Mac.
- **Hardware pinning** (Apple Silicon hardware UUID + Secure-Enclave-bound key in the license JWT) means even if the license file is copied to another Mac, it won't validate — the Enclave key cannot leave the original device.
- **Sealed ≠ unbreakable.** A determined reverse-engineer with weeks could extract the agent binaries. The mitigation is: extracted binaries are useless without a valid license (which we control), and the audit log creates the paper trail for a contract claim.

## 12. Tailnet ACL

```jsonc
{
  "tagOwners": { "tag:partner-moe": ["autogroup:admin"] },
  "acls": [
    {
      "action": "accept",
      "src": ["tag:partner-moe"],
      "dst": [
        "<NAS_TAILNET_IP>:445",           // NAS SMB — fill at impl time
        "<NAS_TAILNET_IP>:2049",          // NAS NFS (if used)
        "lic.tmmt.tools:443",
        "log.tmmt.tools:443",
        "partner.tmmt-ops.com:443"
      ]
    }
    // implicit deny on everything else
  ]
}
```

> Placeholder note: `<NAS_TAILNET_IP>` is filled in during implementation from `tailscale status` on the NAS node. Not a TODO — a deliberate variable.

Moe's M5 cannot reach BRAINIAC-7, ceo.moe's M5/M1 Macs, iPhone171, or any other desktop/partner node.

## 13. Data Tenancy

- Moe's existing client PII stays in HIS GHL and ClickUp instances (his system of record).
- His GHL + ClickUp API keys live in `~/.config/tmmt/moe-legacy.env` (mode 600) per [feedback_secrets_outside_repo.md](../../../memory/feedback_secrets_outside_repo.md).
- Our Supabase project stores only **overlay data**: audit logs, agent run metadata, credit-funding session state, workflow checkpoints. All overlay tables get a `tenant_id` column and RLS policy:

```sql
-- Example overlay table policy
CREATE POLICY tenant_isolation ON credit_funding_sessions
  USING (tenant_id = current_setting('app.tenant_id', true)::text);

REVOKE ALL ON credit_funding_sessions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON credit_funding_sessions TO authenticated;
```

(Note: per [feedback_revoke_from_public_not_anon.md](../../../memory/feedback_revoke_from_public_not_anon.md), revoke from PUBLIC not anon.)

- DPA Moe signs at install acknowledges this overlay arrangement.

## 14. Test Plan (before Moe's plug-in day)

Run on a `tenant=test-partner` provisioned on a spare Mac (M1 Max VM or spare USB-bootable kit).

1. Full install from a duplicate flash drive — clickwrap → provision → install → first heartbeat. Confirm all steps complete cleanly.
2. **Soft kill:** flip `licenses.active=false`. Confirm apps return 401 within next heartbeat window (≤24h, accelerate by manually triggering heartbeat).
3. **Hard kill:** set `licenses.kill_command='wipe'`. Confirm `~/.config/tmmt` removed, Tailscale offline, Supabase RLS denies all queries from this Mac UUID.
4. **Heartbeat miss:** block `lic.tmmt.tools` at firewall, advance clock 72h. Confirm auto-disable.
5. **Audit ship:** trigger 10 distinct actions (login, agent call, NAS read, credit-funding intake, etc.). Confirm 10 NDJSON lines arrive in Supabase `audit_events` within 1h.
6. **Cross-tenant RLS:** log in as `tenant=test-partner`, attempt to read `tenant_id='moe-legacy'` rows directly via Supabase client. Expect zero rows.
7. **Cold-boot offline:** disable network. Cached prompts work for ≤24h, then refuse. NEVER silently bypass license check.
8. **Tailnet scope:** from `tag:partner-moe` node, attempt to reach BRAINIAC-7 (`100.117.163.93`), ceo.moe's Mac, iPhone. All should fail with connection refused.
9. **DMG verification:** modify the .dmg byte, attempt install. Notarization check must fail.
10. **Install token replay:** complete install, then attempt to reuse the same one-time token on a second machine. Server must reject.

All ten pass → build Moe's real flash drive.

## 15. Repeatability (partners #2, #3, ...)

After v1 ships, onboarding a new partner is:

```sh
./scripts/provision-partner.sh \
  --name "next-partner" \
  --hardware-uuid <theirs> \
  --enclave-attestation <theirs> \
  --ghl-instance <their-ghl-id>
```

The script:
1. Creates `tenants` row.
2. Generates HW-pinned license JWT.
3. Adds `tag:partner-<name>` ACL entry.
4. Provisions NAS share `/<name>/` with appropriate ACLs.
5. Generates fresh flash drive image with a new one-time install token.
6. Signs + notarizes the per-partner DMG (the only per-partner build artifact — apps are tenant-scoped at runtime, not at compile time).

Time per partner after v1: ~10 minutes of scripted work + Apple notarization wait (~5 min).

## 16. Open Questions

1. **Legal review of partner agreement + DPA.** Reuse Michael Bibbs $30K deal template ([project_michael_bibbs_30k_deal.md](../../../memory/project_michael_bibbs_30k_deal.md))? Or fresh draft? Both flagged attorney items still apply.
2. **License JWT signing key location.** Currently planned for `~/.config/tmmt/license-signing.key` (mode 600) on ceo.moe's M5. Should this move to a hosted KMS (e.g. Supabase Vault) for survivability if M5 is lost/stolen?
3. **Heartbeat endpoint scaling.** v1 carries one partner. At 10 partners with 24h heartbeat, fine. At 100, may need rate limiting + queue. Out of scope for v1.
4. **What does Moe think his Mac is doing?** UX of the clickwrap matters — needs to be clear about heartbeat + audit so he's not surprised later. Draft consent language in legal review.
5. **Recovery path if Moe's Mac dies and we rebuild.** New flash drive + new HW pin? Or a documented "rebuild" workflow where ceo.moe issues a one-time recovery token? v1: new flash drive.

## 17. Memory References

This spec depends on / supersedes / cites:
- [feedback_middleman_only.md](../../../memory/feedback_middleman_only.md) — middleman-only growth model
- [feedback_secrets_outside_repo.md](../../../memory/feedback_secrets_outside_repo.md) — `~/.config/tmmt/*.env` pattern
- [feedback_revoke_from_public_not_anon.md](../../../memory/feedback_revoke_from_public_not_anon.md) — RLS hardening pattern
- [feedback_credential_rotation_pattern.md](../../../memory/feedback_credential_rotation_pattern.md) — credential rotation flow
- [project_aixmos_starter_pack.md](../../../memory/project_aixmos_starter_pack.md) — base flash-drive pattern this extends
- [project_cyborg_dual_mode_vault.md](../../../memory/project_cyborg_dual_mode_vault.md) — dual-mode USB pattern (owner-side / partner-side)
- [project_plug_and_play_bot_install_2026_06_05.md](../../../memory/project_plug_and_play_bot_install_2026_06_05.md) — earlier plug-and-play installer pattern
- [project_tmmt_os_app.md](../../../memory/project_tmmt_os_app.md) — TMMT app stack (target of partner.tmmt-ops.com subdomain)
- [project_aixmos_agents.md](../../../memory/project_aixmos_agents.md) — agent stack to ship as sealed binaries
- [project_phase_9_credit_funding.md](../../../memory/project_phase_9_credit_funding.md) — Credit/Funding Engine to include in partner deploy
