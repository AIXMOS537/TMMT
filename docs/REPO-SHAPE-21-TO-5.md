# Repo shape — 21 → 5 (do not create a repo per handoff)

**Live keepers**

| Keep | Role |
|------|------|
| `TMMT` | Product — rentals, dealer, operator, credit UI |
| `AIXMOS` / `AIX-Command-Center` | Engine — agents, gateway, Chummo + Moose |
| `Legal-Ops` | Contracts, sealed |
| `hailmary-drop` | Only handoff channel |
| `moe-legacy-portal` | Moe credit/GHL only — zero engine |

**Local snapshots (quarantined, not deleted)**

- `~/Projects/TMMT-launch` — see `QUARANTINE.md`
- `~/Projects/TMMT-swarm` — see `QUARANTINE.md`

**Vercel — keep three apps, retire duplicates**

Keep: `tmmt-ops`, `tmmt-command-center`, `aixmos-landing`  
Retire after env/domain migration: `tmmt-c919`, `tmmt`  
Dry-run: `bash scripts/retire-vercel-duplicates.sh`  
Apply only after the three apps have production deploys and domains moved.

GitHub archive of empty one-shot repos is an owner gate (do not delete provenance).
