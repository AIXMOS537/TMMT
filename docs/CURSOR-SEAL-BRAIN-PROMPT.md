# Cursor prompt — seal the brain LOCAL on this box

Two sections. Paste **Section 1** to Claude in Cursor on the box that will host the
brain (Sovereign Starter / workstation / Mac). Review, then **Section 2** to lock
it down. It runs locally and adapts to the real machine.

═══════════════════════════════════════════════════════════
## SECTION 1 — STAND UP THE LOCAL BRAIN
═══════════════════════════════════════════════════════════
> You are my infrastructure lead. Make the brain run 100% LOCAL on THIS box, no
> cloud. Steps (show each command + result; confirm before destructive ones):
> 1. Confirm Docker + Ollama installed (install if missing). Start Ollama, pull
>    `qwen2.5:14b` and `nomic-embed-text`.
> 2. Get `scripts/seal-brain-local.sh` from branch
>    `claude/text-number-current-setup-mfmn1f` and run it `--apply` (it stands up
>    local Postgres+pgvector as the brain DB, writes ~/.hailmary/brain.env, pulls models).
> 3. Load our schema into the local brain:
>    `for f in supabase/migrations/*.sql; do docker exec -i hailmary-brain-db psql -U hailmary -d hailmary_brain < "$f"; done`
>    Report any migration errors and stop if a core table fails.
> 4. Verify: `docker exec hailmary-brain-db psql -U hailmary -d hailmary_brain -c "\dt"`
>    shows memory_events/facts/entities etc., and `ollama list` shows the models.
> Report a green/red summary.

═══════════════════════════════════════════════════════════
## SECTION 2 — LOCK IT DOWN (owner/family-only, mesh-only)
═══════════════════════════════════════════════════════════
> Now make sure NO ONE outside the owner + family/friend devices can reach the
> brain. Show me each step; ASK before anything that could lock me out.
> 1. Confirm Postgres is bound to 127.0.0.1 only (`docker ps` port mapping) — never 0.0.0.0.
> 2. `tailscale up`; show `tailscale status`. Reachability to other nodes ONLY over
>    the tailnet (tailscale serve / SSH tunnel) — no public IP, no port-forwarding.
> 3. Show me a Tailscale ACL block that tags THIS box `tag:brain` and allows only
>    my named owner + family devices to reach it (I'll paste it into the admin).
> 4. Disk encryption: check FileVault (`fdesetup status`) / LUKS / BitLocker — if
>    off, give me the exact enable command (don't run it without my OK).
> 5. Backups: set the brain DB to dump nightly to the NAS over Tailscale
>    (`pg_dump` → NAS path); show the cron line.
> 6. Point the app at the local brain (BRAIN_DATABASE_URL from ~/.hailmary/brain.env)
>    or stand up self-hosted Supabase (docs/COOLIFY-SELFHOST.md). Confirm the app
>    boots against the local DB.
> End with a 5-line summary: what's local, what's locked, what still needs me.

═══════════════════════════════════════════════════════════
## The principle
Local Postgres + local Ollama + Tailscale-only + ACL `tag:brain` + disk encryption
+ NAS backups = the brain lives on YOUR box, reachable only by the people you built
it for. Own the box → own the brain. (Full spec: docs/HARDWARE-BUILD-SPEC.md.)
