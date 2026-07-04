# claude-config — tracked, fleet-wide Claude Code config

Drop shared hooks/skills here (not secrets — this is a public-ish repo path) and every
device that runs `oneshot`/`booyah` gets them automatically via install-oneshot-bin.sh.

- `hooks/` → mirrors into `~/.claude/hooks/`
- `skills/` → mirrors into `~/.claude/skills/`

Never put API keys, tokens, or PII in here — hooks/skills are code, not secrets.
Secrets stay in `~/.config/tmmt/*.env` (chmod 600), same as everywhere else.

Currently empty — waiting on Carry's SessionStart hook + /vet-tool skill to land here
so this M1, BRAINIAC, and any future Mac get them for free on next oneshot.
