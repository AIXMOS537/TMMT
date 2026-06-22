# Launch My Agency + Moe Legacy — intake drop zone

Drop anything here so Watchtower / Cursor can triage it **without** logging into your phone or Instagram.

## What to drop (from iPhone on Carry M5)

1. **Airdrop or export to this folder:**
   - Sales scripts, PDFs, screenshots of DMs
   - Voice memos (`.m4a`) — export from Voice Memos → Share → Save to Files
   - Reels you want analyzed — save from Instagram → "Save video" → Files → copy here
   - Photos of whiteboards, contracts, LMA onboarding docs

2. **Suggested subfolders:**
   ```
   imports/lma-intake/
     media/          # videos, photos, reels saved from phone
     scripts/        # call scripts, objection handlers
     lma/            # Launch My Agency onboarding / SOPs
     moe-legacy/     # Moe Legacy client lists (no passwords)
     instagram/      # exported captions, link lists, analytics CSVs
   ```

## Instagram (all accounts)

Cursor **cannot** log into Instagram. Do one of these instead:

| Method | What to export |
|--------|----------------|
| Save reel to Files | Drop video in `media/` |
| Screenshot carousel / script | Drop PNG in `media/` |
| Meta Business Suite | Export post list / insights CSV → `instagram/` |
| Copy-paste | Put URLs + captions in `instagram/links.txt` |

## Work phone (M1 Mac at home, separate iCloud)

That device is **not** on this Carry Mac unless you sync it. Pick one:

1. **Syncthing** — create `~/Sync/work-phone-intake/` on M1, sync to Carry M5 `~/Sync/work-phone-intake/`
2. **iCloud** — export from work phone → save to a folder both machines share
3. **Tailscale** — from Carry M5: `scp brainiac:~/path/to/export/* imports/lma-intake/work-phone/`

Then run: `bash scripts/lma-one-shot.sh scan-intake`

## Never put here (git repo)

- Passwords, API keys, 2FA backup codes
- Full client SSN / full credit reports
- Raw GHL admin credentials

Use `.env.local` / Vercel for secrets. Tell the agent "credential exists" without pasting values.

## After you drop files

```bash
cd ~/Projects/TMMT
bash scripts/lma-one-shot.sh scan-intake
bash scripts/lma-one-shot.sh shift        # full pre-shift readiness
```
