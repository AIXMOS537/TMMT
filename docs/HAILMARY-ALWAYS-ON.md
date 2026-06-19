# HAILMARY Always-On — make the home M1 *be you, forever*

Turn the home M1 MacBook Pro Max into your always-on **owner-proxy**: HAILMARY
acting AS Muhammad Taha, in his voice and standards, that starts at login,
restarts forever, never sleeps, and survives reboots.

## One-time setup (run on the home M1)
```
git fetch origin claude/text-number-current-setup-mfmn1f
git checkout FETCH_HEAD -- scripts/hailmary-setup.sh scripts/hailmary-daemon.sh scripts/hailmary-autostart.sh
bash scripts/hailmary-setup.sh --role home \
  --brain-url https://<brain>.<tailnet>.ts.net/api/memory --token <MEMORY_API_TOKEN>
ollama pull qwen2.5:14b        # free local brain (no token dependence)
```
The `--role home` setup automatically installs the **always-on LaunchAgent**
(`com.aixmos.hailmary`) — so HAILMARY:
- **starts at login** (`RunAtLoad`),
- **restarts forever** if it ever stops (`KeepAlive`),
- **keeps the Mac awake** (`caffeinate`),
- **survives reboots**.

## What "acts as me forever" means here
- Persona **`HAILMARY_OWNER_PROXY_SYSTEM`** (`src/lib/ai/persona.ts`): it stands
  in **as you** — your voice, standards, priorities — not a separate identity.
- The **daemon** (`scripts/hailmary-daemon.sh`) keeps local AI alive and
  heartbeats the brain so the whole mesh knows the owner-proxy is up.
- It shares the **one brain**, so it knows everything you've told the system and
  keeps it current (recall → act → remember).

## The guardrails that never break (even as you)
- **Legal & ethical only.** Protect Muhammad, his family, his people, his data, his name.
- **Never** the personal line (+1 PHONE-REDACTED).
- Reach you on the **work cell** (+1 PHONE-REDACTED) only in working hours.
- **Nothing financial, legal, or irreversible without your explicit confirmation.**
- Surfaces risky/out-of-scope decisions instead of guessing.

> The daemon itself is intentionally **safe/liveness-only** — it keeps things
> alive and present. Anything that *acts* (support routing, escalations, the
> executor steps) still flows through the gated, audited paths. That's how it can
> be "always on as you" without ever going rogue.

## Keep it bulletproof (the always part)
- [ ] Plugged in; **never sleep on power** (Settings → Battery / Lock Screen).
- [ ] On **Tailscale** (so the brain + work cell bridge are reachable).
- [ ] **Ollama** installed (free local AI; no credits to run out of).
- [ ] **UPS** on the Mac + router (rides out power outages).
- [ ] iMessage bridge has **Full Disk Access** (to reach you on the work cell).
- [ ] Brain backed up (NAS / Supabase PITR) — your memory never lost.

## Controls
```
tail -f ~/.hailmary/daemon.log              # watch it live
bash scripts/hailmary-autostart.sh          # (re)install
bash scripts/hailmary-autostart.sh --uninstall   # stop it
```

That's it — once this runs, the M1 is HAILMARY-as-you, on, forever, sharing your
one brain, guarding your name. 🐺
