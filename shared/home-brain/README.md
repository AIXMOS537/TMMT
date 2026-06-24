# Home Brain Safety Layer

The floor that lets the owner go **autonomous safely**. Both home brains —
`brainiac-mac` (macOS M1) and `brainiac-win` (Windows) — call **one** function,
`guardHomeAction()`, before *any* action. The brain does everything up to the
irreversible edge on its own; only that edge waits for one-tap owner approval.

> Autonomous owner ≠ an AI with the checkbook. The brain drafts, monitors, and
> prepares 24/7. Send / pay / sign / ship / dispute stay gated. That gate is the
> safety belt — for the owner, his family, and the business.

## What it enforces (in order)

1. **Kill switch** (`kill-switch.ts`) — phone-reachable HALT. Either brain stops
   instantly. Two triggers: `AIXMOS_HOME_KILL=1` **or** a sentinel file. Fails safe.
2. **PII / family firewall** (`pii-firewall.ts`) — personal/family data never
   leaves the mesh into a cloud LLM. Cloud send + PII detected → blocked.
3. **Spend cap** (`spend-ledger.ts`) — local, offline daily USD cap. A runaway
   loop can't drain anything.
4. **Owner-approval gate** (`home-guard.ts` → `../owner-approval-gate`) —
   irreversible actions require an APPROVED owner action (CLAUDE.md §2).

Every decision — allowed or blocked — is written to a **tamper-evident,
hash-chained audit log on the NAS** (`audit-log.ts`). `verifyAuditChain()`
detects any edit or deletion of history.

## Usage (both brains, identical)

```ts
import { guardHomeAction } from "@shared/home-brain";

// Safe autonomous work — runs on its own:
guardHomeAction({
  actor: "brainiac-mac/follow-up-agent",
  action: "draft follow-up SMS",
  costUsd: 0.002,
  capUsd: Number(process.env.AIXMOS_DAILY_CAP_USD ?? 10),
});

// Irreversible — blocks until the owner approves:
guardHomeAction({
  actor: "brainiac-mac/follow-up-agent",
  action: "send follow-up SMS",
  gatedType: "customer_message",
  approval: ownerApprovedAction, // from the owner-approval queue
});
```

## Phone kill switch (no app required)

The sentinel file is the cross-platform "stop" the owner can hit from his phone
over the tailnet (Shortcuts → SSH). It works even if nothing else is running.

```sh
# STOP both brains now:
ssh brainiac-mac 'mkdir -p ~/.aixmos && touch ~/.aixmos/HALT'
ssh brainiac-win 'powershell -c "New-Item -Force $HOME\.aixmos\HALT"'

# Resume (owner only):
ssh brainiac-mac 'rm -f ~/.aixmos/HALT'
```

## Configuration (env)

| Var | Purpose | Default |
|---|---|---|
| `AIXMOS_HOME` | Root for local state | `~/.aixmos` |
| `AIXMOS_KILL_FILE` | Kill-switch sentinel path | `<home>/HALT` |
| `AIXMOS_HOME_KILL` | `1` halts immediately | unset |
| `AIXMOS_SPEND_LEDGER` | Daily spend ledger file | `<home>/spend-ledger.json` |
| `AIXMOS_DAILY_CAP_USD` | Suggested daily cap (caller passes as `capUsd`) | — |
| `AIXMOS_AUDIT_DIR` | Audit log dir — **point at the NAS mount** | `<home>/audit` |

## What this layer does NOT do

It does not remove the gate. There is intentionally no "autonomous send/pay"
path. Building one would be the single biggest risk to the owner and his family,
so it stays out by design.
