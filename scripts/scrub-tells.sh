#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  scrub-tells.sh — remove AI-build tells from the PUBLIC repo, cleanly.
#  Keeps every file ON DISK (still functional locally); only removes them
#  from git tracking so they stop appearing in the public repo.
#
#  ⚠ OUTWARD-FACING. Run ONLY when the mesh is quiet (BRAINIAC + M1 not
#    mid-sync) and you're ready to push. It does NOT push automatically.
#  ⚠ Do the history rewrite (step 4) LAST and coordinate: it force-pushes
#    and every clone must re-pull. Skip it if the repo is PRIVATE.
#
#  0) FIRST verify visibility:  gh repo view AIXMOS537/TMMT --json visibility
#     If PRIVATE → the tells aren't public; this is optional/at-leisure.
# ═══════════════════════════════════════════════════════════════════
set -uo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)" || exit 1
echo "repo: $(git remote get-url origin 2>/dev/null)  branch: $(git rev-parse --abbrev-ref HEAD)"
read -r -p "This untracks tell-files (keeps them on disk) + commits locally. Continue? [y/N] " a
[[ "${a:-n}" =~ ^[Yy]$ ]] || { echo "aborted."; exit 0; }

# 1) untrack the named tells (files stay on disk, functional)
TELLS=(
  CLAUDE.md "AIXMOS/CLAUDE.md" "AIXMOS/docs/CLAUDE.md"
  "docs/CLAUDE-CODE-FASTTRACK.md" "docs/CLAUDE-CODE-RUNBOOK.md"
  "tools/hailmary-intake/.claude/launch.json"
)
for f in "${TELLS[@]}"; do git rm --cached --quiet "$f" 2>/dev/null && echo "  untracked: $f"; done
# untrack the whole superpowers/ dev-process folder + any .claude dirs
git rm -r --cached --quiet docs/superpowers 2>/dev/null && echo "  untracked: docs/superpowers/"
git ls-files | grep -E '(^|/)\.claude/' | xargs -I{} git rm --cached --quiet "{}" 2>/dev/null || true

# 2) gitignore so they never come back
cat >> .gitignore <<'IGN'

# --- keep AI-build tooling local-only (rebrand hygiene) ---
CLAUDE.md
**/CLAUDE.md
.claude/
**/.claude/
docs/CLAUDE-CODE-*.md
docs/superpowers/
IGN
echo "  .gitignore updated"

# 3) commit locally (NOT pushed — you push when the mesh is quiet)
git add .gitignore
git commit -q -m "chore: repo hygiene pass" && echo "  committed locally (clean message, no trailer)"
echo
echo "NEXT (you, when mesh is quiet):"
echo "  push:            git push origin HEAD"
echo "  clean branch:    git branch -m main-clean   (rename off 'claude/*')"
echo
echo "4) OPTIONAL history rewrite — strips 'Co-Authored-By: Claude' from all 45 commits."
echo "   Needs git-filter-repo (brew install git-filter-repo). COORDINATE — force-push:"
echo "     git filter-repo --message-callback '"
echo "       return b\"\\n\".join(l for l in message.split(b\"\\n\") if b\"Co-Authored-By: Claude\" not in l and b\"Generated with Claude\" not in l)'"
echo "     git push --force-with-lease origin HEAD   # every clone must re-pull after this"
