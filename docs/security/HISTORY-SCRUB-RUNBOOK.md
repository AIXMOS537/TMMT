# History Scrub Runbook

How to permanently purge a path (and its blobs) from **all** git history — for when a
tree-level `git rm` isn't enough because the data is sensitive and lives in prior commits.

> Current open item: the lexar sweep-archive (`imports/lexar-2026-05-20/`, two third-party
> financial PDFs) was removed from `HEAD` in PR #104 but **remains in history**. Use this
> runbook to purge it fully.

## When you need this

- Sensitive data was committed and later `git rm`'d — the blobs are still reachable in history.
- A leaked secret/key was committed (also **rotate** the secret; scrubbing history is not enough).

For ordinary stale files with no sensitivity, a plain `git rm` (already merged) is sufficient —
you do **not** need a history rewrite.

## Why it can't be done from every environment

A history rewrite + force-push is destructive and outward-facing. It must run from a **full
clone with admin rights**. It will **not** work safely from:

- a **shallow clone** (`.git/shallow` present) — the rewrite would corrupt/truncate history;
- a CI/sandbox checkout without push rights;
- a repo without `git-filter-repo` (or BFG) installed.

`scripts/scrub-history.sh` enforces all of these guards and refuses to run otherwise.

## Steps

```bash
# 1. Full clone (NOT shallow), admin credentials
git clone <repo-url> tmmt-scrub && cd tmmt-scrub

# 2. Tooling
pip install git-filter-repo        # or: brew install git-filter-repo

# 3. Dry-run — see what would be purged
scripts/scrub-history.sh --path "imports/lexar-2026-05-20"

# 4. Apply — rewrites history and force-pushes (asks you to type REWRITE)
scripts/scrub-history.sh --path "imports/lexar-2026-05-20" --apply
```

> The pre-push guard (`scripts/hooks/pre-push`, #123) refuses to force-push `master` unless
> `ALLOW_FORCE_MASTER=1` is set. `scrub-history.sh` sets it automatically for its own push;
> if you force-push by hand instead, prefix with `ALLOW_FORCE_MASTER=1`.

## After the rewrite

1. **Every collaborator re-clones.** Old clones now have divergent history; pulling will conflict.
2. **Rebase open branches/PRs** onto the rewritten `master`.
3. **Rotate** any credential that was exposed (history scrubbing alone doesn't un-leak a secret —
   it may already be cached by forks, mirrors, or GitHub's API). See
   `docs/security/SUPABASE-ADVISORS-2026-06-15.md` for the key-rotation runbook.
4. If the repo has forks or the data may have been cloned, treat it as **already disclosed** and
   act accordingly — the scrub limits future exposure, it can't recall the past.

## Guards in `scripts/scrub-history.sh`

| Guard | Behavior |
|---|---|
| Not a git repo | abort |
| Shallow clone | abort (would corrupt history) |
| Dirty working tree | abort |
| `git-filter-repo` missing | abort with install hint |
| `--apply` | requires typing `REWRITE` before any force-push |
| default | dry-run only — never rewrites without `--apply` |
