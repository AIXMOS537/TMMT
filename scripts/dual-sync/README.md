# Dual Setup Sync CLI

Universal **mobile ↔ brain** registry and local state. Owner first; operators use the same shape when they pay.

**Spec:** `docs/DUAL-SETUP-SYNC.md`

## Quick start (owner)

```bash
bash scripts/dual-sync/init.sh owner
npm run dual-sync:doctor
```

## Commands

```bash
python3 scripts/dual-sync/registry.py validate
python3 scripts/dual-sync/registry.py status
python3 scripts/dual-sync/schema.py --import-registry
python3 scripts/dual-sync/upgrade.py
bash scripts/dual-sync/doctor.sh
```

## Add a device later

1. Add block under `devices:` in `config/dual-sync.registry.local.yaml`
2. `bash scripts/swarm-join.sh --name <mesh-name>`
3. `bash scripts/dual-sync/init.sh sync --mesh <mesh-name>`
4. `python3 scripts/dual-sync/upgrade.py`

## Add an operator (paid)

1. Add `principals:` + `sync_pairs:` entries (or use provision script when live)
2. Enable only modules they purchased — see `modules_catalog` pricing anchors
3. `bash scripts/dual-sync/init.sh operator --org <org-slug>`

Numbers never go in git — `.local.yaml` only.
