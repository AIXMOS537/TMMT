# Verification Mesh — local fact-check gate across every AI tool

> Whatever produced a change — **Claude Code, Cursor, Codex, a teammate, an agent** —
> it isn't trusted until it **passes locally**. Deterministic checks are the ground
> truth. A **local model fills the blanks** (reads failures, patches, re-verifies).
> Frontier models are touched **only** when local can't close it. Keeps the whole
> mesh integrating without breaking — fast, private, reliable.
>
> Runtime: `scripts/verify-gate.sh`. Model layer: `docs/LOCAL-FIRST-AI-STACK.md`.

---

## 1. The one rule

**No AI decides that its own work is correct. The checks do.**

LLMs hallucinate; `npm run build` does not. So every change flows through the same
gate, no matter which tool wrote it. The LLM's only job after that is to *fix what
the checks caught* — never to declare victory.

## 2. The pipeline

```
 any tool's change
   (Claude / Cursor / Codex / teammate / agent)
        │
        ▼
 ┌─────────────────────── verify-gate.sh ───────────────────────┐
 │ 1. DETERMINISTIC CHECKS  (ground truth)                       │
 │    build · types · lint · tests · integration smoke           │
 │ 2. pass?  ── yes ──►  ✓ ACCEPT (work is real)                 │
 │       │ no                                                     │
 │ 3. LOCAL MODEL fills the blanks (Hermes/Qwen via router)      │
 │    reads failure logs + diff → proposes unified-diff patch    │
 │    --apply → git apply → RE-RUN checks  (loop ≤ MAX_ITERS)    │
 │ 4. still red? ── --escalate ──► frontier once (Claude/Kimi)   │
 │              else  ──►  STOP + clean report to a human        │
 └───────────────────────────────────────────────────────────────┘
        │
        ▼  NEVER auto-pushes. Branch + owner approval to merge.
```

## 3. What "fact-checked" means here (the checks)

The gate runs a configurable list of checks (`verify.checks` file, `VERIFY_CHECKS`
env, or defaults). Recommended layers:

| Layer | Catches | Example check |
|---|---|---|
| **Build** | won't compile / breaks the app | `npm run build` (CLAUDE.md primary gate) |
| **Types** | wrong shapes, bad contracts | `npx tsc --noEmit` |
| **Lint** | style, footguns, dead code | `npm run lint` |
| **Tests** | behavior regressions | `npm run test` / `npm run test:e2e` |
| **Integration** | pieces don't mesh | smoke scripts (`scripts/smoke-prod.sh`, route 200s) |
| **Claims** | doc/code drift | grep that referenced files/scripts exist |

Each is deterministic and local — that's why they can be the source of truth.

## 4. The escalation ladder (cost + speed)

1. **Local `code` model** (Qwen3-Coder / Devstral / Hermes) — handles ~the 90%.
   Free, private, fast. Bounded by `MAX_ITERS` (default 3) so it can't thrash.
2. **`--escalate`** → one frontier attempt (Claude / Kimi K2.6 / DeepSeek V4 via the
   router's `escalate` tier) — only after local is exhausted.
3. **Human** — if both fail, the gate stops and hands over `.aixmos/check-*.log` +
   the proposed patch. No silent merges, no thrashing.

## 5. Guardrails (so "auto-fix" stays safe)

- **Dry-run by default.** Without `--apply` it only *proposes* a patch
  (`.aixmos/proposed.patch`) — a human/owner decides.
- **Never pushes.** Works on the current branch; merge to `master` still needs owner
  approval (`docs/MESH-COORDINATION.md §4`).
- **Bounded loops** (`MAX_ITERS`) — no infinite fix attempts.
- **Audit everything** — `.aixmos/verify-log.ndjson` records every run + applied patch.
- **Local-only by default** — the router is tailnet-only; no data leaves unless you
  explicitly `--escalate`.
- LLM patch output is **untrusted** until it *passes the checks* — the same rule
  applies to the fixer itself.

## 6. How each tool plugs in

- **Manual:** after any tool edits, run `scripts/verify-gate.sh --apply`.
- **Git hook:** add a `pre-push` (or `pre-commit`) hook that runs the gate — nothing
  leaves the machine red. (Opt-in; keep it fast with a lighter check set locally.)
- **Editor agents (Cursor/Cline/Continue):** point them at the local router, then run
  the gate as their "done" step.
- **n8n / mesh:** a handoff's `acceptance:` is "verify-gate green" — the receiving
  node runs it before writing `result:` (`docs/MESH-COORDINATION.md`).

## 7. Per-stakeholder framing (client / owner / employee)

- **Client request** → change on a branch → **gate must be green** before it's shown.
- **Employee/offshore work** → gate runs in their pipeline; they can't merge red
  (ties to `docs/IT-SUPPORT-TEAM-PLAYBOOK.md` change control).
- **Owner** → sees only verified, integrated work + the audit trail. Approves merges.

---

_Run: `scripts/verify-gate.sh [--apply] [--escalate]`. See
`docs/LOCAL-FIRST-AI-STACK.md` (models/router), `docs/MESH-COORDINATION.md` (mesh),
`docs/AIXMOS-SYSTEM-INDEX.md` (the whole system)._
