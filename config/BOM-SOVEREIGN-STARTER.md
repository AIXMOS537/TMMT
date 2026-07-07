# BOM — Sovereign Starter (the ~$1.2k family/friend build)

Add-to-cart parts list for the build everyone gets: runs the full local HAILMARY
+ brain + app, 7–14B models on its own GPU. Prices ~2026, USD, approximate —
the **16 GB GPU is the part that matters**; don't cut it.

| Part | Pick | ~$ | Why |
|---|---|---|---|
| **GPU** | **RTX 4060 Ti 16GB** | 450 | 16 GB VRAM = runs 7–14B local; the whole point |
| CPU | Ryzen 7 7700 (or 8700G w/ iGPU) | 280 | 8 cores, plenty |
| Mobo | B650 (DDR5, PCIe4) | 140 | solid AM5 base |
| RAM | 32 GB DDR5-6000 (2×16) | 90 | headroom for models + app |
| Storage | 1 TB NVMe Gen4 | 70 | OS + models + Postgres |
| PSU | 750W 80+ Gold | 90 | clean power for the GPU |
| Case | ATX, good airflow | 80 | keeps it cool/quiet |
| Cooler | tower air cooler | 35 | quiet, reliable |
| **Total** | | **~$1,235** | |

**Cheaper:** drop to 4060 Ti **8GB** (~$330) → 7–8B only. Not recommended; 16 GB is the sweet spot.
**Upgrade swap:** used **RTX 3090 24GB** (~$700) instead of the 4060 Ti → runs 32B. Same rest of the build.
**Add later:** 2 TB NVMe (~$110) for more model storage; a small UPS (~$70) for outages.

## OS + first boot
- **Linux (Ubuntu LTS) recommended** for a sealed brain (lighter, scriptable). Windows works too.
- Then run **`scripts/seal-brain-local.sh`** → local Postgres+pgvector brain, Ollama + models, Tailscale-only. Or drive it via `docs/CURSOR-SEAL-BRAIN-PROMPT.md`.

## What it runs
- HAILMARY agent + the app + the **local brain** (Postgres) + **Ollama** (qwen2.5:14b daily).
- All on the box, on the tailnet only — **no cloud, no credits, no outside access.**

## Per person
Each family member / friend gets one of these = their **own isolated, local,
protected HAILMARY**. Cheap enough to standardize; powerful enough to run
everything they need.
