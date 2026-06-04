#!/usr/bin/env python3
"""Refresh COMMAND_CENTER.md date + Top 3 from the latest DAILY_BRIEF_*.md."""

from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OPS = ROOT / "OPERATIONS"
CC = OPS / "COMMAND_CENTER.md"


def latest_brief() -> Path | None:
    briefs = sorted(OPS.glob("DAILY_BRIEF_*.md"), reverse=True)
    return briefs[0] if briefs else None


def parse_priorities(text: str) -> list[str]:
    m = re.search(
        r"## Top 3 Priorities\s*\n+(.*?)(?:\n---|\n## )",
        text,
        re.DOTALL | re.IGNORECASE,
    )
    if not m:
        return []
    items = []
    for line in m.group(1).splitlines():
        line = line.strip()
        if re.match(r"^\d+\.\s+", line):
            items.append(re.sub(r"^\d+\.\s+", "", line).strip())
    return items[:3]


def parse_top_payments(text: str, limit: int = 5) -> list[str]:
    rows = []
    in_section = False
    for line in text.splitlines():
        if line.startswith("## Customer Payments"):
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break
        if in_section and line.strip().startswith("- "):
            rows.append(line.strip()[2:])
        if len(rows) >= limit:
            break
    return rows


def parse_hot_leads(text: str, limit: int = 3) -> list[str]:
    hot = []
    in_section = False
    for line in text.splitlines():
        if line.startswith("## Incoming Leads"):
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break
        if not in_section or not line.strip().startswith("- "):
            continue
        body = line.strip()[2:].lower()
        if any(k in body for k in ("no resp", "form sent", "waiting", "follow up", "unsuccessful")):
            hot.append(line.strip()[2:])
        if len(hot) >= limit:
            break
    return hot


def update_command_center(brief_path: Path) -> None:
    text = brief_path.read_text(encoding="utf-8")
    priorities = parse_priorities(text)
    today = date.today()
    weekday = today.strftime("%A, %B %-d, %Y")

    if not CC.exists():
        raise SystemExit(f"Missing {CC}")

    cc = CC.read_text(encoding="utf-8")

    cc = re.sub(
        r"\*\*Date:\*\*\s*[^\n]+",
        f"**Date:** {weekday}",
        cc,
        count=1,
    )

    if priorities:
        block = "\n".join(f"{i}. {p}" for i, p in enumerate(priorities, 1)) + "\n"

        def _replace_top3(m: re.Match[str]) -> str:
            return m.group(1) + block

        cc = re.sub(
            r"(### Top 3 Priorities\s*\n)(?:\d+\..*\n?)+",
            _replace_top3,
            cc,
            count=1,
        )

    brief_name = brief_path.name
    generated = ""
    gm = re.search(r"\*\*Generated:\*\*\s*([^\n]+)", text)
    if gm:
        generated = gm.group(1).strip()

    footer = (
        f"**Brief:** [`{brief_name}`](./{brief_name})"
        f"{f' (Supabase live, {generated})' if generated else ''}"
        f" · **Collections:** [`TODAY_COLLECTIONS.md`](./TODAY_COLLECTIONS.md)"
    )
    if "**Brief:**" in cc:
        cc = re.sub(r"\*\*Brief:\*\*[^\n]*", footer, cc, count=1)
    else:
        cc = cc.rstrip() + "\n\n---\n\n" + footer + "\n"

    CC.write_text(cc, encoding="utf-8")
    print(f"Updated COMMAND_CENTER.md ← {brief_name}")
    if priorities:
        for i, p in enumerate(priorities, 1):
            print(f"  {i}. {p}")


def main() -> int:
    brief = latest_brief()
    if not brief:
        print("No DAILY_BRIEF_*.md found — run daily_command_center.py first.")
        return 1
    update_command_center(brief)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
