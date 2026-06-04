#!/usr/bin/env python3
"""Rebuild TODAY_COLLECTIONS.md from payment exceptions in latest daily brief."""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OPS = ROOT / "OPERATIONS"
OUT = OPS / "TODAY_COLLECTIONS.md"


def latest_brief() -> Path:
    briefs = sorted(OPS.glob("DAILY_BRIEF_*.md"), reverse=True)
    if not briefs:
        raise SystemExit("No DAILY_BRIEF_*.md — run daily_command_center.py first.")
    return briefs[0]


def parse_payments(text: str) -> list[dict]:
    rows = []
    in_section = False
    for line in text.splitlines():
        if line.startswith("## Customer Payments"):
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break
        if not in_section or not line.strip().startswith("- "):
            continue
        body = line.strip()[2:]
        name = body.split("  Amount:")[0].strip()
        amount = ""
        past_due = ""
        due = ""
        am = re.search(r"Amount:\s*([^ ]+)", body)
        if am:
            amount = am.group(1)
        pd = re.search(r"Past due:\s*\$?\$?([^ ]+)", body)
        if pd:
            past_due = pd.group(1)
        du = re.search(r"Due:\s*(\d{4}-\d{2}-\d{2})", body)
        if du:
            due = du.group(1)
        score = 0
        try:
            score = float(past_due.replace(",", "")) if past_due else float(amount.replace("$", "").replace(",", "") or 0)
        except ValueError:
            score = 0
        rows.append({
            "name": name,
            "amount": amount,
            "past_due": past_due,
            "due": due,
            "body": body,
            "score": score,
        })
    rows.sort(key=lambda r: r["score"], reverse=True)
    return rows


def write_queue(brief: Path, rows: list[dict]) -> None:
    today = date.today().isoformat()
    lines = [
        "# Today — Collections Queue",
        "",
        f"**Generated from:** `{brief.name}` (Supabase live)  ",
        f"**Updated:** {today}  ",
        "**Rule:** Work top to bottom. Mark paid or plan in CRM before moving to new sales.",
        "",
        "---",
        "",
        "## Priority 1 — Highest past-due exposure",
        "",
        "| # | Customer | Amount due | Past due (reported) | Action |",
        "|---|----------|------------|---------------------|--------|",
    ]
    for i, r in enumerate(rows[:5], 1):
        action = "Call today — payment plan or legal per policy"
        if i == 1:
            action = "Call + payment plan or legal per policy"
        lines.append(
            f"| {i} | {r['name']} | {r['amount'] or '—'} | "
            f"{'$' + r['past_due'] if r['past_due'] else '—'} | {action} |"
        )
    lines += [
        "",
        "---",
        "",
        "## Priority 2 — Remaining overdue",
        "",
        "| # | Customer | Notes |",
        "|---|----------|--------|",
    ]
    for i, r in enumerate(rows[5:15], 6):
        note = r["body"][:80]
        lines.append(f"| {i} | {r['name']} | {note} |")
    if len(rows) > 15:
        lines += [
            "",
            f"*+ {len(rows) - 15} more in brief `{brief.name}`*",
        ]
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({min(len(rows), 15)} rows)")


def main() -> int:
    brief = latest_brief()
    text = brief.read_text(encoding="utf-8")
    rows = parse_payments(text)
    if not rows:
        print("No payment rows in brief.")
        return 1
    write_queue(brief, rows)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
