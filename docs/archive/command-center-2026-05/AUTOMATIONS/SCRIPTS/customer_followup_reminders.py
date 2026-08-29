#!/usr/bin/env python3
"""Generate local customer follow-up reminders from the CRM tracker."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "AUTOMATIONS" / "CONFIG" / "customer_followups.json"


@dataclass
class FollowUpItem:
    row: dict[str, str]
    category: str
    urgency: str
    reason: str


def load_config(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def split_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def is_separator_row(line: str) -> bool:
    if not line.startswith("|"):
        return False
    cells = split_row(line)
    return bool(cells) and all(set(cell.replace(":", "").strip()) <= {"-"} for cell in cells)


def parse_first_markdown_table(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []

    lines = path.read_text(encoding="utf-8").splitlines()
    index = 0
    while index < len(lines) - 1:
        if lines[index].strip().startswith("|") and is_separator_row(lines[index + 1].strip()):
            headers = split_row(lines[index])
            rows: list[dict[str, str]] = []
            index += 2
            while index < len(lines) and lines[index].strip().startswith("|"):
                values = split_row(lines[index])
                row = {
                    header: values[position].strip() if position < len(values) else ""
                    for position, header in enumerate(headers)
                }
                if any(row.values()):
                    rows.append(row)
                index += 1
            return rows
        index += 1
    return []


def parse_date(value: str) -> date | None:
    cleaned = value.strip()
    if not cleaned:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            pass
    return None


def normalized(value: str) -> str:
    return value.strip().lower()


def is_inactive(row: dict[str, str], config: dict) -> bool:
    return normalized(row.get("Status", "")) in set(config.get("inactive_statuses", []))


def contact_method(row: dict[str, str]) -> str:
    phone = row.get("Phone", "").strip()
    email = row.get("Email", "").strip()
    if phone and email:
        return f"Phone: {phone}; Email: {email}"
    if phone:
        return f"Phone: {phone}"
    if email:
        return f"Email: {email}"
    return "No contact method listed"


def row_summary(row: dict[str, str]) -> str:
    parts = []
    for key in ("Customer", "Phone", "Email", "Status", "Source", "Last Contact", "Next Follow-Up", "Notes"):
        value = row.get(key, "").strip()
        if value:
            parts.append(f"{key}: {value}")
    return " | ".join(parts)


def build_message_draft(row: dict[str, str], default_response_window: str) -> str:
    name = row.get("Customer", "").strip() or "[NAME]"
    status = normalized(row.get("Status", ""))
    notes = row.get("Notes", "").strip().lower()

    if "extend" in notes or "extension" in notes:
        return (
            f"Hi {name}, I am checking on your rental extension request. "
            f"Extensions depend on availability. What dates do you need?"
        )
    if status in {"lead", "qualified"}:
        return (
            f"Hi {name}, just following up on your vehicle rental request. "
            f"Are you still looking for a vehicle? I can confirm availability within {default_response_window}."
        )
    if status == "active":
        return (
            f"Hi {name}, checking in on your rental. Let us know if you need anything or have questions."
        )
    return (
        f"Hi {name}, following up as promised. Let us know how we can help with your rental."
    )


def find_followups(rows: list[dict[str, str]], config: dict, today: date) -> list[FollowUpItem]:
    items: list[FollowUpItem] = []
    required_statuses = set(config.get("followup_required_statuses", []))

    for row in rows:
        if is_inactive(row, config):
            continue

        customer = row.get("Customer", "").strip()
        status = normalized(row.get("Status", ""))
        next_followup_raw = row.get("Next Follow-Up", "").strip()
        next_followup = parse_date(next_followup_raw)

        if next_followup and next_followup < today:
            days_overdue = (today - next_followup).days
            items.append(FollowUpItem(row, "Overdue", "High", f"Follow-up was due {days_overdue} day(s) ago."))
            continue

        if next_followup and next_followup == today:
            items.append(FollowUpItem(row, "Due Today", "Medium", "Follow-up is due today."))
            continue

        if customer and status in required_statuses and not next_followup_raw:
            items.append(FollowUpItem(row, "Missing Date", "Medium", "Customer status requires a next follow-up date."))
            continue

        if customer and next_followup_raw and not next_followup:
            items.append(FollowUpItem(row, "Invalid Date", "Medium", "Next follow-up date could not be parsed."))

    return items


def format_items(items: list[FollowUpItem], default_response_window: str) -> str:
    if not items:
        return "- No due, overdue, or missing-date customer follow-ups found."

    lines: list[str] = []
    for index, item in enumerate(items, 1):
        row = item.row
        customer = row.get("Customer", "").strip() or "Unnamed customer"
        lines.extend([
            f"### {index}. {customer}",
            "",
            f"- Category: {item.category}",
            f"- Urgency: {item.urgency}",
            f"- Reason: {item.reason}",
            f"- Contact: {contact_method(row)}",
            f"- CRM Record: {row_summary(row)}",
            "- Suggested Draft:",
            "",
            "```text",
            build_message_draft(row, default_response_window),
            "```",
            "",
        ])
    return "\n".join(lines).rstrip()


def build_report(config: dict, today: date) -> str:
    crm_path = ROOT / config["crm_tracker"]
    rows = parse_first_markdown_table(crm_path)
    items = find_followups(rows, config, today)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    approval_note = "Human approval required before sending any message." if config.get("approval_required", True) else "Review recommended before sending."

    overdue_count = sum(1 for item in items if item.category == "Overdue")
    due_today_count = sum(1 for item in items if item.category == "Due Today")
    missing_count = sum(1 for item in items if item.category in {"Missing Date", "Invalid Date"})

    return f"""# Customer Follow-Up Reminders

Date: {today.isoformat()}
Generated: {generated_at}

## Objective

Keep customer communication timely, logged, and template-based without automatically sending messages.

## Summary

| Metric | Count |
|---|---:|
| CRM records scanned | {len(rows)} |
| Overdue follow-ups | {overdue_count} |
| Due today | {due_today_count} |
| Missing/invalid follow-up dates | {missing_count} |
| Total action items | {len(items)} |

## Operating Rule

{approval_note}

## Follow-Up Action List

{format_items(items, config.get("default_response_window", "15 minutes"))}

## Recommended Next Actions

- Send approved follow-ups from the business line only.
- Log every customer response in `CUSTOMERS/CRM_TRACKER.md`.
- Add a next follow-up date after each customer interaction.
- Escalate complaints, damage, disputes, refunds, fee waivers, and extension decisions.

## Source Files Checked

- {config["crm_tracker"]}
- {config["message_templates"]}
"""


def write_outputs(config: dict, today: date, content: str) -> tuple[Path, Path]:
    output_dir = ROOT / config["output_directory"]
    log_dir = ROOT / config["log_directory"]
    output_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / f"FOLLOW_UPS_{today.isoformat()}.md"
    log_path = log_dir / "customer_followups.log"
    output_path.write_text(content, encoding="utf-8")
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"{datetime.now().isoformat(timespec='seconds')} generated {output_path.relative_to(ROOT)}\n")
    return output_path, log_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate customer follow-up reminders from the CRM tracker.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG), help="Path to JSON config.")
    parser.add_argument("--date", default=date.today().isoformat(), help="Report date in YYYY-MM-DD format.")
    args = parser.parse_args()

    config = load_config(Path(args.config))
    target_date = datetime.strptime(args.date, "%Y-%m-%d").date()
    content = build_report(config, target_date)
    output_path, log_path = write_outputs(config, target_date, content)

    print(f"Generated: {output_path.relative_to(ROOT)}")
    print(f"Logged: {log_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
