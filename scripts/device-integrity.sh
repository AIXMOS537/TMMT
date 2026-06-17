#!/usr/bin/env bash
#
# device-integrity.sh — read-only compromise scan for a machine on the mesh.
# Looks for the common backdoor/persistence footholds and flags anything to
# review. Read-only. Redacts key material. Run on each device (carry Mac, work
# Mac, brainiac, operator TRAPTOPs).
# ---------------------------------------------------------------------------
#   scripts/device-integrity.sh
#
# It does NOT remove anything — it reports, so you decide. Exit 1 if anything
# was flagged for review (gate-friendly), 0 if nothing stood out.
# ---------------------------------------------------------------------------
set -uo pipefail
bold(){ printf "\033[1m%s\033[0m\n" "$1"; }
ok(){ printf "\033[32m✓\033[0m %s\n" "$1"; }
flag(){ printf "\033[33m⚑ %s\033[0m\n" "$1"; FOUND=$((FOUND+1)); }
note(){ printf "  %s\n" "$1"; }
FOUND=0
OS="$(uname -s)"
mkdir -p .aixmos 2>/dev/null || true
REPORT=".aixmos/integrity-$(hostname)-$(date -u +%Y%m%dT%H%M%SZ).txt"
exec > >(tee "$REPORT") 2>&1

bold "== device-integrity == host=$(hostname) os=$OS $(date -u +%FT%TZ)"

# 1. SSH authorized_keys — who can log in as you (show fingerprint, NOT the key)
bold "[1] SSH authorized_keys"
ak="$HOME/.ssh/authorized_keys"
if [ -f "$ak" ]; then
  n=$(grep -c . "$ak" 2>/dev/null || echo 0)
  flag "$n key(s) can SSH into this account — confirm you recognize each:"
  while IFS= read -r line; do [ -n "$line" ] || continue
    fp=$(printf '%s\n' "$line" | ssh-keygen -lf /dev/stdin 2>/dev/null || echo "unparseable")
    note "$fp"
  done < "$ak"
else ok "no authorized_keys (no inbound SSH trust)"; fi

# 2. Persistence — launch agents/daemons (mac) or cron/systemd (linux)
bold "[2] Auto-start / persistence"
if [ "$OS" = Darwin ]; then
  for d in "$HOME/Library/LaunchAgents" /Library/LaunchAgents /Library/LaunchDaemons; do
    [ -d "$d" ] || continue
    for p in "$d"/*.plist; do [ -e "$p" ] || continue
      prog=$(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments' "$p" 2>/dev/null | tr '\n' ' ')
      if printf '%s' "$prog" | grep -qiE 'curl|wget|/tmp/|base64|bash -c|nc |ncat|python -c'; then
        flag "suspicious LaunchItem: $p"; note "$prog"
      fi
    done
  done
  [ "$FOUND" -gt 0 ] || ok "no obviously suspicious launch items"
else
  crontab -l 2>/dev/null | grep -vE '^\s*#|^\s*$' | while read -r c; do note "cron: $c"; done
  command -v systemctl >/dev/null && systemctl list-units --type=service --state=running --no-legend 2>/dev/null | grep -iE 'tmp|/home/.*/\.' && flag "user-path service running" || ok "no user-path services flagged"
fi

# 3. Shell rc tampering (reverse-shell / fetch-and-run patterns)
bold "[3] Shell startup files"
for rc in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
  [ -f "$rc" ] || continue
  if grep -nEi 'curl[^|]*\|\s*(sh|bash)|wget[^|]*\|\s*(sh|bash)|base64\s+-d|/dev/tcp/|bash -i|nc -e' "$rc" >/tmp/_rc 2>/dev/null && [ -s /tmp/_rc ]; then
    flag "review $rc:"; sed 's/^/    /' /tmp/_rc
  fi
done
[ -f /tmp/_rc ] && rm -f /tmp/_rc
[ "$FOUND" -gt 0 ] || ok "no fetch-and-run patterns in shell rc"

# 4. Listening network services
bold "[4] Listening ports (who can reach in)"
if command -v lsof >/dev/null; then lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR==1||$1!="" {print "  "$1"  "$9}' | head -25
elif command -v ss >/dev/null; then ss -ltnp 2>/dev/null | head -25 | sed 's/^/  /'
else note "(no lsof/ss)"; fi
note "↑ confirm each is a service you started (databases, ollama:11434, etc.)"

# 5. /etc/hosts tampering (redirect to fake sites)
bold "[5] /etc/hosts"
if grep -vE '^\s*#|^\s*$|127\.0\.0\.1|::1|255\.255\.255\.255|broadcasthost|^fe80' /etc/hosts 2>/dev/null | grep -q .; then
  flag "non-default /etc/hosts entries — confirm intentional:"
  grep -vE '^\s*#|^\s*$|127\.0\.0\.1|::1|255\.255\.255\.255|broadcasthost|^fe80' /etc/hosts | sed 's/^/    /'
else ok "/etc/hosts looks default"; fi

# 6. Git remotes here (code could be pushed somewhere you don't expect)
bold "[6] Git remotes in this repo"
if git rev-parse --git-dir >/dev/null 2>&1; then
  git remote -v | sed 's/^/  /'
  git remote -v | grep -qiE 'github\.com[:/]AIXMOS537/' || flag "a remote is NOT your AIXMOS537 GitHub — confirm it"
else note "(not a git repo)"; fi

echo
if [ "$FOUND" -gt 0 ]; then bold "⚑ $FOUND item(s) flagged for your review — report: $REPORT"; exit 1
else bold "✓ nothing stood out. report: $REPORT"; exit 0; fi
