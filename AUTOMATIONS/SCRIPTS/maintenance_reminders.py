#!/usr/bin/env python3
"""Generate local fleet maintenance reminders from Markdown trackers."""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = ROOT / "AUTOMATIONS" / "CONFIG" / "maintenance_reminders.json"


@dataclass
class Alert:
    vehicle_id: str
    alert_type: str
    urgency: str
    reason: str
    source: str
    row: dict[str, str]


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


def parse_int(value: str) -> int | None:
    cleaned = value.strip().replace(",", "")
    if not cleaned:
        return None
    try:
        return int(float(cleaned))
    except ValueError:
        return None


def normalized(value: str) -> str:
    return value.strip().lower()


def row_text(row: dict[str, str]) -> str:
    return " | ".join(f"{key}: {value}" for key, value in row.items() if value)


def is_closed_maintenance(row: dict[str, str], config: dict) -> bool:
    return normalized(row.get("Status", "")) in set(config.get("closed_maintenance_statuses", []))


def vehicle_lookup(fleet_rows: list[dict[str, str]]) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}
    for row in fleet_rows:
        vehicle_id = row.get("Vehicle ID", "").strip()
        if vehicle_id:
            lookup[vehicle_id] = row
    return lookup


def vehicle_current_mileage(vehicle_id: str, fleet_by_id: dict[str, dict[str, str]]) -> int | None:
    return parse_int(fleet_by_id.get(vehicle_id, {}).get("Mileage", ""))


def has_high_risk_keyword(row: dict[str, str], config: dict) -> bool:
    text = row_text(row).lower()
    return any(keyword in text for keyword in config.get("high_risk_keywords", []))


def find_alerts(
    fleet_rows: list[dict[str, str]],
    maintenance_rows: list[dict[str, str]],
    inspection_rows: list[dict[str, str]],
    config: dict,
    today: date,
) -> list[Alert]:
    alerts: list[Alert] = []
    fleet_by_id = vehicle_lookup(fleet_rows)
    inactive_statuses = set(config.get("inactive_vehicle_statuses", []))
    risk_statuses = set(config.get("risk_vehicle_statuses", []))
    warning_buffer = int(config.get("mileage_warning_buffer", 500))
    due_soon_days = int(config.get("due_soon_days", 7))

    for row in fleet_rows:
        vehicle_id = row.get("Vehicle ID", "").strip() or "Unknown vehicle"
        status = normalized(row.get("Status", ""))
        if status in inactive_statuses:
            continue
        if status in risk_statuses:
            alerts.append(Alert(vehicle_id, "Fleet Status", "High", f"Vehicle status is '{row.get('Status', '')}'.", "FLEET/FLEET_REGISTER.md", row))
        if not row.get("Mileage", "").strip() and vehicle_id != "Unknown vehicle":
            alerts.append(Alert(vehicle_id, "Missing Mileage", "Medium", "Current mileage is missing from fleet register.", "FLEET/FLEET_REGISTER.md", row))

    for row in maintenance_rows:
        if is_closed_maintenance(row, config):
            continue

        vehicle_id = row.get("Vehicle ID", "").strip() or "Unknown vehicle"
        priority = normalized(row.get("Priority", ""))
        due_date_raw = row.get("Due Date", "")
        due_date = parse_date(due_date_raw)
        mileage_due = parse_int(row.get("Mileage Due", ""))
        current_mileage = vehicle_current_mileage(vehicle_id, fleet_by_id)

        if priority == "high":
            alerts.append(Alert(vehicle_id, "High Priority Service", "High", "Maintenance priority is High.", "FLEET/MAINTENANCE_TRACKER.md", row))

        if due_date and due_date < today:
            days_overdue = (today - due_date).days
            alerts.append(Alert(vehicle_id, "Overdue Service", "High", f"Service was due {days_overdue} day(s) ago.", "FLEET/MAINTENANCE_TRACKER.md", row))
        elif due_date and (due_date - today).days <= due_soon_days:
            days_until_due = (due_date - today).days
            alerts.append(Alert(vehicle_id, "Service Due Soon", "Medium", f"Service is due in {days_until_due} day(s).", "FLEET/MAINTENANCE_TRACKER.md", row))
        elif due_date_raw.strip() and not due_date:
            alerts.append(Alert(vehicle_id, "Invalid Due Date", "Medium", "Due date could not be parsed.", "FLEET/MAINTENANCE_TRACKER.md", row))

        if mileage_due is not None and current_mileage is not None:
            if current_mileage >= mileage_due:
                alerts.append(Alert(vehicle_id, "Mileage Service Due", "High", f"Current mileage {current_mileage:,} is at/over mileage due {mileage_due:,}.", "FLEET/MAINTENANCE_TRACKER.md", row))
            elif mileage_due - current_mileage <= warning_buffer:
                alerts.append(Alert(vehicle_id, "Mileage Service Due Soon", "Medium", f"{mileage_due - current_mileage:,} mile(s) until service threshold.", "FLEET/MAINTENANCE_TRACKER.md", row))
        elif mileage_due is not None and current_mileage is None:
            alerts.append(Alert(vehicle_id, "Mileage Check Needed", "Medium", "Mileage due is set, but current vehicle mileage is missing.", "FLEET/MAINTENANCE_TRACKER.md", row))

        if has_high_risk_keyword(row, config):
            alerts.append(Alert(vehicle_id, "Safety Keyword", "High", "Maintenance record contains a high-risk safety keyword.", "FLEET/MAINTENANCE_TRACKER.md", row))

    for row in inspection_rows:
        vehicle_id = row.get("Vehicle ID", "").strip() or "Unknown vehicle"
        action_needed = row.get("Action Needed", "").strip()
        damage_found = row.get("Damage Found", "").strip()
        condition = normalized(row.get("Condition", ""))

        if action_needed:
            alerts.append(Alert(vehicle_id, "Inspection Action Needed", "High", action_needed, "FLEET/INSPECTION_LOG.md", row))
        if damage_found and normalized(damage_found) not in {"no", "none", "n/a"}:
            alerts.append(Alert(vehicle_id, "Damage Found", "High", f"Inspection damage field: {damage_found}.", "FLEET/INSPECTION_LOG.md", row))
        if condition in {"poor", "unsafe", "fail", "failed"}:
            alerts.append(Alert(vehicle_id, "Failed/Poor Inspection", "High", f"Inspection condition is '{row.get('Condition', '')}'.", "FLEET/INSPECTION_LOG.md", row))
        if has_high_risk_keyword(row, config):
            alerts.append(Alert(vehicle_id, "Inspection Safety Keyword", "High", "Inspection record contains a high-risk safety keyword.", "FLEET/INSPECTION_LOG.md", row))

    return dedupe_alerts(alerts)


def dedupe_alerts(alerts: list[Alert]) -> list[Alert]:
    seen: set[tuple[str, str, str, str]] = set()
    unique: list[Alert] = []
    for alert in alerts:
        key = (alert.vehicle_id, alert.alert_type, alert.reason, row_text(alert.row))
        if key not in seen:
            seen.add(key)
            unique.append(alert)
    return unique


def recommended_action(alert: Alert) -> str:
    if alert.urgency == "High":
        return "Review before renting. Keep or move vehicle out of service until resolved if safety, damage, or drivability is unclear."
    return "Schedule service, confirm mileage/date, and update tracker with owner, vendor, and next action."


def format_alerts(alerts: list[Alert]) -> str:
    if not alerts:
        return "- No due, overdue, mileage-based, status-based, or inspection maintenance alerts found."

    lines: list[str] = []
    for index, alert in enumerate(alerts, 1):
        lines.extend([
            f"### {index}. {alert.vehicle_id}",
            "",
            f"- Alert Type: {alert.alert_type}",
            f"- Urgency: {alert.urgency}",
            f"- Reason: {alert.reason}",
            f"- Source: {alert.source}",
            f"- Record: {row_text(alert.row) or 'No row detail available'}",
            f"- Recommended Action: {recommended_action(alert)}",
            "",
        ])
    return "\n".join(lines).rstrip()


def build_report(config: dict, today: date) -> str:
    fleet_rows = parse_first_markdown_table(ROOT / config["fleet_register"])
    maintenance_rows = parse_first_markdown_table(ROOT / config["maintenance_tracker"])
    inspection_rows = parse_first_markdown_table(ROOT / config["inspection_log"])
    alerts = find_alerts(fleet_rows, maintenance_rows, inspection_rows, config, today)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M")

    high_count = sum(1 for alert in alerts if alert.urgency == "High")
    medium_count = sum(1 for alert in alerts if alert.urgency == "Medium")
    vehicles_with_alerts = len({alert.vehicle_id for alert in alerts})

    return f"""# Maintenance Reminders

Date: {today.isoformat()}
Generated: {generated_at}

## Objective

Surface fleet maintenance, inspection, mileage, and out-of-service risks before they create downtime, customer issues, or liability.

## Summary

| Metric | Count |
|---|---:|
| Fleet records scanned | {len(fleet_rows)} |
| Maintenance records scanned | {len(maintenance_rows)} |
| Inspection records scanned | {len(inspection_rows)} |
| Vehicles with alerts | {vehicles_with_alerts} |
| High urgency alerts | {high_count} |
| Medium urgency alerts | {medium_count} |
| Total alerts | {len(alerts)} |

## Operating Rule

Do not rent vehicles with unresolved high-urgency safety, damage, failed inspection, or out-of-service alerts.

## Maintenance Action List

{format_alerts(alerts)}

## Recommended Next Actions

- Add current mileage for every active vehicle in `FLEET/FLEET_REGISTER.md`.
- Add due dates and mileage thresholds for every recurring service item.
- Assign a vendor, owner, and status for each open maintenance record.
- Log all damage or inspection issues before the next rental.
- Mark completed maintenance as `Completed` so future reports stay clean.

## Source Files Checked

- {config["fleet_register"]}
- {config["maintenance_tracker"]}
- {config["inspection_log"]}
"""


def write_outputs(config: dict, today: date, content: str) -> tuple[Path, Path]:
    output_dir = ROOT / config["output_directory"]
    log_dir = ROOT / config["log_directory"]
    output_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / f"MAINTENANCE_REMINDERS_{today.isoformat()}.md"
    log_path = log_dir / "maintenance_reminders.log"
    output_path.write_text(content, encoding="utf-8")
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"{datetime.now().isoformat(timespec='seconds')} generated {output_path.relative_to(ROOT)}\n")
    return output_path, log_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate fleet maintenance reminders from local trackers.")
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
