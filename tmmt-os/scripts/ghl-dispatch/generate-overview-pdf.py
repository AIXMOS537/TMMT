#!/usr/bin/env python3
"""Generate TMMT Dispatch System overview PDF."""
from fpdf import FPDF
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "docs" / "TMMT_Dispatch_System_Overview.pdf"


class PDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(79, 70, 229)
        self.cell(0, 8, "TMMT OS Dispatch System", align="L")
        self.set_text_color(0, 0, 0)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(107, 114, 128)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")

    def section(self, title):
        self.ln(4)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(49, 46, 129)
        self.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(79, 70, 229)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)
        self.set_text_color(0, 0, 0)
        self.set_font("Helvetica", "", 10)

    def body(self, text):
        self.multi_cell(0, 5, text)
        self.ln(2)

    def bullet(self, text):
        self.set_x(self.l_margin)
        self.multi_cell(0, 5, f"- {text}")


def main():
    pdf = PDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, "TMMT OS Dispatch System", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(107, 114, 128)
    pdf.cell(0, 6, "How jobs flow from staff intake to your GHL locations", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, "May 2026  |  TMMT x AIXMOS", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(6)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "ONE SENTENCE", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(
        0,
        5,
        "You or staff enter a dispatch job in TMMT OS. The system saves a ticket, runs protocols "
        "(routing, ClickUp, GHL tags, dispatch loads). Each configured GHL location receives a "
        "webhook. GHL workflows create contacts, deals, tags, and tasks.",
    )
    pdf.ln(4)

    pdf.section("1. The big picture")
    roles = [
        ("TMMT OS", "Command center where jobs are entered and tracked"),
        ("Local vendor", "Shop that outsources work to TMMT"),
        ("GHL location", "Each TMMT app sub-account (Rentals, Moving, etc.)"),
        ("Inbound webhook", "The doorbell in GHL that TMMT rings"),
        ("Workflow", "What GHL does after the doorbell (contact, deal, SMS, task)"),
    ]
    for name, desc in roles:
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(40, 5, name)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 5, desc, new_x="LMARGIN", new_y="NEXT")

    pdf.section("2. End-to-end flow")
    flow = """
YOU / STAFF
    |
    v
/internal/dispatch/new  (or POST /api/jobs/dispatch)
    |
    v
TMMT OS - case + protocol_runs
    |
    +-- Routing (ClickUp, agent draft)
    +-- dispatch_loads (pickup / dropoff)
    +-- GHL tags (main Rentals account)
    +-- Optional TMMT vendor assignment
    |
    v
POST JSON to each GHL inbound webhook
    |
    v
GHL: Contact -> fields -> Deal -> tag -> notify -> task
"""
    pdf.set_font("Courier", "", 9)
    pdf.multi_cell(0, 4.5, flow.strip())
    pdf.set_font("Helvetica", "", 10)

    pdf.section("3. Webhook payload (flat GHL keys)")
    fields = [
        ("tmmt_job_ref", "Ticket number"),
        ("tmmt_job_subject", "Job title"),
        ("tmmt_work_type", "dispatch_pickup | dispatch_delivery | dispatch_full"),
        ("tmmt_vendor_company", "Local shop name"),
        ("tmmt_vendor_email", "Shop contact email"),
        ("tmmt_pickup / tmmt_dropoff", "Route addresses"),
        ("tmmt_offered_price", "Price offered"),
        ("tmmt_job_details", "Notes"),
        ("tmmt_case_id", "Internal case ID"),
    ]
    for k, v in fields:
        pdf.set_font("Courier", "", 9)
        pdf.cell(55, 5, k)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 5, v, new_x="LMARGIN", new_y="NEXT")

    pdf.section("4. Protocol chain (automatic)")
    for step in [
        "Intake created - intake row + case",
        "Routing - work type, ClickUp task",
        "Dispatch load - pickup/dropoff row",
        "Agent draft - TANK/STICKS checklist",
        "GHL notify - tags on main account",
        "Vendor assignment - if vendor selected",
        "Partner delivery - POST to GHL webhooks",
    ]:
        pdf.bullet(step)

    pdf.add_page()
    pdf.section("5. Your four GHL locations")
    pdf.body("Launchpad URLs are NOT webhook URLs. Each needs an Inbound Webhook workflow.")
    locs = [
        ("1", "Xcd8DZt5T4GWnBtBEC5V", "tmmt_rentals", "TMMT Rentals (main GHL_LOCATION_ID)"),
        ("2", "s8QGoe5XXzyaDtHPUtBR", "vendor_connect", "Confirm sub-account name"),
        ("3", "MzniJxhyYzUndJDjMkvm", "moving", "Confirm sub-account name"),
        ("4", "IUOThggAD347OwGX6qZZ", "fleet_manager", "Confirm sub-account name"),
    ]
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(8, 6, "#")
    pdf.cell(52, 6, "Location ID")
    pdf.cell(38, 6, "Slug")
    pdf.cell(0, 6, "Notes", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    for row in locs:
        pdf.cell(8, 5, row[0])
        pdf.cell(52, 5, row[1])
        pdf.cell(38, 5, row[2])
        pdf.cell(0, 5, row[3], new_x="LMARGIN", new_y="NEXT")

    pdf.section("6. Auto-routing")
    pdf.body("TMMT rings these slugs when webhook URL is in PARTNER_APP_WEBHOOKS_JSON:")
    pdf.bullet("Pickup: hub (vendor_connect, freight_logistics, fleet_manager) + moving, rentals, express, auto, etc.")
    pdf.bullet("Delivery: hub + moving, rentals, express, black, luxury, auto, etc.")
    pdf.bullet("Full move: hub + moving, service_arbitrage, cleaning, rentals, property, etc.")

    pdf.section("7. Setup per GHL location")
    steps = [
        "Add 15 contact custom fields (tmmt_job_ref, tmmt_pickup, etc.)",
        "Create pipeline TMMT Dispatch Jobs: New -> Assigned -> In Progress -> Complete -> Closed",
        "Workflow TMMT - Dispatch Job Received: Inbound Webhook trigger",
        "Map webhook flat keys to contact fields; create opportunity; tag tmmt-dispatch-job-new",
        "Copy hook URL to PARTNER_APP_WEBHOOKS_JSON in Vercel; redeploy TMMT",
        "Test at /internal/dispatch/new",
    ]
    for i, s in enumerate(steps, 1):
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 5, f"{i}. {s}")

    pdf.section("8. TMMT prerequisites (once)")
    pdf.bullet("Migration: supabase/migrations/0032_job_dispatch_hub.sql")
    pdf.bullet("GHL_API_KEY + GHL_LOCATION_ID=Xcd8DZt5T4GWnBtBEC5V")
    pdf.bullet("PARTNER_APP_WEBHOOKS_JSON with all hook URLs")
    pdf.bullet("OPS_COMMAND_SECRET for API / Codex test scripts")

    pdf.section("9. Codex automation")
    pdf.body("Paste scripts/codex/PROMPT_GHL_DISPATCH.txt into Codex:")
    for cmd in [
        "npm run ghl-dispatch:migrate",
        "npm run ghl-dispatch:fields",
        "npm run ghl-dispatch:env:write",
        "npm run ghl-dispatch:test",
    ]:
        pdf.set_font("Courier", "", 9)
        pdf.cell(0, 5, cmd, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.ln(2)
    pdf.body("Manual in GHL: inbound webhook workflows + pipeline (Codex can use browser).")

    pdf.section("10. Affiliate apps (you don't control GHL)")
    pdf.bullet("Jobs stay in TMMT OS cases + vendor portal")
    pdf.bullet("Use Zapier/Make if affiliate allows")
    pdf.bullet("Staff handoff via /internal/dispatch/new")

    pdf.section("11. Key paths")
    paths = [
        ("/internal/dispatch/new", "Staff dispatch form"),
        ("/internal/dispatch", "Dispatch loads view"),
        ("POST /api/jobs/dispatch", "API for automations"),
        ("docs/GHL_DISPATCH_SETUP.md", "Full GHL guide"),
        ("scripts/ghl-dispatch/locations.json", "Your 4 location config"),
    ]
    for p, d in paths:
        pdf.set_font("Courier", "", 9)
        pdf.cell(75, 5, p)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(0, 5, d, new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(0, 6, "SUCCESS LOOKS LIKE", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(
        0,
        5,
        "Staff submits job. Case ref appears. GHL workflow runs. Contact fields filled. "
        "Opportunity in New. Team gets SMS/task. Optional vendor accepts in TMMT vendor portal.",
    )

    pdf.output(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
