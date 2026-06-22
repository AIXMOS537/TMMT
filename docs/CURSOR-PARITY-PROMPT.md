# Cursor prompt — fix & extend the local↔prod parity script

> Paste this into Cursor (with `scripts/parity.sh` open) to harden, fix, or extend it.

---

You are my DevOps engineer. The file `scripts/parity.sh` keeps a **local, editable**
version and the **production** version of TMMT OS in sync — for me and for my team — so we
never drift again (prod had ~130 migrations the repo didn't). Help me make it bulletproof.

**What it must guarantee**
1. **Production is always reproducible from the repo.** `parity pull` brings prod's schema
   into `supabase/migrations/` and prod env into `.env`. After a pull + commit, anyone can
   rebuild prod from the repo.
2. **Anyone can edit locally, safely.** `parity up` runs the app locally; `parity localdb`
   spins a local Supabase mirror so edits never touch prod by accident.
3. **Drift is always visible.** `parity diff` / `parity status` show exactly what prod has
   that the repo doesn't (and vice-versa).
4. **Promoting to prod is deliberate.** `parity push` does a dry-run + a typed
   `APPLY TO PROD` confirmation + an automatic schema snapshot before applying. Never silent.
5. **Safe by default.** Only `push` writes to prod. It must never print secrets.

**Tasks for you**
- Verify the Supabase CLI commands/flags are current (`db pull`, `db push --dry-run`,
  `db diff`, `migration list`, `db dump`, `link`) and fix any that changed.
- Make `setup` a clean one-command onboarding for a brand-new teammate (install hints,
  link, pull). It should fail loudly with the exact fix when a tool/login is missing.
- Add a `parity verify` that exits non-zero if the repo can't reproduce prod (CI-friendly).
- Confirm `PROJECT_REF` resolution (env override → `supabase/config` → default) is robust.
- Keep it POSIX-bash, `set -uo pipefail`, no secret leakage, idempotent, re-runnable.

**Guardrails**
- Don't change the confirmation gate on `push` (the `APPLY TO PROD` typed check stays).
- Don't add a step that auto-applies migrations to prod without that gate.
- Test each subcommand's argument parsing; keep the `tmmt parity <cmd>` wiring working.

After changes, run `bash -n scripts/parity.sh` and walk me through `parity status`,
`parity pull` (dry, explain), and `parity push` (dry-run path) so I can see it's safe.
