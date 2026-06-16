# Client Onboarding & Discovery — scan, evaluate, integrate (with consent)

> Help a client (e.g. moe legacy) tailor and integrate their business into the
> ecosystem by first **understanding what they already run** — safely, with their
> consent, and without ever overreaching. Discovery is automatic; **integration is
> approved, never silent.**
>
> Tool: `scripts/discover.sh`. Aligns with the AIXMOS Master File Discovery-Agent
> consent model (§5/§7) and `docs/IT-SUPPORT-TEAM-PLAYBOOK.md` (least-privilege/audit).

---

## 1. The flow (four steps, one gate)

```
 1. CONSENT   the person records explicit, scoped, revocable consent
       │
 2. DISCOVER  scripts/discover.sh inventories — scoped, redacting, LOCAL output
       │
 3. EVALUATE  read the report together → what to keep / connect / replace
       │
 ►► APPROVE ◄◄  the person + owner sign off on the integration plan   ← the gate
       │
 4. INTEGRATE wire approved systems into the ecosystem via a mesh handoff
```

Steps 1–2 are automatic and safe. Step 4 happens **only after step 3.** No system
is connected to your network without a human approving it.

## 2. Consent — the non-negotiables

- **No consent → no scan.** `discover.sh` refuses without `--who` + `--i-consent`.
- **Scoped.** It scans only the folders the person names (`--scope`), never the whole disk.
- **Never touches** `.ssh`, keychains, cloud credentials, browser data, password stores.
- **Secrets are recorded as "EXISTS (not read)"** — contents are never opened or copied.
- **Local only.** The report stays on their machine; nothing is uploaded.
- **Revocable** anytime: `discover.sh --revoke` deletes the consent record + report.
- **Logged** — who/when/scope in `.aixmos/discovery/CONSENT.txt`.

This isn't bureaucracy — it's what keeps the relationship (and you) safe. Monitoring
and data-handling law varies; real, logged, revocable consent is the moat (Master
File §7).

## 3. Run discovery (on their machine)

```bash
# preview the consent notice (scans nothing):
scripts/discover.sh

# with consent + scope:
scripts/discover.sh --who "Moe Legacy" --scope ~/business --scope ~/code --i-consent

# review:
open .aixmos/discovery/discovery-report.md
```

What it inventories (work-relevant, non-invasive): OS + dev tools/versions, **local
AI brain** (Ollama models, services on :11434/:1234/:4000), git repos in scope
(remote URLs + branch, no file contents), project signals (package.json,
docker-compose, supabase, vercel.json…), and a **secrets-present list (paths only)**.

## 4. Evaluate → map to the ecosystem

Read the report together and classify each finding:

| Found | Likely move (after approval) |
|---|---|
| A repo we set up + the file you sent (the **local AI brain**) | Confirm it's the brain; bring it onto the tailnet as their node (if licensed) |
| Ollama + models | Register as a local model endpoint behind their LiteLLM router |
| A Next.js / web app | Candidate to fold into the platform or keep + connect via API |
| Supabase / Postgres | Map to managed Supabase + RLS; migrate or connect |
| GHL / Stripe | Wire to the rental pipeline (`docs/GHL-PIPELINE-SETUP.md`) |
| Existing tools (sheets, Airtable, CRMs) | Bridge via n8n / import; don't rip-and-replace what works |
| Secrets present | They rotate/scope; **you never hold their raw keys** |

The goal is **tailor to their vision**, not force a rebuild — keep what works,
connect the rest.

## 5. Approve → integrate (the mesh step)

Only approved items proceed. Integration is emitted as a **mesh handoff** so it's
tracked, reviewable, and reversible:

```bash
scripts/mesh-handoff.sh --from CLOUD --to FORGE \
  --intent "Integrate moe legacy: register their Ollama brain + connect Supabase" \
  --slug moe-integrate \
  --context ".aixmos/discovery/discovery-report.md (approved 2026-06-..)" \
  --guard "only the items approved in the report; rotate their secrets; do not expose hub publicly"
```

Then the same rules as everything else: branch → **verify-gate green** → **owner
approval** to merge/connect (`docs/MESH-COORDINATION.md §4`, `docs/VERIFICATION-MESH.md`).

## 6. The brain gating still applies

If moe legacy hasn't licensed the backend brain, discovery can still map their
systems and run their car-rental platform (Legacy edition), but the AI/agent
features stay in **upgrade-prompt mode** until licensed
(`docs/LEGACY-DEPLOY-MOE.md §5`). Discovery ≠ free brain.

## 7. What this is NOT

- ❌ Not covert. The person sees the notice, the scope, and the report.
- ❌ Not whole-disk scraping. Scoped folders only.
- ❌ Not secret exfiltration. Contents of secrets are never read or moved.
- ❌ Not auto-integration. Nothing connects to your network without approval.

That restraint is the product. It's what lets clients trust handing you the keys —
because you demonstrably don't take more than they grant.

---

_Tool: `scripts/discover.sh`. See `docs/IT-SUPPORT-TEAM-PLAYBOOK.md`,
`docs/MESH-COORDINATION.md`, `docs/LEGACY-DEPLOY-MOE.md`._
