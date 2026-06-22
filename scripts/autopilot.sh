#!/usr/bin/env bash
# autopilot — the empire keeps itself. Runs the safe recurring upkeep on a schedule and
# only reaches the Owner when a HUMAN is truly needed (a real failure or a decision).
# Silent on success — no news is good news. Bare-minimum involvement, by design.
#
#   bash scripts/autopilot.sh            run one maintenance cycle now
#   bash scripts/autopilot.sh check      read-only checks (no sync, no notify)
#   bash scripts/autopilot.sh install    lay a macOS LaunchAgent (auto, every 3h)
#   bash scripts/autopilot.sh uninstall  remove it
#   bash scripts/tmmt autopilot
#
# Upkeep each cycle: sync (lockstep) · containment (no leak) · selftest (won't fold) ·
# parity/drift · health (verticals) · memory absorb. Honors DARK. Never touches prod or
# secrets. Escalation is best-effort over the mesh notify rail.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
MODE="${1:-cycle}"
LABEL="com.tmmt.autopilot"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG="$ROOT/.hailmary/autopilot.log"; STATUS="$ROOT/.hailmary/autopilot-status"
INTERVAL="${AUTOPILOT_INTERVAL:-10800}"   # 3h
mkdir -p "$ROOT/.hailmary" 2>/dev/null
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; BD=; X=; fi
log(){ echo "$(date -u +%FT%TZ) $*" >> "$LOG" 2>/dev/null || true; }

# ── install / uninstall a macOS LaunchAgent (no involvement after this) ──
if [ "$MODE" = "install" ]; then
  if [[ "$(uname -s)" != Darwin ]]; then
    echo "Not macOS. Schedule with cron:  (crontab -l 2>/dev/null; echo \"0 */3 * * * cd $ROOT && bash scripts/autopilot.sh cycle\") | crontab -"
    exit 0
  fi
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>${ROOT}/scripts/autopilot.sh</string><string>cycle</string></array>
  <key>StartInterval</key><integer>${INTERVAL}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${LOG}</string>
  <key>StandardErrorPath</key><string>${LOG}</string>
</dict></plist>
PL
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  launchctl load "$PLIST" 2>/dev/null && echo "${G}✓ autopilot installed — runs every $((INTERVAL/3600))h, no involvement.${X}" \
    || echo "${Y}• wrote $PLIST — load with: launchctl load $PLIST${X}"
  exit 0
fi
if [ "$MODE" = "uninstall" ]; then
  launchctl unload "$PLIST" >/dev/null 2>&1 || true; rm -f "$PLIST"; echo "■ autopilot removed."; exit 0
fi

# ── DARK respects the kill-switch ──
if [ -f "$ROOT/.swarm/DARK" ]; then echo "⛔ DARK — autopilot paused."; log "skipped: DARK"; exit 0; fi

ISSUES=(); INFO=()
note_issue(){ ISSUES+=("$1"); }
note_info(){ INFO+=("$1"); }

printf '%s🛰️  AUTOPILOT — maintenance cycle%s\n' "$BD" "$X"

# 1) containment — must stay sealed
if bash "$ROOT/scripts/containment.sh" --gate >/dev/null 2>&1; then printf '   %s✓ sealed%s\n' "$G" "$X"; else printf '   %s✗ containment leak%s\n' "$R" "$X"; note_issue "CONTAINMENT FAIL — a secret/exposure leak (run: tmmt barn)"; fi

# 2) selftest — must still hold
if bash "$ROOT/scripts/selftest.sh" >/dev/null 2>&1; then printf '   %s✓ held (selftest)%s\n' "$G" "$X"; else printf '   %s✗ selftest cracked%s\n' "$R" "$X"; note_issue "SELFTEST FAIL — something cracked (run: tmmt selftest)"; fi

# 3) sync — keep machines in lockstep (skipped in 'check' mode)
if [ "$MODE" = "cycle" ]; then
  if bash "$ROOT/scripts/sync-machine.sh" >/dev/null 2>&1; then printf '   %s✓ synced%s\n' "$G" "$X"; else printf '   %s• sync needs attention%s\n' "$Y" "$X"; note_issue "SYNC blocked — likely a merge conflict or the gitleaks push-block (needs you)"; fi
else printf '   • sync skipped (check mode)\n'; fi

# 4) health — are the verticals up
if [ -x "$ROOT/scripts/health.sh" ]; then
  hout="$(bash "$ROOT/scripts/health.sh" --compact 2>/dev/null || true)"
  if echo "$hout" | grep -qiE "DOWN|✗|5[0-9][0-9]|000"; then printf '   %s• a vertical looks down%s\n' "$Y" "$X"; note_issue "a vertical is DOWN (run: tmmt health)"; else printf '   %s✓ verticals up%s\n' "$G" "$X"; fi
fi

# 5) memory — keep HAILMARY current (silent, best-effort)
bash "$ROOT/scripts/hailmary" absorb >/dev/null 2>&1 && printf '   %s✓ memory absorbed%s\n' "$G" "$X" || true

# ── result ──
TS="$(date -u +%FT%TZ)"
if [ "${#ISSUES[@]}" -eq 0 ]; then
  echo "$TS OK" > "$STATUS"; log "cycle OK"
  printf '\n%s🛰️  all good — nothing needs you.%s\n' "$G" "$X"
else
  { echo "$TS NEEDS-YOU"; printf '%s\n' "${ISSUES[@]}"; } > "$STATUS"; log "cycle NEEDS-YOU: ${ISSUES[*]}"
  printf '\n%s🛰️  %s item(s) need a human:%s\n' "$BD" "${#ISSUES[@]}" "$X"
  for i in "${ISSUES[@]}"; do printf '     • %s\n' "$i"; done
  # best-effort escalation over the mesh notify rail (only on real issues)
  [ "$MODE" = "cycle" ] && bash "$ROOT/scripts/mesh/link.sh" request "autopilot: ${ISSUES[*]}" >/dev/null 2>&1 || true
fi
