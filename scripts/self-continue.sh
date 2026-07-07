#!/usr/bin/env bash
# self-continue — the loop that keeps working after you've forgotten the session.
# Each cycle: pull, run ONE safe backlog item via headless Claude (bound by
# .aixmos/autopilot/CHARTER.md), then THE LOOP verifies green and pushes. If the
# agent left anything red or dirty-but-broken, the loop reverts it — so autopilot
# can NEVER leave the branch broken, never touches master, money, or gated work.
#
#   bash scripts/self-continue.sh once      run one cycle now (default)
#   bash scripts/self-continue.sh loop      keep cycling every AUTOPILOT_INTERVAL sec
#   bash scripts/self-continue.sh install   macOS LaunchAgent (auto, every 3h) — no involvement
#   bash scripts/self-continue.sh uninstall remove it
#
# Env:
#   AUTOPILOT_BRANCH   branch to work on (default: current; NEVER master/main)
#   AUTOPILOT_INTERVAL seconds between loop cycles (default 10800 = 3h)
#   CLAUDE_BIN         claude binary (default: claude)
#   CLAUDE_FLAGS       headless flags (default: -p --permission-mode acceptEdits)
#                      full unattended: export CLAUDE_FLAGS='-p --dangerously-skip-permissions'
#   CLAUDE_MODEL       optional model override
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT" || exit 1
MODE="${1:-once}"
LABEL="com.tmmt.self-continue"
PLIST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LEDGER="$ROOT/.aixmos/autopilot/ledger.ndjson"
INTERVAL="${AUTOPILOT_INTERVAL:-10800}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
CLAUDE_FLAGS="${CLAUDE_FLAGS:--p --permission-mode acceptEdits}"
mkdir -p "$ROOT/.aixmos/autopilot" 2>/dev/null
if [[ -t 1 ]]; then G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; BD=$'\e[1m'; X=$'\e[0m'; else G=; Y=; R=; BD=; X=; fi
led(){ echo "{\"ts\":\"$(date -u +%FT%TZ)\",\"event\":\"$1\",\"detail\":\"${2:-}\"}" >> "$LEDGER" 2>/dev/null || true; }
say(){ printf '%s🌙 self-continue:%s %s\n' "$BD" "$X" "$*"; }

# ── install / uninstall (fire-and-forget) ─────────────────────────────────────
if [ "$MODE" = "install" ]; then
  if [[ "$(uname -s)" != Darwin ]]; then
    echo "Not macOS. Cron it:  (crontab -l 2>/dev/null; echo \"0 */3 * * * cd $ROOT && bash scripts/self-continue.sh once\") | crontab -"
    exit 0
  fi
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>${ROOT}/scripts/self-continue.sh</string><string>once</string></array>
  <key>StartInterval</key><integer>${INTERVAL}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${ROOT}/.aixmos/autopilot/launchd.log</string>
  <key>StandardErrorPath</key><string>${ROOT}/.aixmos/autopilot/launchd.log</string>
</dict></plist>
PL
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  launchctl load "$PLIST" 2>/dev/null && echo "${G}✓ self-continue installed — every $((INTERVAL/3600))h, no involvement.${X}" \
    || echo "${Y}• wrote $PLIST — load with: launchctl load $PLIST${X}"
  exit 0
fi
if [ "$MODE" = "uninstall" ]; then
  launchctl unload "$PLIST" >/dev/null 2>&1 || true; rm -f "$PLIST"; echo "■ self-continue removed."; exit 0
fi

# ── one cycle ─────────────────────────────────────────────────────────────────
cycle(){
  # kill-switch
  if [ -f "$ROOT/.swarm/DARK" ]; then say "DARK — paused."; led paused DARK; return 0; fi

  local branch; branch="${AUTOPILOT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
  case "$branch" in main|master) say "refusing to run on $branch — set AUTOPILOT_BRANCH to a work branch."; led refused "$branch"; return 1;; esac
  git rev-parse --abbrev-ref HEAD | grep -qx "$branch" || git checkout "$branch" >/dev/null 2>&1 || { say "can't checkout $branch"; led error "checkout $branch"; return 1; }

  # refuse to run on a dirty tree — never mix autopilot work with in-flight edits
  if [ -n "$(git status --porcelain)" ]; then say "working tree dirty — skipping this cycle."; led skipped dirty; return 0; fi

  git fetch origin "$branch" >/dev/null 2>&1 || true
  git pull --ff-only origin "$branch" >/dev/null 2>&1 || true
  local before; before="$(git rev-parse HEAD)"

  if ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then say "claude CLI not found ($CLAUDE_BIN)"; led error "no-claude"; return 1; fi

  say "working one item…"; led start "$branch"
  local model_flag=""; [ -n "${CLAUDE_MODEL:-}" ] && model_flag="--model $CLAUDE_MODEL"
  local prompt
  prompt="Read .aixmos/autopilot/CHARTER.md and obey it as hard rules. Then do the SINGLE next safe item from .aixmos/autopilot/QUEUE.md (fall back to PLAN.md). Make the change, keep tsc and tests green, and COMMIT LOCALLY with a clear message. Do NOT push and do NOT touch main/master, money, live surfaces, or anything gated. If there is nothing safe to do, make no changes and say so."
  # shellcheck disable=SC2086
  timeout "${AUTOPILOT_MAX_SECONDS:-1800}" "$CLAUDE_BIN" $CLAUDE_FLAGS $model_flag --append-system-prompt "$(cat "$ROOT/.aixmos/autopilot/CHARTER.md")" "$prompt" \
    >> "$ROOT/.aixmos/autopilot/run.log" 2>&1 || { say "agent run errored (see run.log)"; led error "agent-run"; }

  local after; after="$(git rev-parse HEAD)"
  if [ "$after" = "$before" ]; then
    # nothing committed — either nothing to do, or agent left junk in the tree
    if [ -n "$(git status --porcelain)" ]; then git checkout -- . >/dev/null 2>&1; git clean -fd >/dev/null 2>&1 || true; say "no commit; cleaned scratch."; led noop uncommitted
    else say "nothing safe to do this cycle."; led noop clean; fi
    return 0
  fi

  # THE LOOP is the gate: verify green before anything leaves the machine.
  say "verifying green…"
  if npx tsc --noEmit >/dev/null 2>&1 && npm run -s test >/dev/null 2>&1; then
    git push -u origin "$branch" >/dev/null 2>&1 && { say "✓ shipped one item, green."; led shipped "$after"; } \
      || { say "green but push failed (network?) — left committed locally."; led push-failed "$after"; }
  else
    say "✗ agent left it RED — reverting to keep the branch clean."; led reverted "$after→$before"
    git reset --hard "$before" >/dev/null 2>&1 || true
  fi
}

if [ "$MODE" = "loop" ]; then
  say "looping every $((INTERVAL/60))m. Stop with: touch .swarm/DARK  (or kill this process)."
  while true; do cycle; [ -f "$ROOT/.swarm/DARK" ] && { say "DARK — exiting loop."; break; }; sleep "$INTERVAL"; done
else
  cycle
fi
