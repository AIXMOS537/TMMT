#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# moe-oneshot.sh — Moe Legacy's ONE command. His ProjectAixmos control board.
# Lane: credit repair · business funding · lead-gen. Runs from his bundle.
# ───────────────────────────────────────────────────────────────────────────
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
chmod +x scripts/*.sh 2>/dev/null || true

clear 2>/dev/null || true
cat <<'B'
[1m╔══════════════════════════════════════════════════╗
║   🔴  MOE LEGACY — ProjectAIXMOS                  ║
║       Credit · Funding · Lead-Gen                 ║
╚══════════════════════════════════════════════════╝[0m
B
printf "\033[42;30m  🛡️  CHECK AN AD       \033[0m  safe to post?       →  \033[1mbash scripts/check-my-ad.sh my-ad.txt\033[0m\n"
printf "\033[42;30m  📋 READY-TO-RUN ADS  \033[0m  compliant copy      →  \033[1mopen content/consumer-facing/redhood-ad-templates.md\033[0m\n"
printf "\033[43;30m  🔐 SECURE MY STUFF   \033[0m  lock my accounts    →  \033[1mbash scripts/account-hardening.sh top\033[0m\n"
printf "\033[46;30m  📍 WHERE AM I        \033[0m  DEV / TEST / PROD   →  \033[1mbash scripts/whereami.sh\033[0m\n"
printf "\033[45;97m  🔎 SCAN THIS MAC     \033[0m  is it clean?        →  \033[1mbash scripts/device-integrity.sh\033[0m\n"
echo
printf "\033[1m  YOUR JOB:\033[0m bring in credit + funding clients, run \033[1mcompliant\033[0m ads, close leads.\n"
printf "\033[2m  the rule: every ad must pass 🛡️ before it goes out. never say 'guaranteed' or '+points'.\033[0m\n"
printf "\033[2m  billing: you close — the owner clears the legal gate before anyone is charged.\033[0m\n"
printf "\033[2m  confidential always. you report up to the owner.\033[0m\n"
echo
printf "\033[2m  make this one word:  echo \"alias moe='bash $ROOT/scripts/moe-oneshot.sh'\" >> ~/.zshrc\033[0m\n"
echo
printf "\033[1m  one step at a time. 🔴👑\033[0m\n"
