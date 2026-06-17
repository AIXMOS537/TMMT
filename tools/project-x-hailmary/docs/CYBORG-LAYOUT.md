# CYBORG USB — PROJECT X HAILMARY LAYOUT

This is the folder structure to copy onto the CYBORG flash drive.
CYBORG is the master key. Only Muhammad Taha carries it.

```
/Volumes/CYBORG/
  HAILMARY/
    │
    ├── START-HERE.command          ← Double-click on any Mac to begin
    │
    ├── scan/
    │   └── scan-machine.sh        ← Run FIRST on any new machine before activating
    │
    ├── activate/
    │   └── activate.command       ← Activates a machine, registers in watchtower
    │
    ├── master/                    ← OWNER EYES ONLY
    │   ├── .passhash              ← SHA-256 of master passphrase (not the password itself)
    │   ├── .supabase-service-key  ← Supabase service role key (chmod 600)
    │   ├── revoke.sh              ← Kill any operator instantly
    │   └── restore.sh             ← Restore a revoked operator
    │
    ├── deploy/
    │   ├── tier-1-taste/          ← Demo content (free)
    │   ├── tier-2-starter/        ← $97/mo content
    │   ├── tier-3-operator/       ← Mid-tier content
    │   └── tier-4-flagship/       ← $50K full stack content
    │
    ├── watchtower/
    │   └── heartbeat.sh           ← Installed on operator machines automatically
    │
    └── docs/
        ├── CYBORG-LAYOUT.md       ← This file
        └── supabase-migration.sql ← Apply once to Supabase to create license table
```

## WORKFLOW — When a new operator joins

1. **Scan first**: plug CYBORG into their Mac, run `scan/scan-machine.sh`
   - AirDrop the report to yourself
   - Read it. Know their machine. Then decide.

2. **Activate**: run `activate/activate.command`
   - Enter master passphrase
   - Fill in their name, email, city, tier
   - Script registers them in watchtower + installs heartbeat on their machine
   - Done in under 5 minutes

3. **They go live**: their machine pings your watchtower every 7 days
   - If they go dark: heartbeat overdue alert
   - If they violate rules: run `master/revoke.sh` — they go offline next ping

## KILL SWITCH TIERS

| Tier       | Auto-suspend if no heartbeat | Paid in full | Notes                          |
|------------|------------------------------|--------------|-------------------------------|
| taste      | 3 days                       | No           | Demo only                     |
| starter    | 8 days                       | No           | Monthly $97                   |
| operator   | 8 days                       | No           | Mid-tier                      |
| flagship   | 14 days                      | Yes          | Still under watchtower always |

**Even $50K full pay = watchtower stays on.**
Muhammad Taha can revoke any operator at any time for any threat to the clan.

## MASTER PASSPHRASE

Never write it down. Never type it in a chat. Never email it.
You speak it. You remember it. It lives in your head only.
