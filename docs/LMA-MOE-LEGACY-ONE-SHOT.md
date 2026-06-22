# Launch My Agency × Moe Legacy — one-shot readiness

**Goal:** You walk into LMA sales shifts and Moe Legacy client calls **ready** — scripts loaded, compliance clean, systems green, Arizona schedule protected.

**Machine:** Carry Mac M5 (owner command tower)  
**Partner brand:** Moe Legacy (Umar) — you operate as systems engineer + closer for secured contract work  
**External employer context:** Launch My Agency (LMA) — close their sales / talk to their clients per your new role (inshallah)

---

## START HERE (one command)

```bash
cd ~/Projects/TMMT && bash scripts/lma-one-shot.sh shift
```

Pre-shift only (no live URL checks):

```bash
bash scripts/lma-one-shot.sh shift --local
```

Scan iPhone / intake folder after you drop files:

```bash
bash scripts/lma-one-shot.sh scan-intake
```

Hand full cross-repo audit to Claude (lead cyber + architect):

```bash
cd ~/Projects/TMMT && claude "$(bash scripts/claude-production-audit.sh --instruction)"
```

---

## What I can vs cannot access (honest)

| Source | Access from Cursor on Carry M5 |
|--------|--------------------------------|
| TMMT repo, scripts, pitch decks | ✅ Yes |
| GitHub `AIXMOS537/*` repos | ✅ Yes (via `gh`) |
| Vercel projects (`aixmos537`) | ✅ Yes (via CLI / smoke curls) |
| iPhone Photos/Reels live | ❌ No — export to `imports/lma-intake/` |
| Instagram accounts (any) | ❌ No login — save reels / export CSV / paste links |
| Work phone on M1 (other iCloud) | ❌ No until synced to `~/Sync/` or dropped in intake |
| Launch My Agency internal portal | ❌ No until you drop SOPs/scripts in intake |

---

## Pre-shift checklist (print mentally)

### A. Personal / Arizona
- [ ] Calendar blocked for shift hours (AZ timezone)
- [ ] Phone charged, hotspot backup if venue Wi-Fi fails
- [ ] Quiet space + headset tested
- [ ] Water, notes app, GHL links bookmarked

### B. Compliance (Moe Legacy / credit-adjacent)
- [ ] Say **credit guidance** — never "credit repair"
- [ ] No guaranteed score outcomes or deletions
- [ ] $97 = tool + education access, not a credit result
- [ ] Read: `docs/pitch/README.md` universal compliance footer

### C. Systems (run `bash scripts/lma-one-shot.sh shift`)
- [ ] Local build passes
- [ ] Launch security gate passes
- [ ] Pitch decks reachable (`docs/pitch/02-credit-guidance.md` etc.)
- [ ] Production smoke green (or known 404s documented)

### D. Call flow (LMA + Moe Legacy clients)
1. **Open** — who they are, why now, what they tried
2. **Qualify** — budget, timeline, decision-maker
3. **Bridge** — TMMT rental history → membership → guidance (don't skip ladder)
4. **Offer** — one clear next step (GHL checkout or book call)
5. **Close or book** — tag in GHL, log in CRM notes
6. **Handoff** — if not your lane, tag + warm transfer to Moe/Umar queue

Objections: `docs/pitch/02-credit-guidance.md` § objections block.

### E. Earn / stay in Arizona longer
- Track: calls taken, closes, follow-ups scheduled, commission-eligible deals
- Daily: run `bash scripts/tmmt watchtower` — vertical health
- Weekly: update `imports/lma-intake/` with winning scripts from the field

---

## Readiness score (what the script prints)

| Category | Weight |
|----------|--------|
| Local build + security | 30% |
| Sales/compliance pack present | 20% |
| Intake media triaged | 10% |
| Production portals up | 30% |
| Revenue env configured | 10% |

**GO for shift:** score ≥ 75 and no P0 security fail  
**CONDITIONAL:** 60–74 — take calls but fix blockers same day  
**NO-GO:** < 60 or active secret exposure

---

## Known production blockers (fix before claiming "all green")

As of last sweep on Carry M5:

- `https://tmmt-command-center.vercel.app/forms/customer-intake` → **404** (stale deploy or wrong project)
- Local `.env` missing some revenue vars — pull from Vercel: `vercel env pull .env --environment=production`

Fix path:

```bash
cd ~/Projects/TMMT
npm run build
# owner approval only:
git push origin master
npm run smoke:prod
```

---

## Related docs

- Moe Legacy spec: `docs/superpowers/specs/2026-06-21-moe-legacy-agency-saas-design.md`
- Pitch library: `docs/pitch/README.md`
- Genie demo campaign: `docs/marketing/2026-06-18-moe-legacy-genie-demo-campaign.md`
- Production audit handoff: `docs/CLAUDE-HAILMARY-PRODUCTION-AUDIT-PROMPT.md`
- Intake folder: `imports/lma-intake/README.md`
