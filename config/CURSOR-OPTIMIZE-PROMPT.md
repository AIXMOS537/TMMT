# Cursor prompt — audit & harden the setup (daily-use + security)

Two sections. Paste **Section 1** to Claude in Cursor on the Mac you're hardening
(carry, work, or the M1). Review its report, then paste **Section 2** to apply the
safe fixes. It runs locally, so it can inspect the real machine — not guess.

═══════════════════════════════════════════════════════════
## SECTION 1 — AUDIT (read-only, report a scorecard)
═══════════════════════════════════════════════════════════
> You are my security + DevEx lead. Audit THIS Mac and the TMMT repo for daily-use
> readiness and security. Read-only — change nothing yet. Report a scorecard
> (✅/⚠️/❌ + one-line fix) covering:
>
> 1. Disk: is **FileVault** on? (`fdesetup status`)
> 2. SSH: is Remote Login on, and is it **key-only** (PasswordAuthentication no in
>    `/etc/ssh/sshd_config`)? Any authorized_keys?
> 3. Tailscale: `tailscale status` — which nodes are reachable, is MagicDNS on,
>    am I exposing anything publicly (`tailscale serve status`)?
> 4. Secrets: scan the repo for committed secrets (`git ls-files | grep -i env`,
>    grep for keys/tokens/`BEGIN PRIVATE KEY`); confirm `.env*` is gitignored and
>    that `~/.hailmary/config.env` is `chmod 600`.
> 5. Repo health: `git status`, current branch, `npm run build` (pass/fail),
>    `npm audit --omit=dev` (high/critical only), Node version vs `.nvmrc`/engines.
> 6. Local AI: is `ollama` installed + serving, which models are pulled?
> 7. Always-on (if this is the M1): is `com.aixmos.hailmary` loaded
>    (`launchctl list | grep aixmos`), is sleep disabled on power (`pmset -g`)?
> 8. Backups: Time Machine on? NAS reachable? Supabase PITR (note to check dashboard).
> 9. Updates: macOS + brew outdated counts.
>
> Output the scorecard, then a prioritized "fix list" (security-critical first).
> Do not make changes in this pass.

═══════════════════════════════════════════════════════════
## SECTION 2 — HARDEN (apply the safe fixes; ask before anything risky)
═══════════════════════════════════════════════════════════
> Now apply ONLY the safe, reversible hardening from your audit. For each, show me
> the command and the result. ASK before anything that could lock me out or is
> irreversible.
>
> Safe to apply:
> - `chmod 600 ~/.hailmary/config.env` and any key files.
> - Ensure `.env*` is gitignored; if any secret is tracked, STOP and tell me.
> - `npm audit fix` (no `--force`); re-run `npm run build` to confirm still green.
> - Pull latest scripts: `git fetch origin claude/text-number-current-setup-mfmn1f
>   && git checkout FETCH_HEAD -- bin scripts` ; `chmod +x bin/* scripts/*.sh`.
> - If Ollama missing: install + pull `qwen2.5:14b nomic-embed-text llama3.2-vision`.
> - Tighten Tailscale: confirm nothing is on `tailscale serve`/`funnel` that I
>   didn't intend; report the ACL so I can lock the M1 to only the nodes I name.
>
> ASK FIRST (don't auto-do): turning on FileVault, switching SSH to key-only +
> disabling password auth, changing pmset, rotating any secret. Give me the exact
> command for each and let me run it.
>
> Finish with: a 5-line "daily driver" summary of what's now hardened and the 1–3
> items still needing me (hardware/dashboard).

═══════════════════════════════════════════════════════════
## The non-Cursor items only YOU can do (the real gaps)
═══════════════════════════════════════════════════════════
- **Get the M1 online + shared** to the carry tailnet (the current blocker).
- **Tailscale ACLs:** tag the M1 (`tag:brain`) and restrict who can reach it.
- **FileVault ON** on every Mac (M1, carry) — encrypts the disk if lost/stolen.
- **UPS** on the M1 + router (power-outage resilience).
- **Supabase dashboard:** enable **Leaked Password Protection** + **PITR/backups**.
- **Rotate** `MEMORY_API_TOKEN` / `CRON_SECRET` / webhook secrets on a schedule.
- **Quo credits** auto-recharge (so automation never stalls).
