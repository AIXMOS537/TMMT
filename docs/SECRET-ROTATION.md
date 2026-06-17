# Secret Rotation & Scrub — runbook

> Rotate every credential, purge them from history, and stop new ones from ever
> being committed. **Rotation at the provider is the real fix** (it kills the key);
> scrubbing git history is cleanup; the pre-commit gate is prevention.
>
> Tools: `scripts/secret-scan.sh` (inventory), `scripts/compliance-check.mjs` (copy),
> the verify-gate + gitleaks (prevention).

---

## 1. Order of operations (always)

```
 1. INVENTORY   scripts/secret-scan.sh --history     → what + where (redacted)
 2. ROTATE      at each provider (revoke old → issue new → update env)   ← the real fix
 3. SCRUB       remove from current files + purge history (git filter-repo)
 4. PREVENT     gitleaks pre-commit + verify-gate secrets check + .env-only
```

A leaked key is compromised the moment it's pushed. **Rotate first** — never rely on
scrubbing to "un-leak" it (it's in clones, forks, PR diffs, and provider/Git caches).

## 2. Inventory — run on every repo / machine on the mesh

```bash
scripts/secret-scan.sh            # current tracked files (redacted)  — gate-friendly
scripts/secret-scan.sh --history  # + full git history, all branches
# report: .aixmos/secret-scan-report.txt
```
Run it in each checkout/worktree and each repo (TMMT, the legacy bundle, any client repo).

## 3. Rotate — per provider (revoke old → new → update env → verify)

| Credential | Where to rotate | Update after |
|---|---|---|
| **Airtable PAT** 🔴 | airtable.com/create/tokens → delete → new (scoped) | `.env` + Vercel env |
| **Supabase service_role** | Dashboard → Project Settings → API → roll keys (rotating JWT secret rolls anon+service) | `.env` (SUPABASE_SERVICE_ROLE_KEY) + Vercel |
| **Supabase DB password** | Project Settings → Database → reset password | any direct DB conn strings |
| **GoHighLevel** | App → API key / private integration; regenerate webhook secrets | `.env` (GHL_WEBHOOK_SECRET, MISSION_WEBHOOK_SECRET, CRON_SECRET) + Vercel |
| **Vercel token** | Account → Settings → Tokens → revoke + create | local Vercel CLI / CI |
| **Tailscale** | Admin → Settings → Keys → revoke API access tokens / auth keys | `TAILSCALE_API_KEY` env on the partner-deploy host |
| **Telegram bot** | @BotFather → /revoke (or /token) | `TELEGRAM_BOT_TOKEN` env |
| **Anthropic** | console.anthropic.com → API Keys → revoke + create | `ANTHROPIC_API_KEY` (escalation tier) |
| **OpenRouter** | openrouter.ai → Keys | `OPENROUTER_API_KEY` |
| **Stripe (via GHL)** | Stripe dashboard → Developers → API keys → roll | GHL connection |
| **GitHub PAT/tokens** | github.com → Settings → Developer settings → revoke + reissue | git remotes / CI |

Rule: each lives **only** in `.env` (gitignored) + the deployment env. Never a tracked file.

## 4. Scrub history (git filter-repo) — coordinated, after rotation

> ⚠️ This rewrites every commit SHA. **All clones/worktrees must re-clone or hard-reset.**
> Pause the swarm + HAILMARY first. Do it once, for all branches.

```bash
# 1. install (mac)
brew install git-filter-repo        # or: pipx install git-filter-repo

# 2. make a LOCAL replacements file (gitignored; delete after). One secret per line:
#    <literal-secret>==><REPLACEMENT>
printf '%s\n' 'pat8mah6kKOJVxLMX.f4d3384f...==>AIRTABLE_PAT_REDACTED' > /tmp/replacements.txt
#    (paste the FULL real values here locally — never commit this file)

# 3. rewrite all history
git filter-repo --replace-text /tmp/replacements.txt --force

# 4. re-add the remote (filter-repo drops it) and force-push every branch + tags
git remote add origin https://github.com/AIXMOS537/TMMT.git
git push --force --all
git push --force --tags

# 5. clean up
rm -f /tmp/replacements.txt

# 6. EVERY other machine/worktree: re-clone, or:
git fetch origin && git reset --hard origin/<branch>
```

After force-push, ask collaborators to re-clone; old SHAs are gone. The secret may
still exist in GitHub PRs/forks/caches — which is why **step 2 (rotate) is the fix.**

## 5. Prevent — so it never happens again

- **Pre-commit gitleaks** (catches secrets before they're even committed):
  ```bash
  # .git/hooks/pre-commit (or via core.hooksPath .githooks)
  gitleaks protect --staged --no-banner || { echo "secret staged — aborting"; exit 1; }
  ```
- **Gate it:** `verify.checks` includes a `secrets` check (runs `secret-scan.sh`), so a
  secret in the tree fails the build/push.
- **`.env` only.** Real values live in `.env` (gitignored via `.env*`) + deployment env.
  Docs/examples use placeholders (`AIRTABLE_PAT=<YOUR_PAT_HERE>`).
- **`.gitleaksignore`** only for confirmed false positives or already-revoked, scrubbed
  fingerprints — never to silence a live secret.

## 6. Status (this repo)

- 🔴 **Airtable PAT** — scrubbed from current files (commit `01c1a9c`); **REVOKE at
  source** (the real fix), then optionally purge history (§4).
- 🟢 `$TAILSCALE_API_KEY` in `verify-readiness.sh` — **false positive** (env var, not a
  literal). Allowlist it.
- 🟢 `-----BEGIN PRIVATE KEY-----` — **false positive** (a test assertion).
- 🟢 Current tree otherwise **clean** (`secret-scan.sh` exit 0).

---

_Tools: `scripts/secret-scan.sh`. See `docs/OPERATOR-RUNBOOK.md §2` (rotation is
backstop #2/#3), `docs/IT-SUPPORT-TEAM-PLAYBOOK.md §4` (secrets brokered, never to
offshore)._
