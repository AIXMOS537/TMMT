# WS1 — AIXMOS Core

Goal: turn the bespoke AIXMOS stack into an installable product with a visible "wow."
Read root `/CLAUDE.md` and `00_START_HERE/BUILD_BRIEF.md` first.

Build order: `provisioning/` → `fleet-economics-dashboard/` → `connectors/`.

Rules that apply here:
- Default model routing to Ollama; cloud only via Cloudflare gateway with BYO-key.
- Dashboard reads Airtable base appcenWUju039rD7b (Fleet tblubnSDZkvsc9L6I, Customers tblFJIhonUvf631uM, Payments tblsG1LCDNSeehiLf, Leads tbl4gndUYeiOUWYRR).
- Any outbound SMS/email from connectors routes through shared/owner-approval-gate.
- PII stays on the NAS tier. No client PII into cloud LLM context.
