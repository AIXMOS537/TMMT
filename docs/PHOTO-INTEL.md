# Photo Intel — local, private image-signal reader

Reads the images that land on a Mac (Photos/iCloud, OneDrive, Downloads — where
TikTok/Snap/IG/FB/Telegram saves end up via Camera Roll → iCloud) and infers
**what the owner is focused on / trying to get done**, using a **local vision
model (Ollama)**. Nothing is uploaded. Owner = test subject #1, then Moe (their
own device, with consent).

## What it can and can't do (honest)
- ✅ Analyze images **you saved/synced** to this Mac — the real signal of what the
  feeds served you and what you cared enough to keep.
- ✅ Run 100% locally (privacy) and write a plain-English read to the brain.
- ❌ It cannot reach inside TikTok/IG/FB servers or read their recommendation
  algorithms. The saved images are the legal, doable proxy for "the algo."

## Run it
On the Mac (in the repo):
```
git fetch origin claude/text-number-current-setup-mfmn1f
git checkout FETCH_HEAD -- scripts/photo-intel.sh
ollama pull llama3.2-vision          # one-time, local vision model
bash scripts/photo-intel.sh ~/Pictures --limit 40
# include OneDrive / Downloads:
bash scripts/photo-intel.sh "$HOME/Library/CloudStorage/OneDrive-Personal/Pictures" --limit 50 --push
```
- `--push` writes the read to the brain (needs `~/.hailmary/config.env`).
- Idempotent: already-seen images are skipped (`~/.hailmary/photo-intel-seen.txt`).
- HEIC handled via macOS `sips`.

## Do it in Cursor (paste to Claude in Cursor on the work Mac)

**1) Setup**
> "Confirm Ollama is running and pull `llama3.2-vision` if missing. Get
> `scripts/photo-intel.sh` from branch `claude/text-number-current-setup-mfmn1f`.
> List my likely image folders (Photos, OneDrive, Downloads) and ask which to use."

**2) Run**
> "Run `scripts/photo-intel.sh` on those folders `--limit 40`, show the per-image
> intents + the final 'owner focus' summary, then re-run with `--push` to write
> it to the brain. Keep it 100% local — never upload my photos."

## iPhone → Mac (so the images are there to read)
Make sure the apps save to a place the Mac sees:
- **Camera Roll** → iCloud Photos on → appears in macOS Photos.
- **OneDrive** app → camera upload on → `~/Library/CloudStorage/OneDrive-*/Pictures`.
- Saved IG/FB/TikTok/Telegram media usually land in Camera Roll → iCloud → Mac.
The Mac is the analysis hub; the iPhone just needs to sync.

## Privacy / consent
Local-only, your own device, your own library. For Moe, run on **his** Mac with
his consent. No third-party data scraping.
