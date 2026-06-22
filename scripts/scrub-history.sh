#!/usr/bin/env bash
# scrub-history.sh — permanently purge a path (and its blobs) from ALL git history.
#
# Why this exists: a tree-level `git rm` removes a file from HEAD but leaves the
# blob in every prior commit. For sensitive data (e.g. the lexar sweep-archive of
# third-party financial PDFs removed in #104) the only complete fix is a history
# rewrite + force-push. This is destructive and outward-facing, so this script is
# deliberately fenced: it refuses to run anywhere it could do damage, and it never
# force-pushes without an explicit, typed confirmation.
#
# RUN THIS FROM A FULL CLONE WITH ADMIN RIGHTS — never from a shallow/CI checkout.
#
# Usage:
#   scripts/scrub-history.sh                 # dry-run, default path (the lexar archive)
#   scripts/scrub-history.sh --path "imports/lexar-2026-05-20"
#   scripts/scrub-history.sh --path "<path>" --apply     # rewrite + force-push
#
# After --apply: every collaborator must re-clone; every open branch/PR must be
# rebased onto the rewritten master. Rotate any credentials that were exposed.
set -euo pipefail

PURGE_PATH="imports/lexar-2026-05-20"
APPLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --path)  PURGE_PATH="${2:?--path needs a value}"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

red(){ printf '\033[31m%s\033[0m\n' "$*"; }
grn(){ printf '\033[32m%s\033[0m\n' "$*"; }
ylw(){ printf '\033[33m%s\033[0m\n' "$*"; }

# --- guard 1: must be inside a git repo ------------------------------------
git rev-parse --git-dir >/dev/null 2>&1 || { red "Not a git repo."; exit 1; }

# --- guard 2: refuse on a shallow clone (would corrupt/truncate history) ----
if [ -f "$(git rev-parse --git-dir)/shallow" ]; then
  red "ABORT: this is a SHALLOW clone. A rewrite here would corrupt history."
  echo "Run from a full clone, or first: git fetch --unshallow"
  exit 1
fi

# --- guard 3: clean working tree -------------------------------------------
if ! git diff --quiet || ! git diff --cached --quiet; then
  red "ABORT: working tree is dirty. Commit/stash first."
  exit 1
fi

# --- guard 4: git-filter-repo present (the safe, supported tool) -----------
if ! git filter-repo --help >/dev/null 2>&1; then
  red "ABORT: git-filter-repo not installed."
  echo "Install:  pip install git-filter-repo   (or: brew install git-filter-repo)"
  echo "BFG is an alternative: https://rtyley.github.io/bfg-repo-cleaner/"
  exit 1
fi

echo "Target path to purge from ALL history:  $PURGE_PATH"
echo "Commits currently touching it:"
git log --oneline --all -- "$PURGE_PATH" 2>/dev/null | sed 's/^/    /' || true
BLOBS=$(git rev-list --objects --all 2>/dev/null | grep -F "$PURGE_PATH" | wc -l | tr -d ' ')
echo "Objects matching the path in history: $BLOBS"
echo

if [ "$APPLY" -ne 1 ]; then
  ylw "DRY-RUN. Nothing changed. Re-run with --apply to rewrite history + force-push."
  exit 0
fi

# --- apply: require typed confirmation (irreversible, breaks shared history)
red "This REWRITES every commit after the path was introduced and FORCE-PUSHES"
red "all branches and tags. Everyone must re-clone; open PRs must be rebased."
printf 'Type exactly  REWRITE  to proceed: '
read -r CONFIRM
[ "$CONFIRM" = "REWRITE" ] || { echo "Aborted."; exit 1; }

ORIGIN_URL="$(git remote get-url origin)"
git filter-repo --path "$PURGE_PATH" --invert-paths --force

# filter-repo strips the remote by design; restore and force-push.
git remote get-url origin >/dev/null 2>&1 || git remote add origin "$ORIGIN_URL"
git push --force --all origin
git push --force --tags origin

grn "Done. History rewritten and force-pushed."
echo "Next: notify collaborators to re-clone; rebase open branches; rotate any exposed secrets."
