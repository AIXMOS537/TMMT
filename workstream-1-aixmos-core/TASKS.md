# WS1 TASKS

## provisioning/
- [ ] One-command installer: NAS + Tailscale + n8n + Supabase + Qdrant + Ollama + Redis
- [ ] Guided setup flow (env from shared/config/.env.template)
- [ ] "Done-for-you provisioning" path for non-technical operators
- [ ] Health-check script: confirms each service up + reachable over Tailscale

## fleet-economics-dashboard/
- [ ] React app, dark/gold TMMT aesthetic
- [ ] Metrics: utilization %, revenue/vehicle, days-on-rent, maintenance cost, ROI/car, Turo-vs-direct margin
- [ ] Data layer reads Airtable base appcenWUju039rD7b
- [ ] Per-vehicle drilldown + fleet rollup

## connectors/
- [ ] Turo data import
- [ ] Stripe (read payments/payouts)
- [ ] QuickBooks (costs/expenses)
- [ ] Twilio/SMS (outbound gated by owner-approval)

## BLOCKED — needs human
- [ ] Final visual brand tokens if different from existing TMMT OS dashboard
- [ ] Turo import method confirmation (export cadence / source)
