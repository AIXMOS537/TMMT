#!/usr/bin/env python3
"""
Daily Command Center Generator – TMMT Rentals
Pulls live data from Supabase (Airtable mirror) with local markdown fallback.

Usage:
    python3 AUTOMATIONS/SCRIPTS/daily_command_center.py
    python3 AUTOMATIONS/SCRIPTS/daily_command_center.py --date YYYY-MM-DD
"""

from __future__ import annotations

import argparse
import json
import urllib.request
import urllib.parse
import urllib.error
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "AUTOMATIONS" / "CONFIG" / "daily_command_center.json"

CLOSED_STATUSES = {"done", "complete", "completed", "closed", "resolved", "paid",
                   "sold/archived", "archived", "cancelled", "contracted", "do not rent"}


# ── Config ─────────────────────────────────────────────────────────────────────

def load_config(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_env_file(path: Path) -> None:
    """Load KEY=value lines into os.environ (does not override existing)."""
    import os

    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def apply_supabase_env(config: dict) -> None:
    """Prefer AUTOMATIONS/.env over committed config (no secrets in JSON)."""
    import os

    sb = config.setdefault("integrations", {}).setdefault("supabase", {})
    if os.environ.get("SUPABASE_URL"):
        sb["url"] = os.environ["SUPABASE_URL"]
    if os.environ.get("SUPABASE_ANON_KEY"):
        sb["anon_key"] = os.environ["SUPABASE_ANON_KEY"]
    if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        sb["service_key"] = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


# ── Supabase client (stdlib only) ──────────────────────────────────────────────

def supabase_query(base_url: str, key: str, table: str,
                   select: str = "*", filters: dict | None = None,
                   limit: int = 200) -> list[dict] | None:
    """Query a Supabase PostgREST table. Returns None on any error."""
    params = {"select": select, "limit": str(limit)}
    if filters:
        params.update(filters)
    url = f"{base_url}/rest/v1/{table}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None


# ── Local markdown fallback ────────────────────────────────────────────────────

def _split_row(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def _is_separator(line: str) -> bool:
    if not line.strip().startswith("|"):
        return False
    return all(set(c.replace(":", "").strip()) <= {"-"} for c in _split_row(line) if c)


def parse_md_table(path: Path) -> list[dict]:
    if not path.exists():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    rows, headers, in_table = [], [], False
    for i, line in enumerate(lines):
        line = line.strip()
        if not line.startswith("|"):
            if in_table:
                break
            continue
        if not in_table:
            if i + 1 < len(lines) and _is_separator(lines[i + 1]):
                headers = [h.lower().replace(" ", "_").replace("/", "_") for h in _split_row(line)]
                in_table = True
            continue
        if _is_separator(line):
            continue
        cells = (_split_row(line) + [""] * len(headers))[: len(headers)]
        row = dict(zip(headers, cells))
        if any(v.strip() for v in row.values()):
            rows.append(row)
    return rows


# ── Date helpers ───────────────────────────────────────────────────────────────

def parse_date(s: str) -> date | None:
    if not s:
        return None
    s = s.strip().split("T")[0]  # handle ISO datetimes
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def is_due_or_overdue(val: str, today: date) -> bool:
    d = parse_date(val)
    return bool(d and d <= today)


def is_closed(status: str) -> bool:
    return (status or "").strip().lower() in CLOSED_STATUSES


def flag(val: str, today: date) -> str:
    d = parse_date(val)
    if not d:
        return ""
    if d < today:
        return "  ⚠️ OVERDUE"
    if d == today:
        return "  ← TODAY"
    return ""


# ── Section builders ───────────────────────────────────────────────────────────

def section(title: str, items: list[str]) -> str:
    body = "\n".join(items) if items else "- (none)"
    return f"## {title}\n\n{body}\n"


def build_leads(rows: list[dict], today: date) -> list[str]:
    """Incoming leads needing follow-up — from Supabase incoming_leads."""
    out = []
    for r in rows:
        status = (r.get("status") or "").strip()
        if is_closed(status):
            continue
        name     = r.get("contact_name") or r.get("Contact Name") or ""
        phone    = r.get("phone") or r.get("phone") or ""
        priority = r.get("priority_level") or r.get("Priority Level") or ""
        notes    = r.get("notes") or r.get("Notes") or ""
        updated  = r.get("updated_on") or r.get("last_modified_time") or ""
        line = f"- {name}"
        if phone:    line += f"  📞 {phone}"
        if priority: line += f"  [{priority}]"
        if status:   line += f"  Status: {status}"
        if notes:    line += f"  – {notes[:80]}"
        out.append(line)
    return out[:15] or ["- No open leads found."]


def build_active_customers(rows: list[dict], today: date) -> list[str]:
    """Active customers with payment or maintenance due — from active_customers."""
    out = []
    for r in rows:
        status = (r.get("status") or r.get("Status") or "").strip()
        if status.lower() not in {"active"}:
            continue
        name    = r.get("customer_name") or r.get("Customer Name") or ""
        if not name.strip():
            continue
        phone   = r.get("contact_phone") or r.get("Contact Phone") or ""
        maint   = r.get("scheduled_maintenance") or ""
        pay_amt = r.get("payment_amount") or r.get("Payment Amount") or ""
        pay_rel = r.get("payment_reliability_rating") or ""
        repo    = r.get("repo_status") or ""
        line = f"- {name}"
        if phone:   line += f"  📞 {phone}"
        if pay_amt: line += f"  Payment: {pay_amt}"
        if maint:   line += f"  Maint due: {maint[:10]}{flag(maint[:10], today)}"
        # Only flag bad reliability — A/Excellent are good
        if pay_rel and pay_rel.upper() not in {"A", "EXCELLENT", "GOOD", ""}:
            line += f"  ⚠️ Pay reliability: {pay_rel}"
        # Only flag actual repos, not "Not Repossessed"
        if repo and repo.lower() == "repossessed":
            line += f"  🚨 REPO"
        out.append(line)
    return out or ["- No active customers found."]


def build_payments(rows: list[dict], today: date) -> list[str]:
    """Unpaid / overdue customer payments — from customer_payments."""
    out = []
    for r in rows:
        status = (r.get("payment_status") or r.get("Payment Status") or "").strip()
        if is_closed(status):
            continue
        customer = r.get("customer") or r.get("Customer") or ""
        amount   = r.get("amount") or r.get("Amount") or ""
        due      = r.get("next_payment_due_date") or r.get("Next Payment Due Date") or ""
        past_due = r.get("amout_past_due") or r.get("amount_past_due") or r.get("Amout Past Due") or ""
        line = f"- {customer}"
        if amount:   line += f"  Amount: ${amount}"
        if due:      line += f"  Due: {due}{flag(due, today)}"
        if past_due: line += f"  Past due: ${past_due}  ⚠️"
        if status:   line += f"  [{status}]"
        out.append(line)
    return out[:20] or ["- No outstanding payments found."]


def build_fleet_alerts(rows: list[dict]) -> list[str]:
    """Fleet vehicles not available — from fleet table."""
    alert_statuses = {"maintenance", "out of service", "inspection needed"}
    out = []
    for r in rows:
        status = (r.get("vehicle_status") or r.get("Vehicle Status") or "").strip()
        if status.lower() not in alert_statuses:
            continue
        name  = r.get("vehicle_name") or r.get("Vehicle Name") or ""
        make  = r.get("vehicle_make") or r.get("Vehicle Make") or ""
        model = r.get("vehicle_model") or r.get("Vehicle Model") or ""
        year  = r.get("year") or r.get("Year") or ""
        notes = r.get("notes") or r.get("Notes") or ""
        line = f"- [{status.upper()}] {year} {make} {model} ({name})"
        if notes: line += f"  – {notes[:80]}"
        if status.lower() == "out of service":
            line += "  🚨"
        out.append(line)
    return out or ["- All fleet vehicles operational."]


def build_maintenance(rows: list[dict], today: date) -> list[str]:
    """Upcoming/overdue maintenance appointments."""
    out = []
    for r in rows:
        status = (r.get("status") or r.get("Status") or "").strip()
        if is_closed(status):
            continue
        customer = r.get("active_customer_if_applicable") or r.get("fleet_vehicle") or r.get("Fleet Vehicle") or "Vehicle TBD"
        appt     = r.get("appointment_date_time") or r.get("Appointment Date & Time") or ""
        mtype    = r.get("maintenance_type") or r.get("Maintenance Type") or ""
        provider = r.get("service_provider_location") or r.get("Service Provider/Location") or ""
        staff    = r.get("assigned_staff") or r.get("Assigned Staff") or ""
        notes    = r.get("notes") or r.get("Notes") or ""
        line = f"- {customer}"
        if mtype:    line += f"  [{mtype}]"
        if appt:     line += f"  📅 {appt[:10]}{flag(appt[:10], today)}"
        if provider: line += f"  @ {provider}"
        if staff:    line += f"  Assigned: {staff}"
        if notes:    line += f"  – {notes[:60]}"
        if status:   line += f"  ({status})"
        out.append(line)
    return out[:15] or ["- No pending maintenance appointments."]


def build_tickets(rows: list[dict], today: date) -> list[str]:
    """Open high-priority tickets / risk signals."""
    out = []
    for r in rows:
        status = (r.get("status") or r.get("Status") or "").strip()
        if is_closed(status):
            continue
        priority = (r.get("priority") or r.get("Priority") or "").strip()
        customer = r.get("requested_by_customer") or r.get("Requested By (Customer)") or ""
        desc     = r.get("description_issue_details") or r.get("Description / Issue Details") or ""
        amount   = r.get("amount") or r.get("Amount") or ""
        followup = r.get("follow_up_date") or r.get("Follow-up Date") or ""
        vtype    = r.get("violation_type") or r.get("Violation Type") or ""
        line = f"- [{priority or 'Open'}] {customer}"
        if vtype: line += f"  Type: {vtype}"
        if desc:  line += f"  – {desc[:80]}"
        if amount: line += f"  ${amount}"
        if followup: line += f"  Follow-up: {followup}{flag(followup, today)}"
        out.append(line)
    return out[:15] or ["- No open tickets."]


def build_do_not_rent(rows: list[dict]) -> list[str]:
    out = []
    for r in rows:
        name   = r.get("person_entity_name") or r.get("Person/Entity Name") or ""
        reason = r.get("reason_for_restriction") or r.get("Reason for Restriction") or ""
        cat    = r.get("alert_category_ai") or r.get("Alert Category (AI)") or ""
        line = f"- 🚫 {name}"
        if cat:    line += f"  [{cat}]"
        if reason: line += f"  – {reason[:80]}"
        out.append(line)
    return out or []


def build_sop_gaps(rows: list[dict]) -> list[str]:
    out = []
    for r in rows:
        status = (r.get("status") or r.get("Status") or "").strip()
        if status.lower() in {"active", "retired"}:
            continue
        sop   = r.get("sop") or r.get("SOP") or ""
        dept  = r.get("department") or r.get("Department") or ""
        owner = r.get("owner") or r.get("Owner") or ""
        line  = f"- [{status or 'No status'}] {sop}"
        if dept:  line += f"  ({dept})"
        if not owner: line += "  ← Needs owner"
        out.append(line)
    return out or ["- No SOP gaps found."]


def build_automation_opps(rows: list[dict]) -> list[str]:
    out = []
    for r in rows:
        status = (r.get("status") or r.get("Status") or "").strip()
        if is_closed(status):
            continue
        priority = (r.get("priority") or r.get("Priority") or "").strip()
        if priority.lower() != "high":
            continue
        name = r.get("automation") or r.get("Automation") or ""
        prob = r.get("problem_solved") or r.get("Problem Solved") or ""
        tool = r.get("tool") or r.get("Tool") or ""
        line = f"- [{status}] {name}"
        if prob: line += f" – {prob}"
        if tool: line += f"  (Tool: {tool})"
        out.append(line)
    return out or ["- No high-priority automations open."]


def synthesize_priorities(fleet, maintenance, payments, tickets, leads, sop, active=None) -> list[str]:
    active = active or []
    priorities = []

    fleet_critical = [f for f in fleet if "🚨" in f or "OUT OF SERVICE" in f]
    if fleet_critical:
        priorities.append("🚗 URGENT: Resolve out-of-service fleet vehicles immediately")
    elif any("⚠️" in f for f in fleet):
        priorities.append("🚗 Address fleet maintenance and inspection alerts")

    overdue_pay = [p for p in payments if "⚠️" in p or "OVERDUE" in p]
    if overdue_pay:
        priorities.append(f"💰 Collect {len(overdue_pay)} overdue/unpaid customer payment(s)")

    open_tickets = [t for t in tickets if "High" in t or "🚨" in t]
    if open_tickets:
        priorities.append(f"🎫 Resolve {len(open_tickets)} high-priority open ticket(s)")

    repo = [c for c in active if "🚨 REPO" in c]
    if repo:
        priorities.append(f"🚨 Handle {len(repo)} repossessed vehicle(s)")

    maint_overdue = [m for m in maintenance if "OVERDUE" in m]
    if maint_overdue:
        priorities.append(f"🔧 Complete {len(maint_overdue)} overdue maintenance appointment(s)")

    sop_needed = [s for s in sop if "Needs owner" in s]
    if len(sop_needed) >= 3:
        priorities.append("📋 Assign owners to critical SOPs (Fleet, Finance, Customers)")

    defaults = [
        "Review open leads and advance top-priority prospects",
        "Confirm all fleet vehicles are operational and documented",
        "Update payment records and follow up on any outstanding balances",
    ]
    for d in defaults:
        if len(priorities) >= 3:
            break
        priorities.append(d)

    return priorities[:3]


# ── Main brief builder ─────────────────────────────────────────────────────────

def build_brief(config: dict, today: date) -> str:
    sb_cfg = config.get("integrations", {}).get("supabase", {})
    sb_enabled = sb_cfg.get("enabled", False)
    sb_url = sb_cfg.get("url", "")
    sb_key = sb_cfg.get("service_key") or sb_cfg.get("anon_key", "")

    data_source = "Supabase (live)" if sb_enabled else "Local markdown files"
    sb_errors = []

    def fetch(table: str, select: str, filters: dict | None = None) -> list[dict]:
        if not sb_enabled:
            return []
        rows = supabase_query(sb_url, sb_key, table, select, filters)
        if rows is None:
            sb_errors.append(table)
            return []
        return rows

    # ── Fetch from Supabase ────────────────────────────────────────────────────
    leads_rows = fetch(
        "incoming_leads",
        "contact_name,phone,email,priority_level,status,notes,updated_on",
    )
    active_rows = fetch(
        "active_customers",
        "customer_name,contact_phone,status,repo_status,scheduled_maintenance,"
        "payment_amount,payment_frequency,payment_reliability_rating,service_notes",
    )
    payment_rows = fetch(
        "customer_payments",
        "customer,customer_phone_number,amount,next_payment_due_date,"
        "payment_status,past_due_dates,amout_past_due,notes",
    )
    fleet_rows = fetch(
        "fleet",
        "vehicle_name,vehicle_status,vehicle_make,vehicle_model,year,mileage,"
        "last_maintenance_date,notes,partner_name",
    )
    maint_rows = fetch(
        "maintenance_appointments",
        "active_customer_if_applicable,appointment_date_time,maintenance_type,status,"
        "service_provider_location,notes,assigned_staff",
    )
    ticket_rows = fetch(
        "tickets",
        "requested_by_customer,description_issue_details,status,priority,"
        "amount,follow_up_date,violation_type,internal_notes",
    )
    dnr_rows = fetch(
        "do_not_rent_list",
        "person_entity_name,reason_for_restriction,alert_category_ai,date_added",
    )

    # ── Fall back to local markdown if Supabase disabled/failed ───────────────
    sop_rows = parse_md_table(ROOT / "SOPS" / "SOP_INDEX.md")
    auto_rows = parse_md_table(ROOT / "AUTOMATIONS" / "AUTOMATION_BACKLOG.md")
    cc_rows   = parse_md_table(ROOT / "OPERATIONS" / "COMMAND_CENTER.md")

    if sb_errors:
        data_source += f"  ⚠️ Failed tables: {', '.join(sb_errors)}"
    if not sb_enabled or (not leads_rows and not fleet_rows and not payment_rows):
        data_source = "Local markdown files (Supabase unavailable or returned no data)"

    # ── Build sections ─────────────────────────────────────────────────────────
    fleet_section   = build_fleet_alerts(fleet_rows)
    maint_section   = build_maintenance(maint_rows, today)
    payment_section = build_payments(payment_rows, today)
    ticket_section  = build_tickets(ticket_rows, today)
    lead_section    = build_leads(leads_rows, today)
    active_section  = build_active_customers(active_rows, today)
    dnr_section     = build_do_not_rent(dnr_rows)
    sop_section     = build_sop_gaps(sop_rows)
    auto_section    = build_automation_opps(auto_rows)

    # Open command center tasks from local markdown
    open_tasks = [
        r for r in cc_rows if not is_closed(r.get("Status", ""))
    ]
    task_lines = [
        f"- {r.get('task','(task)')}  Owner: {r.get('owner','')}  Due: {r.get('due_date','')}  {r.get('next_action','')}"
        for r in open_tasks
    ] or ["- No open tasks in command center."]

    priorities = synthesize_priorities(
        fleet_section, maint_section, payment_section,
        ticket_section, lead_section, sop_section, active_section
    )

    dnr_block = ("\n**Do Not Rent List:**\n" + "\n".join(dnr_section)) if dnr_section else ""

    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    return f"""# Daily Command Center Brief – TMMT Rentals

**Date:** {today.strftime("%A, %B %d, %Y")}
**Generated:** {generated_at}
**Data Source:** {data_source}

---

## Top 3 Priorities

1. {priorities[0]}
2. {priorities[1]}
3. {priorities[2]}

---

{section("Open Command Center Tasks", task_lines)}
---

{section("Incoming Leads (Open)", lead_section)}
---

{section("Active Customers", active_section)}
---

{section("Customer Payments – Exceptions", payment_section)}
---

{section("Fleet Alerts", fleet_section)}
---

{section("Maintenance Appointments", maint_section)}
---

{section("Open Tickets", ticket_section + ([dnr_block] if dnr_block else []))}
---

{section("SOP / Process Gaps", sop_section)}
---

{section("High-Priority Automation Opportunities", auto_section)}
---

## Recommended Next Actions

- Resolve any ⚠️ OVERDUE or 🚨 flagged items before starting new work.
- Update payment and fleet records after each action.
- Move completed items to a closed status so tomorrow's brief stays clean.
- Add owners and due dates to any SOP marked "Needs owner".

---

*Generated by `AUTOMATIONS/SCRIPTS/daily_command_center.py`*
*Refine output with: `AUTOMATIONS/PROMPTS/daily_command_center_prompt.md`*
"""


# ── Output writers ─────────────────────────────────────────────────────────────

def write_outputs(config: dict, today: date, content: str) -> tuple[Path, Path]:
    out_dir = ROOT / config["output_directory"]
    log_dir = ROOT / config["log_directory"]
    out_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)

    out_path = out_dir / f"DAILY_BRIEF_{today.isoformat()}.md"
    log_path = log_dir / "daily_command_center.log"

    out_path.write_text(content, encoding="utf-8")
    with log_path.open("a", encoding="utf-8") as f:
        f.write(f"{datetime.now().isoformat(timespec='seconds')}  generated  {out_path.relative_to(ROOT)}\n")

    return out_path, log_path


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Generate daily command center brief.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--date", default=date.today().isoformat())
    args = parser.parse_args()

    config = load_config(Path(args.config))
    load_env_file(ROOT / "AUTOMATIONS" / ".env")
    apply_supabase_env(config)
    today  = datetime.strptime(args.date, "%Y-%m-%d").date()
    content = build_brief(config, today)
    out, log = write_outputs(config, today, content)

    print(f"Generated : {out.relative_to(ROOT)}")
    print(f"Logged    : {log.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
