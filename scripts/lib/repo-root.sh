#!/usr/bin/env bash
# repo-root.sh — find the TMMT repo from anywhere (shared by one-shot scripts).
# Sets: TMMT_REPO (absolute path to repo root)

tmmt_locate_repo() {
  local d
  if git rev-parse --show-toplevel 2>/dev/null | grep -qi TMMT; then
    git rev-parse --show-toplevel 2>/dev/null
    return 0
  fi
  for d in "$HOME/Projects/TMMT" "$HOME/projects/TMMT" "$HOME/TMMT" \
           "$HOME/Documents/TMMT" "$HOME/Desktop/TMMT"; do
    [ -d "$d/.git" ] && { printf '%s\n' "$d"; return 0; }
  done
  d="$(find "$HOME" -maxdepth 4 -type d -name .git -path '*/TMMT/.git' 2>/dev/null | head -1)"
  [ -n "$d" ] && { dirname "$d"; return 0; }
  return 1
}

TMMT_REPO="$(tmmt_locate_repo 2>/dev/null || true)"
export TMMT_REPO
