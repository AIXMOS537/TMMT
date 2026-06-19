#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# oneshot.sh — ONE command. Updates all your tools, then shows your control board.
# Run it anytime. Safe: only refreshes tools, never touches your other work.
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
BR="claude/team-absence-notification-0rYgo"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT"

printf "\033[2m⏳ updating your tools…\033[0m\n"
git fetch origin -q 2>/dev/null || true
# checkout each path INDEPENDENTLY so one missing path can't abort the rest
for p in scripts dist docs content config; do
  git checkout "origin/$BR" -- "$p" 2>/dev/null || true
done
chmod +x scripts/*.sh dist/*.command 2>/dev/null || true

clear 2>/dev/null || true
cat <<'B'
[1m╔══════════════════════════════════════════════════╗
║   👑  TMMT — YOUR CONTROL BOARD                   ║
╚══════════════════════════════════════════════════╝[0m
B
printf "\033[42;30m  📤 ONBOARD someone  \033[0m  open the files to send →  \033[1mopen dist\033[0m\n"
printf "\033[44;97m  🪪 GRANT someone    \033[0m  say YES to a card     →  \033[1mbash scripts/grant.sh <their-card.txt>\033[0m\n"
printf "\033[44;97m  👥 WHO'S IN         \033[0m  see your operators    →  \033[1mbash scripts/grant.sh list\033[0m\n"
printf "\033[43;30m  🔐 SECURE MY STUFF  \033[0m  your top accounts     →  \033[1mbash scripts/account-hardening.sh top\033[0m\n"
printf "\033[43;30m  🛡️  CHECK AN AD      \033[0m  safe to post?         →  \033[1mbash scripts/check-my-ad.sh my-ad.txt\033[0m\n"
printf "\033[46;30m  📍 WHERE AM I       \033[0m  DEV / TEST / PROD     →  \033[1mbash scripts/whereami.sh\033[0m\n"
printf "\033[46;30m  ❤️  WHO'S ONLINE     \033[0m  device heartbeats     →  \033[1mbash scripts/heartbeat.sh status\033[0m\n"
printf "\033[45;97m  🔎 SCAN THIS MAC    \033[0m  is it clean?          →  \033[1mbash scripts/device-integrity.sh\033[0m\n"
echo
printf "\033[2m  the gate: nobody gets in without your YES. you start everyone in DEV.\033[0m\n"
printf "\033[2m  tip — make this one word:  echo \"alias tmmt='bash $ROOT/scripts/oneshot.sh'\" >> ~/.zshrc\033[0m\n"
echo
printf "\033[1m  one step at a time. you got this. 🔒\033[0m\n"
