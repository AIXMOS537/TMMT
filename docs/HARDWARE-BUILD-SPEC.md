# The Build — private local brain on hardware that runs everything

Goal: the brain runs **as local as possible**, **only the owner/operator + the
family & friends who get the full build can ever access it**, and the box can run
**anything** (local AI, the app, the brain, the mesh). Affordable tiers + Mac.

## How to size it (the only number that matters: how big a model you run local)
Local AI is gated by **VRAM (GPU)** or **unified RAM (Mac)**. Pick the tier by the
model you want running with no cloud, ever:

| Model (Q4) | Needs | Good for |
|---|---|---|
| 7–8B (llama3.1:8b) | ~8 GB VRAM | fast everyday agent |
| 14B (qwen2.5:14b) | ~12 GB VRAM | the daily HAILMARY sweet spot |
| 32B | ~24 GB VRAM | strong reasoning |
| 70B | ~48 GB VRAM / 64 GB Mac | top-tier, near-frontier |

## Gaming-PC builds (Windows or Linux; Linux preferred for a sealed brain)

**Tier 1 — Sovereign Starter (~$1,000–1,300) — the family/friend build**
- CPU: Ryzen 7 7700 (or 8700G) · GPU: **RTX 4060 Ti 16GB** · 32 GB DDR5 · 1 TB NVMe
- Runs **7–14B fast**, 32B usable. Plenty for the full HAILMARY + app + brain.
- This is the **affordable "everyone gets one"** spec.

**Tier 2 — Sovereign Pro (~$1,500–2,000)**
- Ryzen 7/9 · **RTX 3090 24GB (used) or 4070 Ti Super 16GB** · 64 GB · 2 TB NVMe
- Runs **32B great**, 70B (slow but real). The owner/operator daily driver.

**Tier 3 — Workstation / the Supercomputer (~$3,000–5,000)**
- **RTX 4090 24GB** (or 2× used 3090 = 48 GB VRAM) · i9/Threadripper · 128 GB · 4 TB NVMe + the home **NAS (25–30 TB)**
- Runs **70B comfortably**, multiple models at once. This is the **$50k installation
  appliance** tier — ships sealed + licensed.

## Mac options (Apple Silicon = excellent for local AI, silent, efficient)
- **Owner's M1 Pro Max 32 GB** → solid Tier-1.5: runs up to ~32B quantized. Already perfect as the home anchor.
- **Mac mini M4 Pro 64 GB (~$2k)** → runs 70B; tiny, silent, low-power "brain in a box."
- **Mac Studio M4 Max 64–128 GB (~$2.5–4k)** → runs 70B+ with room; the Mac workstation tier.

## Making the brain LOCAL and OWNER/FAMILY-ONLY (the lock-down)
1. **Run the brain on the box, not the cloud.** Self-host **Supabase/Postgres** +
   **Ollama** on it (Docker/Coolify). The brain (memory + AI) lives on your
   hardware — no one else's servers. (Migration path: mirror the current cloud
   Supabase → local Postgres; `docs/COOLIFY-SELFHOST.md`.)
2. **Reachable only over Tailscale** — never a public IP. `tailscale serve` on the
   tailnet; **Tailscale ACLs** tag the brain (`tag:brain`) and allow ONLY the
   owner + family/friend devices. Nobody outside the tailnet can even see it.
3. **Owner/family-only data access** — the org-scoped RLS + `MEMORY_API_TOKEN`
   already gate it; each family/friend build is its own org, isolated from the rest.
4. **Disk encryption** — FileVault (Mac) / BitLocker or LUKS (PC). Lost/stolen box = opaque.
5. **Backend lock + licensing** — only a paid/activated full build runs the backend
   (`docs/SECURITY-LICENSING.md`); the appliance ships locked until activated.
6. **Local-first AI router** — `OLLAMA_URL` points at the local model; cloud is
   fallback only, behind a cap. No tokens to leak, no bills to run out.
7. **Backups to the NAS** (Tailscale-only) — your memory is never lost, never elsewhere.

## What each person gets
- **Owner/operator:** Tier 2/3 + the home M1 anchor + NAS. Full autonomy.
- **Family & friends:** the **Tier 1 Sovereign Starter** — affordable, runs the
  full HAILMARY locally, their own isolated org/brain, protected, on the mesh.
- **Premium clients:** the Tier 3 sealed appliance (the $50k installation).

## The principle
Own the box → own the brain. Local model + local Postgres + Tailscale-only +
disk encryption + per-build isolation = **no one ever has access but the people
you built it for**, and it keeps running with no cloud, no credits, no exposure.
