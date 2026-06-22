# Push blocked by gitleaks — secret in history (runbook)

> Your Mac's `scripts/hooks/pre-push` runs `gitleaks detect` over the **full history**
> and refuses the push when it finds a secret. `.gitleaks.toml` already allowlists the old
> Airtable PAT, so a **new, un-allowlisted finding** is present.

## What HAILMARY established (without touching the secret)

- `git log -S` (pickaxe) shows a **JWT (`eyJhbGciOi…`) was introduced** in:
  - `7f10a26` — *Red Hood onboarding + verify-gate + tailscale invite*
  - `47377d8` — *security+tenancy: sync live DB hardening into master*
- A Supabase JWT is **either**:
  - **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) → **public, safe to commit** → just allowlist it; **or**
  - **service_role key** (`SUPABASE_SERVICE_ROLE_KEY`) → **a real secret** → **ROTATE NOW**, then scrub.
- I did **not** decode/extract the token (and the platform blocks it). **Classifying it is a human call** — do it locally.

## Step 1 — identify it (run on your Mac; gitleaks is installed there)

```bash
gitleaks detect --no-banner --redact     # prints Rule + File + Commit, value redacted
```

Open the flagged file at that commit and read the **variable name** (not the value):
- `*ANON_KEY` / `NEXT_PUBLIC_*` → **SAFE** → go to Step 2A.
- `*SERVICE_ROLE*`, `tskey-…` (Tailscale), `GHL_WEBHOOK_SECRET`, `STRIPE_*`, any private key → **REAL SECRET** → Step 2B.

## Step 2A — if it's PUBLIC (anon key / NEXT_PUBLIC_*)

Allowlist it so the guard stops blocking. Edit `.gitleaks.toml` → `[allowlist]`:

```toml
# Supabase ANON key (public by design; safe in client bundles) committed in onboarding docs.
regexes = [
  # ...existing...
  '''eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9''',   # only if confirmed anon
]
```
Then `git add .gitleaks.toml && git commit && git push` (PR it). Push unblocks.

## Step 2B — if it's a REAL secret (service_role / tskey / webhook / stripe / key)

**Rotate first — revocation beats scrubbing. Scrubbing history does NOT un-leak it.**
1. **Rotate at the source:**
   - Supabase service_role → Dashboard → Project → **API → roll `service_role`**.
   - Tailscale `tskey-…` → admin console → **revoke the auth key**.
   - GHL/Stripe → roll the respective secret.
2. **Update where it's used:** `vercel env` (prod) + re-pull `.env` + redeploy.
3. **Scrub history** (rewrites history — coordinate with the team, everyone re-clones):
   ```bash
   pipx run git-filter-repo --replace-text <(echo 'THE_SECRET==>***REMOVED***')
   # or BFG: bfg --replace-text replacements.txt
   git push --force-with-lease           # after the team is warned
   ```
4. **Confirm clean:** `gitleaks detect --no-banner --redact` → no findings → remove the allowlist entry.

## Do NOT

- ❌ `git push --no-verify` to bypass the hook on a **real** secret — that ships the leak.
- ❌ Allowlist a **service_role**/private key to silence the guard — that hides a live leak.

## Who does this (chain of command)

This is a **Cyborg (Watchtower) + Boss** action, executed by **Nightwing** on the Mac.
The CEO decides *rotate vs allowlist* once the variable name is known; the lieutenant runs
the commands. See `docs/security/SUPABASE-ADVISORS-2026-06-15.md` for the rotation runbook.
