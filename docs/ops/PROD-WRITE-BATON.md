# Production Write Baton

Live in prod since 2026-09-16 (`20260916193606 ops_prod_write_baton`). Owner rule.

**Reads, audits, coding, tests and PR preparation stay parallel. Only one session at a time may perform a consequential production mutation.**

## What needs the baton
- A prod migration or any prod SQL that writes data.
- A prod config or integration change (Vercel env, Supabase settings, GHL workflows or DND, n8n).
- A credential change that affects prod.
- A merge to `master`, because merging deploys.
- Switching on live automation or communication.

## Protocol (Supabase SQL tool)
```sql
select ops.prod_baton_status();                                  -- 1. check
select ops.acquire_prod_baton('<session>', '<workstream>', '<purpose>',
                              '<operation>', '<owner approval ref>'); -- 2. acquire (default 45 min, max 4 h)
select ops.assert_prod_baton('<session>');                       -- 3. re-check right before each write
-- 4. do the write, then verify it
select ops.release_prod_baton(<id>, '<session>', '<result>', '<evidence>'); -- 5. release
```
- **`acquired: false`:** someone else holds the baton. **Stop.** Report the holder and wait.
- **Long jobs:** `select ops.renew_prod_baton(<id>, '<session>', interval '45 minutes');`
- **Session name:** use something unambiguous, such as `ccd:<session name>` or `cursor:<machine>`.

## Stale-lock recovery
- **Expiry never releases a baton, and `acquire` never takes one over.** An expired holder can no longer `assert`, so it can't keep writing.
- To recover a genuinely abandoned baton:
  1. Confirm with the owner that the holding session is gone. **Never recover just because a session looks idle.**
  2. Run `select ops.recover_stale_prod_baton(<id>, '<your session>', '<reason, 20+ chars: who confirmed it and why>');`
     This only works after `expires_at`. It records who recovered the baton and why, and marks the row `stale_recovered`.
  3. Acquire normally.

## Properties
- **One holder, enforced by the database.** A unique partial index allows only one unreleased row, so two sessions acquiring at the same moment can't both succeed.
- **Not an availability dependency.** No application code reads the baton; if it breaks, production keeps running.
- **Locked down.** `anon` and `authenticated` have no access to schema `ops`. The table holds no PII, and history is kept.
- **Rehearsal:** `node scripts/tests/sql/prod-write-baton.rehearsal.mjs` (12 checks).

## Enforcement hook (Claude Code, BRAINIAC)
Source: `tools/prod-baton-hook/`. Installed 2026-09-16.
- **Runtime:** `%LOCALAPPDATA%\tmmt\baton-hook\` (venv with pg8000, pinned Supabase Root 2021 CA).
- **Settings:** `~/.claude/settings.json` has `PreToolUse` entries for the Supabase MCP, the Vercel MCP, `Bash` and `PowerShell`. A backup was taken first.
- **Hooks load at session start:** sessions already running before installation are **not** covered until they restart.
- **Identity:** a session's holder name is `claude:<session_id>`. The deny message states the exact name to use.
- **Decisions:**
  - Not a recognised production write: allowed, no database call.
  - Holder with an unexpired baton: allowed.
  - Free, expired, or held by someone else: **deny**, with holder, workstream, times and the next safe action.
  - Baton state unreadable (DB down, credential missing): **ask** for manual confirmation. Never a silent allow.
- **Baton calls themselves** (`ops.*_prod_baton`) are allowed, so a session can acquire. Mixing them with a write in the same call is still treated as a write.
- **Recognised writes:**
  - Supabase MCP: `apply_migration`, `execute_sql` with DDL/DML or known mutating functions, branch/edge/project mutations.
  - Vercel MCP: deploy, pause/unpause, protection, purchases.
  - Shell: `gh pr merge`, pushes to master/main (including `work-baton.ps1 -Mode Push`), `vercel --prod`/env/alias/promote/rollback, `supabase db push`/`--linked`/`functions deploy`/`secrets set`, `psql` against prod, and POST/PUT/PATCH/DELETE to the prod Supabase, GHL, Vercel, Twilio or Slack APIs.
- **Credential:** DB login `baton_reader` (migration `20260916201201`) can only `EXECUTE ops.prod_baton_status()`. Its password was generated locally, is DPAPI-encrypted for the Windows user, and only the SCRAM verifier was sent to the database.
- **Known conservative false positive:** a push to `master` in a non-deploying repository (for example `tmmt-control-plane`) also needs the baton.
- **Tests:** `python -m unittest tools/prod-baton-hook/test_baton_guard.py` (15). Live-tested against real states: held by other, free, held by this session, expired, recovered, DB/credential unavailable, read-only SQL, local tests.
- **Not covered:** Cursor/other agents, and humans at a terminal. A database-side DDL event-trigger backstop is not built.
