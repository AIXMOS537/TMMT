# Uncommitted work, backed up

Snapshots of work sitting uncommitted in `C:\Users\AIXMOS\TMMT-canon`, taken
because the files were minutes old and another session was still editing them.
Nothing here was committed, pulled over, or deleted — this is a copy, not a move.

| file | what it holds |
|---|---|
| `tracked-changes-*.patch` | edits to tracked files (`git apply` to restore) |
| `untracked-*/` | new files that were not yet in git, at their repo-relative paths |

## Restoring

```
cd C:\Users\AIXMOS\TMMT-canon
git apply "C:\Users\AIXMOS\CommandCenter\_wip-backup\tracked-changes-<stamp>.patch"
```
Then copy the `untracked-<stamp>/` tree back over the repo root.

## Why this exists

A local `master` had drifted 56 commits behind origin while carrying an
unpushed commit — 475 lines that one `git reset` would have erased. That one was
rescued to a branch and merged as PR #187. This folder is the same precaution
for work that is still in progress and not safe to commit on someone's behalf.

Delete a snapshot once its work is committed and pushed.
