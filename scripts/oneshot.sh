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
printf "\033[1;96m── MISSION ──────────────────────────────\033[0m\n"
printf "\033[103;30m  👑 CEO BRIEF       \033[0m your 30-sec morning   →  \033[1mbash scripts/ceo.sh\033[0m\n"
printf "\033[104;97m  📜 CONSTITUTION    \033[0m the why + the law     →  \033[1mopen docs/AIXMOS-CONSTITUTION.md\033[0m\n"
printf "\033[105;97m  📥 MY QUEUE        \033[0m decisions waiting     →  \033[1mbash scripts/queue.sh\033[0m\n"
printf "\033[100;97m  ⭐ THE STANDARD    \033[0m the bar for everyone  →  \033[1mopen docs/OPERATOR-STANDARDS.md\033[0m\n"
printf "\033[42;97m  🚀 GO LIVE         \033[0m road to the 1st \$\$    →  \033[1mbash scripts/launch.sh\033[0m\n"
printf "\033[106;30m  🩺 IS IT READY?    \033[0m open-the-franchise check →  \033[1mbash scripts/doctor.sh\033[0m\n"
printf "\033[1;96m── MONEY ────────────────────────────────\033[0m\n"
printf "\033[42;30m  💵 LOG A DEAL      \033[0m who/what/cut · PAID UP →  \033[1mbash scripts/deal.sh add --who \"X\" --amount 5000 --cut 50%% --paid\033[0m\n"
printf "\033[103;30m  💰 THE BOOKS       \033[0m collected · your cut  →  \033[1mbash scripts/deal.sh summary\033[0m\n"
printf "\033[101;97m  ⛔ UNPAID/HOLD     \033[0m no pay, no work       →  \033[1mbash scripts/deal.sh hold\033[0m\n"
printf "\033[46;30m  🚗 CAR HANDOVER    \033[0m gate before keys move →  \033[1mbash scripts/handover.sh <partner>\033[0m\n"
printf "\033[1;96m── BUILD & SCALE ────────────────────────\033[0m\n"
printf "\033[102;30m  📈 NEW BUSINESS    \033[0m stamp a whole one     →  \033[1mbash scripts/new-business.sh \"Name\" --agency x\033[0m\n"
printf "\033[102;30m  🏗️  LAUNCH EDITION  \033[0m backend-less bundle   →  \033[1mbash scripts/build-projectaixmos-legacy.sh --apply --git\033[0m\n"
printf "\033[103;30m  💰 CUT COSTS       \033[0m kill bleed + rot      →  \033[1mbash scripts/costcut.sh\033[0m\n"
printf "\033[1;96m── PEOPLE ───────────────────────────────\033[0m\n"
printf "\033[42;30m  📤 ONBOARD         \033[0m send the file         →  \033[1mopen dist\033[0m\n"
printf "\033[44;97m  🪪 GRANT           \033[0m say YES to a card     →  \033[1mbash scripts/grant.sh <card.txt>\033[0m\n"
printf "\033[44;97m  👥 WHO'S IN        \033[0m your operators        →  \033[1mbash scripts/grant.sh list\033[0m\n"
printf "\033[101;97m  🚪 REVOKE          \033[0m put someone OUT       →  \033[1mbash scripts/revoke.sh <name> [--breach]\033[0m\n"
printf "\033[1;96m── SECURITY ─────────────────────────────\033[0m\n"
printf "\033[41;97m  🛰️  SENTRY          \033[0m HAILMARY watch perimeter →  \033[1mbash scripts/sentry.sh\033[0m\n"
printf "\033[41;97m  🛡️  PROTECT ME      \033[0m guardian full sweep   →  \033[1mbash scripts/protect.sh\033[0m\n"
printf "\033[101;97m  🔑 MASTER KEY      \033[0m phrase + code         →  \033[1mbash scripts/master-key.sh unlock\033[0m\n"
printf "\033[43;30m  🔐 SECURE MY STUFF \033[0m your top accounts     →  \033[1mbash scripts/account-hardening.sh top\033[0m\n"
printf "\033[45;97m  🔎 SCAN THIS MAC   \033[0m is it clean?          →  \033[1mbash scripts/device-integrity.sh\033[0m\n"
printf "\033[46;30m  ❤️  WHO'S ONLINE    \033[0m device heartbeats     →  \033[1mbash scripts/heartbeat.sh status\033[0m\n"
printf "\033[1;96m── WORK ─────────────────────────────────\033[0m\n"
printf "\033[43;30m  🛡️  CHECK AN AD     \033[0m safe to post?         →  \033[1mbash scripts/check-my-ad.sh my-ad.txt\033[0m\n"
printf "\033[46;30m  📍 WHERE AM I      \033[0m DEV / TEST / PROD     →  \033[1mbash scripts/whereami.sh\033[0m\n"
echo
printf "\033[2m  the gate: nobody gets in without your YES. everyone starts in DEV. type 'x' anytime.\033[0m\n"
echo
printf "\033[1m  one step at a time. you got this. 🔒\033[0m\n"
