#!/bin/bash
# ============================================================
# AIXMOS SYNC — keep the Claude Code repo 1:1 with the mesh
# Pulls the master project from the NAS into the repo, refreshes
# the reference doc, commits, and pushes. Run from the carry Mac.
#
#   bash aixmos_sync.sh            # one sync now
#   bash aixmos_sync.sh --install  # also install hourly auto-sync
# ============================================================
set -euo pipefail

# ---- EDIT THESE PATHS ----
REPO_DIR="$HOME/AIXMOS/repo"                                   # your Claude Code repo
NAS_MASTER="/Volumes/AIXMOS/master/AIXMOS_MASTER_PROJECT.md"   # master file on NAS
BRANCH="main"
# --------------------------

say(){ printf "\n\033[1;36m▸ %s\033[0m\n" "$1"; }
ok(){ printf "  \033[1;32m✓ %s\033[0m\n" "$1"; }
die(){ printf "  \033[1;31m✗ %s\033[0m\n" "$1"; exit 1; }

# --install: set up an hourly launch agent, then exit
if [ "${1:-}" = "--install" ]; then
  say "Installing hourly auto-sync agent"
  PLIST="$HOME/Library/LaunchAgents/com.aixmos.sync.plist"
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.aixmos.sync</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$PWD/aixmos_sync.sh</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardErrorPath</key><string>/tmp/aixmos-sync.err</string>
  <key>StandardOutPath</key><string>/tmp/aixmos-sync.out</string>
</dict></plist>
PL
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
  ok "Auto-sync every hour. Logs: /tmp/aixmos-sync.out"
  exit 0
fi

# 1. Sanity
say "Checking paths"
[ -d "$REPO_DIR/.git" ] || die "REPO_DIR is not a git repo: $REPO_DIR"
[ -f "$NAS_MASTER" ]   || die "Master not found (NAS mounted?): $NAS_MASTER"
ok "Repo + master found"

cd "$REPO_DIR"

# 2. Pull latest so we don't fight history
say "Pulling latest"
git pull --rebase --autostash origin "$BRANCH" || die "git pull failed"
ok "Up to date"

# 3. Copy master into the repo's docs/ (the reference layer)
say "Syncing master → repo"
mkdir -p docs
cp "$NAS_MASTER" docs/AIXMOS_MASTER_PROJECT.md
ok "docs/AIXMOS_MASTER_PROJECT.md refreshed"

# 4. Commit only if something changed
say "Committing"
if git diff --quiet && git diff --cached --quiet; then
  ok "No changes — nothing to commit"
else
  git add docs/AIXMOS_MASTER_PROJECT.md
  git commit -m "sync: master project $(date '+%Y-%m-%d %H:%M')"
  git push origin "$BRANCH" || die "git push failed"
  ok "Pushed to origin/$BRANCH"
fi

say "DONE — repo is 1:1 with the mesh"
