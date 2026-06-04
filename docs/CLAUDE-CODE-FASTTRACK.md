# Claude Code — fast-track setup

> **Primary runbook:** [`CLAUDE-CODE-RUNBOOK.md`](CLAUDE-CODE-RUNBOOK.md)  
> **Launcher script:** [`scripts/claude-fasttrack.sh`](../scripts/claude-fasttrack.sh)

---

## START HERE

```bash
cd ~/Projects/TMMT && claude "$(bash scripts/claude-fasttrack.sh --instruction)"
```

Print quick start + phase list:

```bash
bash scripts/claude-fasttrack.sh
```

Dump full copy-paste prompt:

```bash
bash scripts/claude-fasttrack.sh --prompt
```

---

## Roadmap (Phases 1–6)

| # | Phase | Key commands |
|---|--------|----------------|
| 1 | Commit & deploy `/kits` | `npm run build`, `git push`, curl `/kits` |
| 2 | GHL + Stripe | GHL dashboard, Vercel env, `npm run ghl:check` |
| 3 | Fulfillment | GHL tags/workflows, `npm run ghl:test-webhook payment` |
| 4 | Physical channel | print HTML, `scripts/build-retail-usb.sh` |
| 5 | Production cleanup | `scripts/smoke-prod.sh`, `retire-vercel-duplicates.sh`, DNS |
| 6 | Safety | stay on `master`; **do not** merge `feature/rescue-dispatch-core` |

Live landing (after deploy): **`https://tmmt-command-center.vercel.app/kits`** (project `tmmt-c919`)

---

## After Claude Code finishes

1. Open **`/kits`** on your live AIXMOS domain when DNS is ready  
2. Print **`ORDER-FORM.html`** QR codes from `docs/flash-drive-kits/`  
3. Take first real payment in GHL test mode, then flip Stripe live  

See [`CLAUDE-CODE-RUNBOOK.md`](CLAUDE-CODE-RUNBOOK.md) for decision gates, env var names, and verification curls.
