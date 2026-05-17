#!/usr/bin/env python3
"""
Push overdue customer payments to TMMT OS → GHL tag payment-overdue.

Requires env (AUTOMATIONS/.env or shell):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or anon with RLS)
  TMMT_OPS_URL          e.g. https://tmmt-ops.vercel.app
  GHL_WEBHOOK_SECRET    sent as X-GHL-Secret

Optional mapping table: customer_payments.ghl_contact_id if column exists;
otherwise set GHL_CONTACT_MAP_JSON path to {"Customer Name": "ghl_id"}.

Usage:
  python3 AUTOMATIONS/SCRIPTS/push_overdue_to_ghl.py
  python3 AUTOMATIONS/SCRIPTS/push_overdue_to_ghl.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / "AUTOMATIONS" / ".env"
TMMT_ENV_LOCAL = ROOT / "tmmt-os" / ".env.local"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if not key:
            continue
        existing = os.environ.get(key, "").strip()
        if not existing:
            os.environ[key] = value


def load_env() -> None:
    load_env_file(ENV_FILE)
    load_env_file(TMMT_ENV_LOCAL)  # non-empty values win over empty AUTOMATIONS/.env


def supabase_rows(table: str, select: str = "*", limit: int = 200) -> list[dict]:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_ANON_KEY"]
    url = f"{base}/rest/v1/{table}?select={select}&limit={limit}"
    req = urllib.request.Request(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def is_overdue(row: dict, today: date) -> bool:
    status = (row.get("payment_status") or row.get("Payment Status") or "").lower()
    if status in {"paid", "complete", "completed", "closed"}:
        return False
    past = row.get("amout_past_due") or row.get("amount_past_due") or row.get("Amout Past Due")
    if past not in (None, "", "0", 0):
        return True
    due = row.get("next_payment_due_date") or row.get("Next Payment Due Date") or ""
    if not due:
        return False
    try:
        d = datetime.fromisoformat(str(due)[:10]).date()
        return d < today
    except ValueError:
        return False


def contact_id_for(row: dict, contact_map: dict[str, str]) -> str | None:
    cid = row.get("ghl_contact_id") or row.get("GHL Contact ID")
    if cid:
        return str(cid)
    name = row.get("customer") or row.get("Customer") or ""
    return contact_map.get(name)


def post_overdue(base_url: str, secret: str, payload: dict) -> dict:
    url = f"{base_url.rstrip('/')}/api/webhooks/ghl/overdue"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-GHL-Secret": secret,
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    load_env()
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    for key in ("SUPABASE_URL", "TMMT_OPS_URL", "GHL_WEBHOOK_SECRET"):
        if not (os.environ.get(key) or "").strip():
            raise SystemExit(
                f"Missing env: {key} — set in AUTOMATIONS/.env or tmmt-os/.env.local"
            )

    map_path = os.environ.get("GHL_CONTACT_MAP_JSON")
    contact_map: dict[str, str] = {}
    if map_path and Path(map_path).exists():
        contact_map = json.loads(Path(map_path).read_text(encoding="utf-8"))

    today = date.today()
    rows = supabase_rows("customer_payments")
    overdue = [r for r in rows if is_overdue(r, today)]

    print(f"Found {len(overdue)} overdue payment row(s)")
    sent = 0
    for row in overdue:
        cid = contact_id_for(row, contact_map)
        if not cid:
            name = row.get("customer") or row.get("Customer") or "?"
            print(f"  skip (no GHL contact_id): {name}")
            continue
        payload = {
            "contact_id": cid,
            "customer_name": row.get("customer") or row.get("Customer"),
            "amount_due": row.get("amout_past_due")
            or row.get("amount_past_due")
            or row.get("amount")
            or row.get("Amount"),
            "due_date": str(
                row.get("next_payment_due_date")
                or row.get("Next Payment Due Date")
                or ""
            )[:10],
            "source": "push_overdue_to_ghl",
        }
        if args.dry_run:
            print(f"  [dry-run] {payload}")
            continue
        try:
            out = post_overdue(os.environ["TMMT_OPS_URL"], os.environ["GHL_WEBHOOK_SECRET"], payload)
            print(f"  ok {cid}: {out.get('message', out)}")
            sent += 1
        except urllib.error.HTTPError as e:
            print(f"  fail {cid}: {e.read().decode()}")

    print(f"Done. Sent {sent} webhook(s).")


if __name__ == "__main__":
    main()
