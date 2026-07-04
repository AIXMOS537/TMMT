# CURSOR-RUN — Master Scaffold (2026-06-10)

**Single runbook. 18 numbered steps. Three workstreams interleaved by dependency.**

Pass this file (or its individual steps) to Cursor. Each step is self-contained:
who runs it, what to do, how to verify, what to do if it fails.

## Legend

- 🟢 **DONE** — already complete; do not re-run
- 🟡 **READY** — no blockers; can start now
- 🔴 **BLOCKED** — waiting on a prior step

## Workstreams (interleaved below by execution order)

- **A. Moe ship path** — get the partner USB to Moe Legacy with kill switch live
- **B. MPA polish** — apply VISION+WONDER_WOMAN feedback to v0 docs
- **C. Hermes agent upgrade** — unlock tool calling on local Ollama stack

## Current state at start of run

| Surface | State | Owner |
|---|---|---|
| Partner-deploy scripts | 27 files, all syntax-clean | DONE |
| v0 legal docs (MPA/DPA/AUP) | Drafted, no-lawyer path locked | DONE |
| Hermes bridge v1 | Built, tested with 3B (1 tool call parsed) | DONE |
| `~/.config/tmmt/partner-deploy.env` | Exists, mode 600, **placeholder keys** | TODO #1 |
| Supabase migration | Not applied | TODO #2 |
| `tools.json` (57 skills) | Built at hermes-bridge/tools.json | DONE |
| BRAINIAC-7 PC | Offline 13h+ | external |

---

## STEP 1 — Fix Supabase keys in env file 🟡 READY

**Workstream:** A
**Who:** YOU (touches real secrets)
**Time:** 60 seconds

The current `~/.config/tmmt/partner-deploy.env` has the placeholder string
`<paste from Supabase project Settings → API → service_role>` where the actual
key should be. That's why every prior curl returned 401 "Invalid API key."

```bash
# 1. Open Supabase Studio in browser
open https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx/settings/api

# 2. Copy the `service_role` `secret` (starts with eyJhbGci, ~200+ chars)
# 3. Copy the `anon` `public` key (also starts with eyJhbGci, ~200+ chars)
# 4. Edit the env file
$EDITOR ~/.config/tmmt/partner-deploy.env
# Replace the two <paste from ...> placeholders with the real keys.
```

**Verify:**
```bash
source ~/.config/tmmt/partner-deploy.env
[[ ${#SUPABASE_SERVICE_ROLE_KEY} -gt 100 ]] && echo PASS || echo FAIL
curl -sS -o /tmp/t -w "HTTP %{http_code}\n" \
  "$SUPABASE_URL/rest/v1/" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
# Expect: HTTP 200, not 401
```

**On fail:** Wrong key (probably anon vs service_role, or whitespace). Re-copy from Studio.

---

## STEP 2 — Reconcile migration drift before applying 🔴 BLOCKED by #1

**Workstream:** A
**Who:** ME (Claude) — run after #1 passes
**Time:** 5 min

Per `[[project_supabase_migration_drift]]` — **never blind-replay**.

```bash
# Get list of currently-applied migrations from prod
source ~/.config/tmmt/partner-deploy.env
psql "$SUPABASE_URL" -c "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 20;" 2>/dev/null \
  || echo "(direct psql may not work without DB_URL; use Supabase Studio SQL editor)"
```

Then compare against `~/Projects/TMMT/scripts/partner-deploy/sql/20260609_partner_tenancy.sql`.

**Verify:** No tables named `partner_tenants`, `partner_licenses`, etc. already exist with different shape.

**On fail:** Schema drift — STOP and reconcile before applying. Tell me what's different and I'll patch the migration.

---

## STEP 3 — Apply the partner-tenancy migration 🔴 BLOCKED by #2

**Workstream:** A
**Who:** YOU (run via Supabase Studio SQL editor — safer than psql for this)
**Time:** 2 min

```bash
# Easiest path:
# 1. Open Supabase Studio SQL editor
open https://supabase.com/dashboard/project/uapxakmlwnpfsftfeezx/sql/new

# 2. Paste the contents of:
cat ~/Projects/TMMT/scripts/partner-deploy/sql/20260609_partner_tenancy.sql | pbcopy

# 3. In Studio, paste + click Run
```

**Verify:**
```bash
source ~/.config/tmmt/partner-deploy.env
curl -sS -o /dev/null -w "partner_tenants: HTTP %{http_code}\n" \
  "$SUPABASE_URL/rest/v1/partner_tenants?select=tenant_id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
# Expect: HTTP 200 (empty array is fine)
```

**On fail:** Look at the Studio error. Most likely: a referenced extension is missing (pgcrypto) or RLS already on a same-named table.

---

## STEP 4 — Run the dry-run test 🔴 BLOCKED by #3

**Workstream:** A
**Who:** YOU (one command)
**Time:** 1 min

```bash
~/Projects/TMMT/scripts/partner-deploy/tests/dry-run.sh
```

**Verify:** Output ends with `ALL AUTOMATED TESTS PASSED  (6 pass, 0 fail)`.

**On fail:** Capture the failing test name (e.g. "§14-#6: cross-tenant RLS") and tell me. Probably an RLS policy doesn't match.

---

## STEP 5 — Issue Moe Legacy's license + install token 🔴 BLOCKED by #4

**Workstream:** A
**Who:** YOU (one command)
**Time:** 2 min

```bash
PHRASE="$(openssl rand -hex 6)"
~/Projects/TMMT/scripts/partner-deploy/owner/issue-license.sh \
  --partner=moe-legacy \
  --partner-name="Moe Legacy" \
  --partner-email="<moe's real email here>" \
  --challenge-phrase="$PHRASE"
echo
echo "RECOVERY PHRASE (read to Moe on the phone, NEVER text/email): $PHRASE"
```

**Verify:**
```bash
ls -la ~/Projects/TMMT/scripts/partner-deploy/_issued/moe-legacy/
# Expect: install-token.txt, partner-config.env, RECOVERY-PHRASE.txt (all mode 600)
```

**On fail:** Most likely email param missing or curl failed. Re-run with the missing field.

---

## STEP 6 — Apply MPA edits from VISION+WONDER_WOMAN review 🟢 DONE

**Workstream:** B
**Who:** ME — already applied 2026-06-10

Changes made:
1. Section 2 (Definitions) now includes a `"Material Breach"` definition with 6 enumerated categories
2. Section 11.4 cure window: 14 days → **30 days**
3. New Section 11.5 "Proportionality" added — explicit good-faith standard

**Verify:**
```bash
grep -c "Material Breach\|30 days from receipt\|Section 11.5" \
  ~/Documents/Business/legal/moe-legacy/master-partner-agreement.md
# Expect: 4+ matches
```

---

## STEP 7 — Read MPA + DPA + AUP one more time before USB ship 🟡 READY

**Workstream:** B
**Who:** YOU (15 min reading)
**Time:** 15 min

The contracts are what protects you long-term (the kill-switch is defense-in-depth).
Read them as if you were Moe. If any clause makes you feel weird, edit it before shipping.

```bash
open ~/Documents/Business/legal/moe-legacy/master-partner-agreement.md
open ~/Documents/Business/legal/moe-legacy/dpa.md
open ~/Documents/Business/legal/moe-legacy/aup.md
```

**Verify:** You sign your own draft mentally. If anything trips you up, fix and reread.

---

## STEP 8 — Pull Hermes 3 8B model (Tier 1 of Hermes upgrade) 🟡 READY

**Workstream:** C
**Who:** YOU (one command, ~5 GB download)
**Time:** 5-15 min depending on connection

```bash
ollama pull hermes3:8b
```

**Verify:**
```bash
ollama list | grep hermes3
# Expect: hermes3:8b ~5 GB
```

**On fail:** Ollama daemon not running. Run `ollama serve` in another terminal OR open Ollama.app.

---

## STEP 9 — Pull Qwen 3 8B as the second tool-calling option 🟡 READY (parallel to #8)

**Workstream:** C
**Who:** YOU (one command, ~5 GB)
**Time:** 5-15 min

```bash
ollama pull qwen3:8b
```

**Verify:** `ollama list | grep qwen3` shows it.

---

## STEP 10 — Run the Hermes bridge smoke test 🔴 BLOCKED by #8 or #9

**Workstream:** C
**Who:** YOU
**Time:** 30 sec

```bash
~/Projects/AIXMOS-AGENTS/hermes-bridge/smoke-test.sh
```

**Verify:** Output shows `toolCount` per model. With `llama3.2:3b` you'll see ≤1 (we already tested this). With `hermes3:8b` or `qwen3:8b` you should see ≥1, and ideally with the right argument schema (the 3B used `context` instead of `argument` — a flaw the 8B should fix).

**On fail:** Compare the `raw preview` lines between models. If hermes3:8b also emits 0 tool calls, the system-prompt envelope ordering may need adjustment in `hermes_runner.js`.

---

## STEP 11 — DON'T flip the default; use per-call override instead 🟢 RESOLVED 2026-06-10

**Workstream:** C
**Who:** ME (Claude) already benchmarked this
**Time:** —

**Counterintuitive finding from 2026-06-10 head-to-head benchmark** (see [[project_hermes_bridge_benchmark_2026_06_10]]):

| Model | Latency | Skill-name accuracy |
|---|---|---|
| `llama3.2:3b` (current default) | **8-10s** | picks REAL registry names |
| `hermes3:8b` | 44s | **HALLUCINATES** skill names not in our registry |
| `qwen3:8b` | 50s | picks REAL registry names, supports v2 round-trip |

**Decision:** keep `llama3.2:3b` as the default. Use `--model=qwen3:8b` override for critical-thinking tasks (governance, deep synthesis). Skip `hermes3:8b` for tool calling — it confabulates.

```bash
# For critical-thinking tasks (slow but accurate):
AIXMOS_LLM_BACKEND=ollama OLLAMA_MODEL=qwen3:8b \
  node ~/Projects/AIXMOS-AGENTS/hermes-bridge/agent-with-tools-v2.js \
  vision "Should we ship Moe without attorney review?" \
  --model=qwen3:8b

# For fast daily ops (SMS, comms, status):
node ~/Projects/AIXMOS-AGENTS/agent-quick.js chummo "Draft a thank-you SMS"
# (uses default llama3.2:3b, ~2s)
```

**No action needed** — your `.env` stays as is.

---

## STEP 12 — Configure Tailscale ACL 🟡 READY (parallel to all above)

**Workstream:** A
**Who:** YOU (web UI action)
**Time:** 5 min

```bash
# 1. Open Tailscale admin
open https://login.tailscale.com/admin/acls

# 2. Get the NAS tailnet IP first
/Applications/Tailscale.app/Contents/MacOS/Tailscale status | grep -i nas
# Note: if no NAS on tailnet, skip the NAS dst lines from the template

# 3. Read the template (do not paste literally — merge with existing ACL)
cat ~/Projects/TMMT/scripts/partner-deploy/tailscale-acl.json

# 4. In Tailscale admin, ADD the tagOwners entry for `tag:partner-moe`
#    and the ACL rule for src=tag:partner-moe → narrow dst list.
#    Substitute the NAS IP from step 2.
```

**Verify:** Tailscale admin shows `tag:partner-moe` in tagOwners and the ACL rule.

**On fail:** Tailscale will reject malformed JSON. Validate at https://jsonlint.com first.

---

## STEP 13 — Get a one-shot Tailscale auth key for Moe's Mac 🔴 BLOCKED by #12

**Workstream:** A
**Who:** YOU (web UI)
**Time:** 2 min

```bash
open https://login.tailscale.com/admin/settings/keys
# Click "Generate auth key"
# Settings:
#   Reusable: NO (one-shot)
#   Ephemeral: NO
#   Pre-approved: YES
#   Tags: tag:partner-moe
#   Expiry: 24 hours (Moe should install within 1 day of receiving USB)
# Copy the key. It starts with: tskey-auth-...
```

**Verify:** You have a `tskey-auth-...` string in your clipboard.

---

## STEP 14 — Format a USB drive 🟡 READY

**Workstream:** A
**Who:** YOU (physical + Disk Utility)
**Time:** 3 min

1. Plug in a USB drive (8 GB+ is plenty; the payload is ~5 MB)
2. Open Disk Utility (`open /Applications/Utilities/Disk\ Utility.app`)
3. Select the drive → Erase
4. Format: **APFS** (or exFAT if Moe might use it on Windows later)
5. Name: **AIXMOS-PARTNER** (exact spelling — burn script looks for `/Volumes/AIXMOS-PARTNER`)

**Verify:** `ls /Volumes/AIXMOS-PARTNER` works.

---

## STEP 15 — Burn Moe's USB 🔴 BLOCKED by #5, #13, #14

**Workstream:** A
**Who:** YOU (one command, the key from #13 in clipboard)
**Time:** 30 sec

```bash
~/Projects/TMMT/scripts/partner-deploy/burn-partner-usb.sh \
  --partner=moe-legacy \
  --tailscale-authkey="$(pbpaste)"   # uses the auth key from step 13
```

**Verify:**
```bash
ls -la /Volumes/AIXMOS-PARTNER/
# Expect: START-HERE.command, provision-partner.sh, partner-payload/,
#         consent/, legal/, .partner-config, .install-token, .tailscale-authkey
```

**On fail:** Path mismatch or USB not at expected mount point. Use `--volume=/Volumes/<actual>`.

---

## STEP 16 — Pre-install call with Moe 🔴 BLOCKED by #15

**Workstream:** A
**Who:** YOU (15 min phone call, you on script, Moe listens)
**Time:** 15 min call + 15 min mail prep

```bash
open ~/Projects/TMMT/scripts/partner-deploy/_ARCHIVED-moe-handoff/01-pre-install-call-script.md
```

Follow the script. Read the **recovery phrase verbatim** (from step 5 output) at the end. He writes it down. You confirm he read it back.

Then ship the USB. Hand-deliver or USPS Priority signature-required.

**Verify:** Update the engagement-tracker:
```bash
$EDITOR ~/Documents/Business/legal/moe-legacy/engagement-tracker.md
# Mark "Pre-install call complete YYYY-MM-DD"
```

---

## STEP 17 — Install-day call with Moe 🔴 BLOCKED by #16 + USB arrival

**Workstream:** A
**Who:** YOU + ME live (call lasts ~20-25 min)
**Time:** 25 min

```bash
open ~/Projects/TMMT/scripts/partner-deploy/_ARCHIVED-moe-handoff/02-install-day-call-script.md
```

Both of you on the phone. Have audit-readout open on your side:
```bash
watch -n 5 '~/Projects/TMMT/scripts/partner-deploy/owner/audit-readout.sh --partner=moe-legacy --last=1h | tail -5'
```

When his install completes, you'll see his first heartbeat row appear.

**Verify:** First heartbeat row in `partner_heartbeats` for `tenant_id='moe-legacy'`.

**On fail:** See script 02's "Contingency plays" section. Most likely cause: install-token replay (he double-clicked START-HERE.command twice).

---

## STEP 18 — Kill switch in your hand 🔴 BLOCKED by #17

**Workstream:** A
**Who:** YOU at any time post-install
**Time:** Always

```bash
# Status anytime:
~/Projects/TMMT/scripts/partner-deploy/owner/kill-partner.sh --partner=moe-legacy --tier=status

# Soft disable (reversible):
~/Projects/TMMT/scripts/partner-deploy/owner/kill-partner.sh --partner=moe-legacy --tier=soft --reason="..."

# Restore:
~/Projects/TMMT/scripts/partner-deploy/owner/kill-partner.sh --partner=moe-legacy --tier=restore

# Hard wipe (irreversible — see Bob's SOP card):
~/Projects/TMMT/scripts/partner-deploy/owner/kill-partner.sh --partner=moe-legacy --tier=hard --confirm="MOE LEGACY" --reason="..."
```

**Verify:** `--tier=status` shows current state any time.

---

## Dependency graph

```
1 (env) ─┬─> 2 (drift) ──> 3 (apply) ──> 4 (dryrun) ──> 5 (issue) ─┐
         │                                                          │
         │                                                          ▼
         │                                            14 (format) → 15 (burn) → 16 (pre-call) → 17 (install) → 18 (kill in hand)
         │                                                          ▲
         │                                            12 (ACL) → 13 (key) ─┘
         │
         └─> 7 (read v0 docs)              [B]
         └─> 8/9 (pull hermes/qwen) → 10 (smoke) → 11 (flip default)  [C]

6 (MPA edits)  DONE — independent
```

## What to ask me at each step

- After **1**: "Verify keys work" — I'll curl-test
- After **3**: "Confirm migration applied" — I'll list-tables
- After **4**: "Read dry-run output" — I'll diagnose any failure
- After **10**: "Compare hermes vs llama outputs" — I'll judge whether to flip default
- After **17**: "Confirm Moe install green" — I'll audit-readout

## What to NOT do

- Don't run the migration twice (it has IF NOT EXISTS but the RLS policies will conflict if re-run after edits)
- Don't share the recovery phrase via SMS / email / Slack — voice only
- Don't burn a second USB for Moe without first revoking the first install token via `owner/recovery-flow.sh`
- Don't flip `OLLAMA_MODEL` to `hermes3:8b` if step 10 shows worse output than `llama3.2:3b` (rare but possible if envelope ordering is off)
- Don't engage the attorney now (you chose no-lawyer-path 2026-06-09) unless one of the trigger conditions hits — see `project_moe_legacy_no_lawyer_path.md`

## Sources of truth in this codebase

- `~/Projects/TMMT/docs/superpowers/specs/2026-06-09-moe-legacy-partner-deploy-design.md` — full architectural spec
- `~/Projects/TMMT/scripts/partner-deploy/README.md` — deploy-side README
- `~/Projects/AIXMOS-AGENTS/hermes-bridge/README.md` — bridge architecture
- `~/Documents/Business/legal/moe-legacy/README.md` — legal directory index
- `~/Projects/TMMT/scripts/partner-deploy/SHIP-WITHOUT-LAWYER.md` — the no-lawyer rationale
