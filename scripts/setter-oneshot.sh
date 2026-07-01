#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# setter-oneshot.sh — Justin's ONE command. The AIXMOS appointment-setter board.
# Lane: book qualified calls for AIXMOS offers. Learn · Earn · Churn.
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
chmod +x scripts/*.sh 2>/dev/null || true

clear 2>/dev/null || true
cat <<'B'
[1m╔══════════════════════════════════════════════════╗
║   🇵🇭  AIXMOS — SETTER BOARD  (Justin)            ║
║       Book calls · Learn · Earn · Churn           ║
╚══════════════════════════════════════════════════╝[0m
B
printf "\033[42;30m  🎓 LEARN THE OFFERS  \033[0m  read your playbook   →  \033[1mopen docs/kits/AIXMOS-SETTER-KIT.md\033[0m\n"
printf "\033[42;30m  💬 MY SCRIPTS        \033[0m  openers + booking    →  \033[1mopen docs/kits/AIXMOS-SETTER-KIT.md\033[0m (section 4)\n"
printf "\033[43;30m  🔐 SECURE MY STUFF   \033[0m  lock my accounts     →  \033[1mbash scripts/account-hardening.sh top\033[0m\n"
printf "\033[46;30m  📍 WHERE AM I        \033[0m  DEV / TEST / PROD    →  \033[1mbash scripts/whereami.sh\033[0m\n"
echo
printf "\033[1m  YOUR JOB:\033[0m book qualified, show-up calls for the owner. You set — owner closes.\n"
printf "\033[1m  THE LADDER:\033[0m entry → builds → 💎 \$50K full stack → 🛒 \$25K done-for-you ecom (soon).\n"
printf "\033[2m  truth only — no guarantees, no invented prices. book the call; the owner delivers.\033[0m\n"
printf "\033[2m  confidential always. you see only your leads. you report up to the owner.\033[0m\n"
echo
printf "\033[2m  make this one word:  echo \"alias setter='bash $ROOT/scripts/setter-oneshot.sh'\" >> ~/.zshrc\033[0m\n"
echo
printf "\033[1m  Learn. Earn. Churn. 🇵🇭👑\033[0m\n"
