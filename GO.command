#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# GO — the one front door. Double-click it, or run:  bash GO.command
#
# What it does, in order, and NOTHING it shouldn't:
#   1. brings this machine to a known-good state (online → refresh; offline → skip)
#   2. runs YOUR gates — secrets/containment, compliance posture, selftest, doctor
#   3. prints ONE honest verdict. "READY TO TRANSACT" appears ONLY when every hard
#      gate is green. If a gate fails (e.g. a secret in git history) it BLOCKS and
#      tells you the exact fix — it will not lie that you're ready.
#   4. when green: joins the mesh (best-effort) and surfaces owner-approval work.
#
# What it will NEVER do: send a customer message, charge/pay/move money, sign, ship,
# deploy, or push anything on-chain. Those terminate at the OWNER-APPROVAL GATE
# (CLAUDE.md §2) and, for regulated verticals, the compliance gates. This front door
# CERTIFIES readiness and surfaces the work — a human still says "go" on every
# money/customer/legal/on-chain action. That is the design, not a limitation.
# ═══════════════════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(dirname "$0")" 2>/dev/null || true

if [[ -t 1 ]]; then G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; C=$'\e[36m'; BD=$'\e[1m'; X=$'\e[0m'
else G=; R=; Y=; C=; BD=; X=; fi
say(){ printf '%s\n' "$*"; }
step(){ printf '\n%s%s══ %s ══%s\n' "$C" "$BD" "$*" "$X"; }
ok(){   printf '   %s✓%s %s\n' "$G" "$X" "$*"; }
bad(){  printf '   %s✗%s %s\n' "$R" "$X" "$*"; }
soft(){ printf '   %s•%s %s\n' "$Y" "$X" "$*"; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"; cd "$ROOT" || exit 1
BLOCKERS=()

printf '%s' "$BD"
cat <<'BANNER'
   ╔══════════════════════════════════════════════════╗
   ║   G O  ·  AIXMOS / TMMT front door                ║
   ║   prove ready → surface work → owner says go      ║
   ╚══════════════════════════════════════════════════╝
BANNER
printf '%s' "$X"

# ── DARK kill-switch ────────────────────────────────────────────────────────────
if [[ -f "$ROOT/.swarm/DARK" ]]; then
  say "${Y}⛔ DARK — everything is stopped. Lift with: bash scripts/godark lift${X}"; exit 0
fi

# ── Phase 1 — SELF (online → refresh; offline → skip, don't fail) ───────────────
step "1 · self"
if curl -sfI --max-time 4 https://api.github.com >/dev/null 2>&1; then
  ok "online"
  git pull --ff-only origin master >/dev/null 2>&1 && ok "repo up to date" \
    || soft "couldn't fast-forward (local changes?) — continuing with what's here"
else
  soft "offline — skipping refresh, running with the code already on this Mac"
fi

# ── Phase 2 — GATES (this is the whole point) ───────────────────────────────────
step "2 · gates"

# 2a) Containment / secrets — HARD. A tracked or historical secret blocks readiness.
if [[ -x scripts/containment.sh ]]; then
  if bash scripts/containment.sh --gate >/dev/null 2>&1; then ok "containment sealed — no secret leak"
  else bad "CONTAINMENT FAIL — a secret/exposure leak"; BLOCKERS+=("Secret/leak: run 'bash scripts/containment.sh' to see it. Rotate the key, then scrub history: scripts/scrub-history.sh --apply (runbook: docs/security/HISTORY-SCRUB-RUNBOOK.md)"); fi
else soft "containment.sh not present — cannot verify secrets"; fi

# 2b) Compliance posture — HARD only if the permanent CPN prohibition is off.
if command -v python3 >/dev/null 2>&1 && [[ -f shared/compliance-gates/check.py ]]; then
  cout="$(python3 shared/compliance-gates/check.py 2>/dev/null)"; crc=$?
  if [[ $crc -eq 0 ]]; then ok "compliance posture OK (VA-only, legal gates closed, CPN block active)"
  else bad "COMPLIANCE POSTURE VIOLATION"; say "$cout" | sed 's/^/       /'; BLOCKERS+=("Compliance: CPN/tradeline prohibition must be TRUE. Fix shared/compliance-gates/gates.config.json — never operate while this is off."); fi
else soft "compliance check unavailable (need python3) — verify gates by hand"; fi

# 2c) Owner-approval gate present — HARD. The money/customer/legal interlock.
if [[ -f .claude/hooks/owner-approval-gate.py ]]; then ok "owner-approval gate installed"
else bad "OWNER-APPROVAL GATE MISSING"; BLOCKERS+=("Restore .claude/hooks/owner-approval-gate.py and its PreToolUse wiring in .claude/settings.json (CLAUDE.md §NON-NEGOTIABLE)."); fi

# 2d) Selftest — SOFT. Proves the command surface degrades instead of crashing.
if [[ -x scripts/selftest.sh ]]; then
  bash scripts/selftest.sh >/dev/null 2>&1 && ok "selftest held" || soft "selftest cracked — run: bash scripts/selftest.sh"
fi

# 2e) Doctor — SOFT readiness signal (env/tooling completeness).
if [[ -x scripts/doctor.sh ]]; then
  bash scripts/doctor.sh --quiet >/dev/null 2>&1 && ok "doctor: open-ready" || soft "doctor found gaps — run: bash scripts/doctor.sh"
fi

# ── Phase 3 — VERDICT ───────────────────────────────────────────────────────────
step "3 · verdict"
if [[ "${#BLOCKERS[@]}" -gt 0 ]]; then
  bad "NOT READY — ${#BLOCKERS[@]} hard gate(s) blocking. Nothing is 'ready to transact' until these clear:"
  for b in "${BLOCKERS[@]}"; do printf '     %s→%s %s\n' "$R" "$X" "$b"; done
  say ""
  say "   ${BD}Fix the above, then run GO again. This is the gate doing its job.${X}"
  exit 2
fi
ok "all hard gates green"
say ""
say "   ${G}${BD}✅ READY — provisioned, sealed, compliant.${X}"
say "   ${G}Every money/customer/legal/on-chain action still terminates at your approval.${X}"

# ── Phase 4 — MESH + WORK (only reached when green) ─────────────────────────────
step "4 · mesh + work"
[[ -x scripts/swarm-join.sh ]] && { bash scripts/swarm-join.sh >/dev/null 2>&1 && ok "mesh: joined" || soft "mesh join skipped (offline ok)"; }
if [[ -x scripts/mesh/m1-fleet-executor.sh ]]; then
  say ""
  bash scripts/mesh/m1-fleet-executor.sh surface
fi

# ── Next ────────────────────────────────────────────────────────────────────────
step "next"
say "   review + approve work :  ${BD}bash scripts/mesh/m1-fleet-executor.sh surface${X}"
say "   clear heartbeat noise :  ${BD}bash scripts/mesh/m1-fleet-executor.sh drain${X}"
say "   full security readout  :  ${BD}bash scripts/containment.sh${X}"
say ""
say "   ${Y}Transacting (send/pay/sign/ship/deploy/on-chain) is a separate, deliberate step:${X}"
say "   it runs only with your approval on the critical path, and — for credit/funding —"
say "   only after the legal gates in shared/compliance-gates/ are cleared by counsel."
[[ -t 0 ]] && read -r -p "   press return to close…" _ 2>/dev/null || true
