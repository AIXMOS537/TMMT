#!/usr/bin/env bash
# TMMT agentic swarm — run many Claude Code agents in parallel across your MESH
# of machines (carry Mac, a Surface, any number), without colliding. Git is the
# only coordination layer, so any machine that can reach GitHub can join.
#
#   Each task  -> its own git worktree + branch  (agents never touch the same files)
#   Shared board -> remote branch "swarm-coord"  (every machine claims tasks atomically)
#   Each agent -> a tmux window (mac/linux/wsl) or Windows Terminal tab (Surface)
#
# QUICK START (per machine, one-time — give each a UNIQUE name):
#   bash scripts/swarm.sh init carry-mac      # on the Surface:  ... init surface
#
# DAILY:
#   bash scripts/swarm.sh add "Wire Sentry DSN + verify errors flow"   # add work (any machine)
#   bash scripts/swarm.sh add "Build email notifications (Gap #10)"
#   bash scripts/swarm.sh up 3               # claim 3 tasks for THIS machine + launch 3 agents
#   tmux attach -t swarm                      # watch/steer them (Ctrl-b n / p to switch)
#   bash scripts/swarm.sh status             # see the whole board, every machine
#   bash scripts/swarm.sh done 4             # agent finished task #4 (also auto-run by the agent)
#   bash scripts/swarm.sh clean              # remove finished worktrees
#
# ENV TOGGLES:
#   SWARM_MACHINE=name     override this machine's name
#   SWARM_YOLO=1           launch agents with --dangerously-skip-permissions (autonomous; use with care)
#   SWARM_LAUNCH=print|tmux|wt   force a launcher (default: auto-detect)
#   SWARM_INSTALL=1        npm install per worktree instead of symlinking node_modules (Windows-safe)

set -euo pipefail
source "$(dirname "$0")/lib/swarm-common.sh"
cd "$SWARM_ROOT"

# ---- board mutators (run inside a throwaway worktree of swarm-coord) ----------
# Each takes the board file path as $1 and edits it in place. They talk to the
# caller through files at absolute paths (CLAIM_OUT etc.) since they run in a subshell.

_mut_add() {
  local f="$1"
  local next; next="$(awk -F'\t' '/^[0-9]/{m=$1} END{print m+1}' "$f")"
  printf '%s\t%s\t%s\t%s\t%s\n' "$next" "TODO" "-" "-" "$TASK_TEXT" >> "$f"
  printf '%s' "$next" > "$CLAIM_OUT"
}

_mut_claim() {
  local f="$1" tmp="$1.tmp" count=0
  : > "$CLAIM_OUT"
  while IFS=$'\t' read -r id status m branch task; do
    if [[ -z "$id" || "$id" == \#* ]]; then
      printf '%s\t%s\t%s\t%s\t%s\n' "$id" "$status" "$m" "$branch" "$task"; continue
    fi
    if [[ "$status" == "TODO" && $count -lt $CLAIM_N ]]; then
      status="CLAIMED"; m="$MACHINE"; branch="swarm/$MACHINE/$id"
      printf '%s\n' "$id" >> "$CLAIM_OUT"; count=$((count + 1))
    fi
    printf '%s\t%s\t%s\t%s\t%s\n' "$id" "$status" "$m" "$branch" "$task"
  done < "$f" > "$tmp"
  mv "$tmp" "$f"
}

_mut_setstatus() {
  local f="$1" tmp="$1.tmp"
  awk -F'\t' -v OFS='\t' -v id="$SET_ID" -v st="$SET_STATUS" \
    '$1==id{$2=st} {print}' "$f" > "$tmp"
  mv "$tmp" "$f"
}

# Register / refresh this device in the mesh roster (mesh.tsv, beside board.tsv).
_mut_register() {
  local mf; mf="$(dirname "$1")/mesh.tsv"
  [[ -f "$mf" ]] || printf '# machine\tos\trole\ttailscale\tstatus\tlast_seen\n' > "$mf"
  local now; now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local tmp="$mf.tmp"
  # Empty REG_* values preserve the existing field (a heartbeat won't wipe data).
  awk -F'\t' -v OFS='\t' \
      -v n="$REG_NAME" -v o="${REG_OS:-}" -v r="${REG_ROLE:-}" \
      -v ts="${REG_TS:-}" -v st="${REG_STATUS:-online}" -v t="$now" '
    /^#/{print; next}
    $1==n{ print n, (o==""?$2:o), (r==""?$3:r), (ts==""?$4:ts), (st==""?$5:st), t; found=1; next }
    {print}
    END{ if(!found) print n,o,r,ts,st,t }' "$mf" > "$tmp"
  mv "$tmp" "$mf"
}

# Create the coordination branch + empty board if it doesn't exist yet.
ensure_coord() {
  if git ls-remote --exit-code --heads origin "$COORD_BRANCH" >/dev/null 2>&1; then return; fi
  info "creating coordination branch '$COORD_BRANCH'..."
  mkdir -p "$WORKTREE_BASE"
  local tmp="$WORKTREE_BASE/.coord-init-$$"
  rm -rf "$tmp"; git worktree prune
  git worktree add -q --detach "$tmp" >/dev/null
  (
    cd "$tmp"
    git checkout -q --orphan "$COORD_BRANCH"
    git rm -rfq . >/dev/null 2>&1 || true
    printf '# id\tstatus\tmachine\tbranch\ttask\n' > "$BOARD_FILE"
    git add "$BOARD_FILE"
    git -c user.name='swarm' -c user.email='swarm@tmmt' commit -q -m "swarm: init board"
    git_push_retry -u origin "$COORD_BRANCH"
  )
  git worktree remove --force "$tmp" 2>/dev/null || rm -rf "$tmp"
  git worktree prune
}

# Apply a mutator to the board atomically: fetch → edit → push HEAD, retrying on
# race. Uses a detached worktree + push HEAD:branch so concurrent edits (even on
# the same laptop) never fight over a local branch checkout.
board_edit() {
  local mutate="$1"
  ensure_coord
  mkdir -p "$WORKTREE_BASE"
  local i tmp="$WORKTREE_BASE/.coord-tmp-$$"
  for i in 1 2 3 4 5; do
    git fetch -q origin "$COORD_BRANCH"
    rm -rf "$tmp"; git worktree prune
    if ! git worktree add -q --detach "$tmp" "origin/$COORD_BRANCH" >/dev/null 2>&1; then
      warn "could not attach coord worktree (attempt $i)"; sleep 1; continue
    fi
    local rc=0
    (
      cd "$tmp"
      "$mutate" "$tmp/$BOARD_FILE"
      git add -A
      git diff --cached --quiet && exit 0
      git -c user.name='swarm' -c user.email='swarm@tmmt' commit -q -m "swarm: update coordination state"
      git push -q origin "HEAD:$COORD_BRANCH"
    ) || rc=$?
    git worktree remove --force "$tmp" 2>/dev/null || rm -rf "$tmp"
    git worktree prune
    if [[ $rc -eq 0 ]]; then return 0; fi
    warn "board write raced with the other laptop (attempt $i) — retrying"
    sleep 1
  done
  die "could not update the board after retries"
}

# ---- agent launch ------------------------------------------------------------

agent_prompt() {
  local id="$1" task="$2" me; me="$(swarm_machine)"
  cat <<EOF
You are a swarm agent working ONLY on task #$id, in this git worktree, on branch
swarm/$me/$id. Another agent may be working other tasks in parallel — stay in your lane.

TASK #$id: $task

Rules:
- Read CLAUDE.md first. Match existing patterns. Production quality, not prototype.
- Stay on THIS branch (swarm/$me/$id). Never touch master or other swarm/* branches.
- Make small, logical commits with clear messages.
- Before pushing, these must pass: npm run build && npm test && npm run lint
- Push with: git push -u origin swarm/$me/$id
- When done and pushed, run:  bash scripts/swarm.sh done $id

SECURITY (non-negotiable — this is a production system with customer PII + money):
- NEVER print, log, echo, or commit secrets. .env must never appear in a diff,
  commit, or chat. The pre-commit hook will block it; do not bypass with --no-verify.
- NEVER weaken security controls. Do not disable or loosen: Supabase RLS, the
  auth/middleware gates, zod validation, the rate limiter, CSP/security headers,
  or webhook signature checks. If the task seems to require it, STOP and ask.
- Treat all customer data (leads, contracts, payments, PII) as confidential —
  never paste it into commits, logs, or test fixtures.
- Do not add new third-party network calls, dependencies, or telemetry without
  calling it out explicitly in your report.
- For any owner-only account action (GHL / Vercel / Supabase / DNS / Twilio /
  Stripe), STOP and report exactly what you need — never guess or invent secrets.
EOF
}

launch_agent() {
  local id="$1" wt="$2" task="$3"
  agent_prompt "$id" "$task" > "$wt/.swarm-task.txt"
  local cc="claude"
  [[ "${SWARM_YOLO:-0}" == "1" ]] && cc="claude --dangerously-skip-permissions"
  local run="cd $(printf '%q' "$wt") && $cc \"\$(cat .swarm-task.txt)\""
  local mode="${SWARM_LAUNCH:-auto}"

  _print_launch() { say "${BOLD}# task #$id${RST}"; say "$run"; }

  # Explicit print mode, or no terminal multiplexer available.
  if [[ "$mode" == "print" ]]; then _print_launch; return; fi

  # macOS / Linux / WSL → tmux (best experience: one window per agent).
  if [[ "$mode" == "auto" || "$mode" == "tmux" ]] && command -v tmux >/dev/null 2>&1; then
    if ! tmux has-session -t swarm 2>/dev/null; then
      tmux new-session -d -s swarm -n "t$id" -c "$wt"
    else
      tmux new-window -t swarm -n "t$id" -c "$wt"
    fi
    tmux send-keys -t "swarm:t$id" "$run" C-m
    ok "launched #$id → tmux window ${BOLD}swarm:t$id${RST}  (tmux attach -t swarm)"
    return
  fi

  # Windows (Surface, Git Bash) → Windows Terminal tab if present.
  if [[ "$mode" == "auto" || "$mode" == "wt" ]] && command -v wt.exe >/dev/null 2>&1; then
    if wt.exe -w swarm new-tab --title "t$id" bash -lc "$run" >/dev/null 2>&1; then
      ok "launched #$id → Windows Terminal tab ${BOLD}t$id${RST}"
      return
    fi
  fi

  warn "no tmux / Windows Terminal here — paste this in a new terminal:"
  _print_launch
}

start_one() {
  local id="$1"
  local row; row="$(board_read | awk -F'\t' -v id="$id" '$1==id{print; exit}')"
  [[ -n "$row" ]] || die "task #$id is not on the board"
  local machine branch task
  machine="$(cut -f3 <<<"$row")"; branch="$(cut -f4 <<<"$row")"; task="$(cut -f5- <<<"$row")"
  local me; me="$(swarm_machine)"
  [[ "$machine" == "$me" ]] || warn "#$id is claimed by '$machine' (you are '$me') — starting anyway"
  [[ "$branch" == "-" || -z "$branch" ]] && branch="swarm/$me/$id"

  local wt; wt="$(worktree_path "$id")"
  mkdir -p "$WORKTREE_BASE"
  if [[ ! -d "$wt" ]]; then
    info "creating worktree $wt on $branch"
    git fetch -q origin master
    git worktree add -q -b "$branch" "$wt" origin/master 2>/dev/null \
      || git worktree add -q "$wt" "$branch"
  fi
  # Agents need secrets + deps to build. Symlinks are ideal (instant, no extra
  # disk), but Windows/Git-Bash often can't make them without Developer Mode —
  # so fall back to a copy (.env) or a per-worktree install (node_modules).
  # Best effort — provisioning must NEVER stop an agent from launching; if deps
  # don't land here, the agent can run `npm install` itself.
  if [[ -f "$SWARM_ROOT/.env" && ! -e "$wt/.env" ]]; then
    ln -s "$SWARM_ROOT/.env" "$wt/.env" 2>/dev/null \
      || cp "$SWARM_ROOT/.env" "$wt/.env" 2>/dev/null \
      || warn "couldn't provide .env to $wt"
  fi
  if [[ ! -e "$wt/node_modules" ]]; then
    if [[ "${SWARM_INSTALL:-0}" == "1" ]]; then
      ( cd "$wt" && npm install --no-audit --no-fund ) || warn "npm install failed in $wt — run it there manually"
    elif [[ -d "$SWARM_ROOT/node_modules" ]] && ln -s "$SWARM_ROOT/node_modules" "$wt/node_modules" 2>/dev/null; then
      : # symlinked the shared node_modules
    else
      info "symlink unavailable here (Windows?) — installing deps in this worktree once..."
      ( cd "$wt" && npm install --no-audit --no-fund ) || warn "npm install failed in $wt — run it there manually"
    fi
  fi

  SET_ID="$id" SET_STATUS="DOING" board_edit _mut_setstatus || true
  launch_agent "$id" "$wt" "$task"
}

# ---- subcommands -------------------------------------------------------------

cmd_init() {
  mkdir -p "$SWARM_ROOT/.swarm"
  if [[ -n "${1:-}" ]]; then printf '%s\n' "$1" > "$SWARM_ROOT/.swarm/machine"; fi
  ensure_coord
  REG_NAME="$(swarm_machine)" REG_OS="$(swarm_os)" REG_TS="$(tailscale_self)" board_edit _mut_register
  ok "this machine is '${BOLD}$(swarm_machine)${RST}' (os: $(swarm_os)). Registered on the mesh."
  say "Give every machine on your mesh a UNIQUE name (carry-mac, work-mac, surface, ...)."
  say "Next: bash scripts/swarm.sh add \"your first task\"   then   bash scripts/swarm.sh up 2"
}

cmd_add() {
  [[ -n "${1:-}" ]] || die "usage: swarm.sh add \"task description\""
  local out; out="$(mktemp)"
  TASK_TEXT="$*" CLAIM_OUT="$out" board_edit _mut_add
  ok "added task #$(cat "$out"): $*"
  rm -f "$out"
}

cmd_claim() {
  local n="${1:-1}"
  local out; out="$(mktemp)"
  # board_edit's chatter goes to stderr; only task IDs go to stdout (so callers
  # can capture them cleanly).
  MACHINE="$(swarm_machine)" CLAIM_N="$n" CLAIM_OUT="$out" board_edit _mut_claim 1>&2
  local ids; ids="$(tr '\n' ' ' < "$out")"; rm -f "$out"
  [[ -n "${ids// /}" ]] || { warn "no TODO tasks left to claim"; return 1; }
  printf '%s\n' "${GRN}✓${RST} claimed for $(swarm_machine): ${BOLD}${ids}${RST}" >&2
  printf '%s' "$ids"
}

cmd_up() {  # claim N then launch them all (the swarm)
  local n="${1:-2}"
  local raw; raw="$(cmd_claim "$n")" || return 1
  local ids; ids="$(grep -oE '[0-9]+' <<<"$raw" | tr '\n' ' ')"
  local id
  for id in $ids; do start_one "$id"; done
  say ""
  if [[ "${SWARM_LAUNCH:-auto}" != "print" ]] && command -v tmux >/dev/null 2>&1; then
    say "Watch the swarm:  ${BOLD}tmux attach -t swarm${RST}   (Ctrl-b n/p to switch agents)"
  elif [[ "$(swarm_os)" == "windows" ]]; then
    say "Each agent opened in its own Windows Terminal tab. If not, re-run with SWARM_LAUNCH=print."
  fi
}

cmd_start() { [[ -n "${1:-}" ]] || die "usage: swarm.sh start <id>"; start_one "$1"; }

cmd_done() {
  local id="${1:-}"; [[ -n "$id" ]] || die "usage: swarm.sh done <id>"
  local wt; wt="$(worktree_path "$id")"
  if [[ -d "$wt" ]]; then
    ( cd "$wt"
      [[ -n "$(git status --porcelain)" ]] && warn "uncommitted changes in $wt — commit them, then re-run done."
      git push -u origin "$(git branch --show-current)" 2>/dev/null || true
    )
  fi
  SET_ID="$id" SET_STATUS="DONE" board_edit _mut_setstatus
  ok "task #$id marked DONE."
  say "Open a PR:  ${DIM}gh pr create --base master --head swarm/$(swarm_machine)/$id${RST}  (or via GitHub)"
}

cmd_list() {
  local b; b="$(board_read)"
  [[ -n "$b" ]] || { info "no board yet — add a task: bash scripts/swarm.sh add \"...\""; return; }
  printf '%s%-4s %-8s %-12s %s%s\n' "$BOLD" "ID" "STATUS" "MACHINE" "TASK" "$RST"
  printf '%s\n' "$b" | awk -F'\t' 'NR==1{next}{printf "#%-3s %-8s %-12s %s\n",$1,$2,$3,$5}'
}

cmd_status() {
  cmd_list
  say ""
  info "worktrees on this machine ($(swarm_machine)):"
  git worktree list | grep -F "$WORKTREE_BASE" | sed 's/^/   /' || say "   (none active)"
}

# Heartbeat: announce this machine is alive (and optionally its role/status).
#   beat [role] [status]   role: owner|operator|agent ; status: online|assisting|...
cmd_beat() {
  REG_NAME="$(swarm_machine)" REG_OS="$(swarm_os)" \
  REG_ROLE="${1:-}" REG_STATUS="${2:-online}" REG_TS="$(tailscale_self)" \
    board_edit _mut_register
}

cmd_mesh() {
  git fetch -q origin "$COORD_BRANCH" 2>/dev/null || true
  local m; m="$(git show "origin/$COORD_BRANCH:mesh.tsv" 2>/dev/null || true)"
  [[ -n "$m" ]] || { info "no devices registered yet — run: bash scripts/swarm-join.sh"; return; }
  local now; now="$(date -u +%s)"
  printf '%s   %-14s %-9s %-7s %-15s %-10s %s%s\n' "$BOLD" "MACHINE" "ROLE" "OS" "TAILSCALE" "STATUS" "SEEN" "$RST"
  # Normalize empty TSV fields to "-" in awk FIRST: bash `read` with IFS=tab
  # collapses consecutive tabs (tab is whitespace), which would drop empty
  # columns and shift everything left.
  printf '%s\n' "$m" | awk -F'\t' -v OFS='\t' '{for(i=1;i<=6;i++) if($i=="")$i="-"; print}' \
  | while IFS=$'\t' read -r machine os role ts status seen; do
    [[ "$machine" == \#* ]] && continue
    local dot="·" age="?" e
    e="$(iso_epoch "$seen")"
    if [[ -n "$e" ]]; then local d=$((now - e)); age="$(fmt_age "$d")"; (( d < 300 )) && dot="${GRN}●${RST}"; fi
    printf ' %b %-14s %-9s %-7s %-15s %-10s %s\n' "$dot" "$machine" "$role" "$os" "$ts" "$status" "$age"
  done
  say "${DIM}● = seen in the last 5 min (online)${RST}"
}

cmd_clean() {
  local b; b="$(board_read)"
  local id st rest
  printf '%s\n' "$b" | awk -F'\t' 'NR>1 && $2=="DONE"{print $1}' | while read -r id; do
    local wt; wt="$(worktree_path "$id")"
    if [[ -d "$wt" ]]; then
      info "removing finished worktree #$id ($wt)"
      git worktree remove --force "$wt" 2>/dev/null || rm -rf "$wt"
    fi
  done
  git worktree prune
  ok "cleaned finished worktrees."
}

usage() {
  sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
}

case "${1:-help}" in
  init)   shift; cmd_init "${1:-}";;
  add)    shift; cmd_add "$@";;
  claim)  shift; cmd_claim "${1:-1}" >/dev/null && cmd_list;;
  up|launch) shift; cmd_up "${1:-2}";;
  start)  shift; cmd_start "${1:-}";;
  done)   shift; cmd_done "${1:-}";;
  list|board) cmd_list;;
  status) cmd_status;;
  mesh|devices) cmd_mesh;;
  beat)   shift; cmd_beat "$@";;
  clean)  cmd_clean;;
  help|--help|-h) usage;;
  *) die "unknown command '$1' — run: bash scripts/swarm.sh help";;
esac
