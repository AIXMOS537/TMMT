#!/usr/bin/env python3
"""Draft lead follow-up messages from Supabase (no AI required)."""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT_BASE = ROOT / "OPERATIONS" / "VA_LEAD_DRAFTS"


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def supabase_leads(limit: int) -> list[dict]:
    url = (
        os.environ.get("COMMAND_CENTER_SUPABASE_URL")
        or os.environ.get("SUPABASE_URL")
        or ""
    ).rstrip("/")
    key = (
        os.environ.get("COMMAND_CENTER_SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or ""
    )
    if not url or not key:
        raise SystemExit("Missing Supabase URL/key in AUTOMATIONS/.env")

    params = urllib.parse.urlencode({
        "select": "id,contact_name,phone,email,opportunity_name,priority_level,notes,status,created_on",
        "order": "created_on.desc",
        "limit": str(min(limit * 3, 60)),
    })
    req = urllib.request.Request(
        f"{url}/rest/v1/incoming_leads?{params}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def first_name(name: str) -> str:
    return (name or "there").strip().split()[0] if name else "there"


def pick_template(lead: dict) -> tuple[str, str]:
    status = (lead.get("status") or "").lower()
    notes = (lead.get("notes") or "").lower()
    blob = f"{status} {notes}"
    name = first_name(lead.get("contact_name") or "")
    if "not interested" in blob:
        return "close_loop", f"Hi {name}, thanks for your time — we'll keep you on the list when inventory opens. Reply STOP anytime."
    if "form sent" in blob or "no resp" in blob:
        return "follow_up", (
            f"Hi {name}, it's TMMT Rentals — checking if you still need a vehicle this week. "
            "Reply YES and we'll send the quick form link, or call us back at your convenience."
        )
    if "waiting" in blob or "inventory" in blob:
        return "inventory_wait", (
            f"Hi {name}, quick update from TMMT — we have units rotating in. "
            "Want me to hold the next available slot for you? Reply YES or your preferred dates."
        )
    return "new_lead", (
        f"Hi {name}, thanks for reaching out to TMMT Rentals. "
        "I can get you options today — what's your pickup date and budget range?"
    )


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "lead").lower()).strip("-")[:40]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()

    load_env(ROOT / "AUTOMATIONS" / ".env")
    load_env(ROOT / "tmmt-os" / ".env.local")

    leads = supabase_leads(args.limit)
    hot = []
    for lead in leads:
        blob = f"{lead.get('status','')} {lead.get('notes','')}".lower()
        if any(k in blob for k in ("no resp", "form sent", "waiting", "follow", "unsuccessful", "new lead", "qualified")):
            if "not interested" not in blob and "dnd" not in blob:
                hot.append(lead)
    hot = hot[: args.limit]

    if not hot:
        print("No actionable leads matched.")
        return 0

    day = date.today().isoformat()
    out_dir = OUT_BASE / day
    out_dir.mkdir(parents=True, exist_ok=True)
    index_rows = []

    for lead in hot:
        key, message = pick_template(lead)
        name = lead.get("contact_name") or "Lead"
        fname = f"{slug(name)}-{str(lead.get('id',''))[:8]}.md"
        body = f"""# {name} — {key.replace('_', ' ').title()}

| Field | Value |
|-------|-------|
| Lead ID | {lead.get('id', '—')} |
| Status | {lead.get('status', '—')} |
| Phone | {lead.get('phone', '—')} |
| Email | {lead.get('email', '—')} |

## Draft (template — approve before send)

```
{message}
```

---
*Generated {date.today().isoformat()} · Template draft (no AI)*
"""
        (out_dir / fname).write_text(body, encoding="utf-8")
        index_rows.append((name, lead.get("status", ""), key, fname))
        print(f"  ✓ {first_name(name)} ({key})")

    index = [
        f"# VA Lead Drafts — {day}",
        "",
        f"**{len(index_rows)}** template drafts — approve then send:",
        "",
        "```bash",
        "aix-biz send          # interactive: g=GHL  i=iMessage  w=WhatsApp",
        "aix-biz open-ghl      # GHL inbox (WhatsApp + SMS for rentals)",
        "```",
        "",
        "| Lead | Status | Type | File |",
        "|------|--------|------|------|",
    ]
    for name, status, key, fname in index_rows:
        index.append(f"| {name} | {status} | {key} | [{fname}](./{fname}) |")
    (out_dir / "INDEX.md").write_text("\n".join(index) + "\n", encoding="utf-8")
    print(f"\nWrote {out_dir.relative_to(ROOT)} ({len(index_rows)} leads)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
