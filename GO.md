# GO — one paste, any computer

The whole base (HAILMARY + AIXMOS network + memory loop) in **one copy-paste**.
It finds the repo if you have it, clones it if you don't, updates it, and boots
everything in unison. **Paste the whole block as one line. Do not paste any `#`
comment text** — some shells choke on it.

---

## 🍎 Mac / Linux  (also Windows "Git Bash")

Open **Terminal** (Mac) — Spotlight `⌘Space`, type `Terminal`, Enter — and paste:

```bash
B=claude/organize-chats-sessions-7t7zjy; R=""; for d in ~/Projects/TMMT ~/projects/TMMT ~/TMMT ~/Documents/TMMT ~/Desktop/TMMT; do [ -d "$d/.git" ] && R="$d" && break; done; [ -z "$R" ] && R=~/TMMT && git clone https://github.com/AIXMOS537/TMMT.git "$R"; cd "$R" && git stash -u >/dev/null 2>&1; git fetch origin "$B"; git checkout "$B"; git pull origin "$B"; bash scripts/go
```

That's it. After the first run you can just use the saved command anytime:

```bash
bash ~/TMMT/scripts/go
```

(or double-click **`TMMT-GO.command`** in the repo folder).

---

## 🪟 Windows  (PowerShell)

Needs **Git for Windows** installed (gives you `git` and `bash`). If you don't
have it: https://git-scm.com/download/win → Next-Next-Finish. Then open
**PowerShell** (Start → type `PowerShell`) and paste:

```powershell
$B="claude/organize-chats-sessions-7t7zjy"; $R=@("$HOME\Projects\TMMT","$HOME\TMMT","$HOME\Documents\TMMT") | ?{Test-Path "$_\.git"} | select -First 1; if(-not $R){$R="$HOME\TMMT"; git clone https://github.com/AIXMOS537/TMMT.git $R}; cd $R; git stash -u 2>$null; git fetch origin $B; git checkout $B; git pull origin $B; powershell -ExecutionPolicy Bypass -File scripts\go.ps1
```

Easiest Windows path overall: install Git, open **Git Bash**, and paste the
**Mac/Linux** one-liner above — it works there too.

---

## Optional: stream memory into the Obsidian vault (BRAINIAC)

By default memory stays local on the machine. To push it into the vault, set this
once before running `go` (use your real vault path):

```bash
export HAILMARY_VAULT="brainiac:/Users/brainiac/Obsidian/HAILMARY"
```

Windows PowerShell:

```powershell
$env:HAILMARY_VAULT="brainiac:/Users/brainiac/Obsidian/HAILMARY"
```

---

## What it does, in plain words

1. Finds (or clones) the TMMT repo.
2. Pulls the latest code.
3. Runs `scripts/go` → `scripts/tmmt unison` → **HAILMARY `booyah`** + memory loop
   + always-on presence. Everything online, as one.

Charters (the rules it lives by): `docs/HAILMARY-CHARTER.md`,
`docs/AIXMOS-CHARTER.md`. Owner-only (Muhammad Taha), local-first, never-sold.
