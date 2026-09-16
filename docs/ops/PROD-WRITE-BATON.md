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

## Not yet enforced (next step, needs owner approval)
A Claude Code `PreToolUse` hook that refuses `apply_migration` or `gh pr merge` unless the session holds the baton, and optionally a DDL event trigger backstop. Until then, enforcement is by rule (`~/.claude/rules/prod-write-baton.md`) and by the `assert` call.
