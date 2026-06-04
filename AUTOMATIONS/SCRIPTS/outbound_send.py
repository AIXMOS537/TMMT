#!/usr/bin/env python3
"""
Send approved outbound messages — iMessage, GHL (SMS → WhatsApp in GHL), WhatsApp deep link.

Usage:
  outbound_send.py channels
  outbound_send.py send --file draft.md --channel ghl|imessage|whatsapp|auto [--yes]
  outbound_send.py queue [--date YYYY-MM-DD] [--limit N]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
import webbrowser
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OPS = ROOT / "OPERATIONS"
DRAFTS = OPS / "VA_LEAD_DRAFTS"
CONFIG = Path(__file__).resolve().parents[1] / "CONFIG" / "outbound_channels.json"
GHL_BASE = "https://services.leadconnectorhq.com"
IMESSAGE_SEND = ROOT / "scripts" / "office-agent-channel" / "imessage_send.sh"


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


def load_config() -> dict:
    if CONFIG.exists():
        with CONFIG.open(encoding="utf-8") as f:
            return json.load(f)
    return {}


def normalize_phone(raw: str) -> str:
    s = (raw or "").strip()
    if not s or s in ("—", "-", "n/a"):
        return ""
    if s.startswith("+"):
        digits = re.sub(r"\D", "", s)
        return f"+{digits}" if digits else ""
    digits = re.sub(r"\D", "", s)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if digits:
        return f"+{digits}"
    return ""


def parse_draft(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    name = path.stem
    if text.startswith("# "):
        name = text.split("\n", 1)[0].lstrip("# ").split("—")[0].strip()

    phone = email = lead_id = ""
    for line in text.splitlines():
        if "| Phone |" in line:
            phone = line.split("|", 3)[2].strip()
        if "| Email |" in line:
            email = line.split("|", 3)[2].strip()
        if "| Lead ID |" in line:
            lead_id = line.split("|", 3)[2].strip()

    msg = ""
    m = re.search(r"## Draft[^\n]*\n+```\n(.*?)```", text, re.DOTALL)
    if m:
        msg = m.group(1).strip()

    return {
        "path": path,
        "name": name,
        "phone": normalize_phone(phone),
        "email": email if email and email not in ("—", "-") else "",
        "lead_id": lead_id,
        "message": msg,
    }


def ghl_headers() -> dict:
    key = os.environ.get("GHL_API_KEY", "").strip()
    if not key:
        raise SystemExit("Missing GHL_API_KEY in tmmt-os/.env.local")
    return {
        "Authorization": f"Bearer {key}",
        "Version": "2021-07-28",
        "Content-Type": "application/json",
    }


def ghl_location_id() -> str:
    loc = os.environ.get("GHL_LOCATION_ID", "").strip()
    if not loc:
        raise SystemExit("Missing GHL_LOCATION_ID")
    return loc


def ghl_request(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{GHL_BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=ghl_headers(), method=method)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())


def ghl_find_contact(name: str, email: str) -> str | None:
    loc = ghl_location_id()
    query = (name or "").strip()
    if not query and email:
        query = email
    if not query:
        return None
    try:
        res = ghl_request(
            "POST",
            "/contacts/search",
            {"locationId": loc, "pageLimit": 5, "query": query},
        )
    except Exception:
        return None
    contacts = res.get("contacts") or []
    if not contacts:
        return None
    if len(contacts) == 1:
        return contacts[0].get("id")
    norm = query.lower()
    for c in contacts:
        full = f"{c.get('firstName','')} {c.get('lastName','')}".strip().lower()
        if norm in full or full in norm:
            return c.get("id")
    return contacts[0].get("id")


def ghl_send_sms(contact_id: str, message: str) -> None:
    loc = ghl_location_id()
    body: dict = {
        "type": load_config().get("ghl_message_type", "SMS"),
        "contactId": contact_id,
        "message": message,
        "locationId": loc,
    }
    provider = os.environ.get("GHL_CONVERSATION_PROVIDER_ID", "").strip()
    if provider:
        body["conversationProviderId"] = provider
    ghl_request("POST", "/conversations/messages", body)


def ghl_open_inbox() -> None:
    loc = ghl_location_id()
    url = f"https://app.gohighlevel.com/v2/location/{loc}/conversations/conversations"
    subprocess.run(["open", url], check=False)


def ghl_open_contact(contact_id: str) -> None:
    loc = ghl_location_id()
    url = f"https://app.gohighlevel.com/v2/location/{loc}/contacts/detail/{contact_id}"
    subprocess.run(["open", url], check=False)


def imessage_send(phone: str, message: str) -> bool:
    if not IMESSAGE_SEND.is_file():
        print(f"Missing iMessage script: {IMESSAGE_SEND}", file=sys.stderr)
        return False
    env = os.environ.copy()
    env["IMESSAGE_BUDDY"] = phone
    p = subprocess.run(
        ["/bin/bash", str(IMESSAGE_SEND), message[:4000]],
        env=env,
        capture_output=True,
        text=True,
    )
    if p.returncode != 0:
        print(p.stderr or p.stdout, file=sys.stderr)
    return p.returncode == 0


def whatsapp_open(phone: str, message: str) -> None:
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("1") and len(digits) == 11:
        pass
    elif len(digits) == 10:
        digits = "1" + digits
    q = urllib.parse.quote(message)
    url = f"https://wa.me/{digits}?text={q}"
    subprocess.run(["open", url], check=False)
    print(f"Opened WhatsApp compose: wa.me/{digits}")
    print("  (Personal WhatsApp — for customers use GHL when possible.)")


def copy_message(message: str) -> None:
    p = subprocess.run(["pbcopy"], input=message, text=True, capture_output=True)
    if p.returncode == 0:
        print("  ✓ Message copied to clipboard")


def confirm(prompt: str, force: bool) -> bool:
    if force:
        return True
    try:
        ans = input(f"{prompt} [y/N]: ").strip().lower()
    except EOFError:
        return False
    return ans in ("y", "yes")


def pick_channel(draft: dict, requested: str) -> str:
    if requested != "auto":
        return requested
    cfg = load_config()
    order = cfg.get("fallback_order", ["ghl", "whatsapp", "imessage"])
    for ch in order:
        if ch == "ghl" and os.environ.get("GHL_API_KEY"):
            return "ghl"
        if ch == "imessage" and draft["phone"]:
            return "imessage"
        if ch == "whatsapp" and draft["phone"]:
            return "whatsapp"
    return "ghl"


def cmd_send(args: argparse.Namespace) -> int:
    path = Path(args.file)
    if not path.is_file():
        raise SystemExit(f"Not found: {path}")
    draft = parse_draft(path)
    if not draft["message"]:
        raise SystemExit("No message in draft (``` block under ## Draft)")

    channel = pick_channel(draft, args.channel)
    print(f"Contact: {draft['name']}")
    print(f"Phone:   {draft['phone'] or '(none)'}")
    print(f"Email:   {draft['email'] or '(none)'}")
    print(f"Channel: {channel}")
    print(f"Message:\n{draft['message'][:500]}{'…' if len(draft['message']) > 500 else ''}\n")

    if not confirm("Send this message?", args.yes):
        print("Cancelled.")
        return 0

    if channel == "imessage":
        if not draft["phone"]:
            raise SystemExit("No phone on draft — use ghl or add phone to lead in Supabase/GHL")
        if imessage_send(draft["phone"], draft["message"]):
            print("✓ Sent via iMessage")
            return 0
        raise SystemExit("iMessage send failed (Messages.app signed in?)")

    if channel == "whatsapp":
        if not draft["phone"]:
            raise SystemExit("No phone — use ghl")
        whatsapp_open(draft["phone"], draft["message"])
        copy_message(draft["message"])
        return 0

    if channel == "ghl":
        cid = ghl_find_contact(draft["name"], draft["email"])
        if cid:
            ghl_send_sms(cid, draft["message"])
            print(f"✓ Sent via GHL (SMS/WhatsApp routing) — contact {cid[:8]}…")
            return 0
        print("! GHL contact not found by name — opening inbox + copying message")
        copy_message(draft["message"])
        if load_config().get("open_ghl_inbox_when_contact_missing", True):
            ghl_open_inbox()
        print(f"  Search for: {draft['name']}")
        return 1

    raise SystemExit(f"Unknown channel: {channel}")


def cmd_queue(args: argparse.Namespace) -> int:
    day = args.date or date.today().isoformat()
    folder = DRAFTS / day
    if not folder.is_dir():
        raise SystemExit(f"No drafts folder: {folder}")

    files = sorted(
        p for p in folder.glob("*.md") if p.name.upper() != "INDEX.MD"
    )[: args.limit]

    if not files:
        print("No draft files.")
        return 0

    print(f"Outbound queue — {day} ({len(files)} drafts)")
    print("Keys: [g] GHL  [i] iMessage  [w] WhatsApp  [c] copy  [o] open GHL  [s] skip  [q] quit\n")

    for path in files:
        draft = parse_draft(path)
        if not draft["message"]:
            continue
        print(f"── {draft['name']} ({path.name})")
        print(draft["message"][:280] + ("…" if len(draft["message"]) > 280 else ""))
        print(f"   phone: {draft['phone'] or '—'}")
        try:
            choice = input("   Action [g/i/w/c/o/s/q]: ").strip().lower()
        except EOFError:
            print("\n(non-interactive — use: outbound_send.py send --file … --channel auto --yes)")
            break
        if choice in ("q", "quit"):
            break
        if choice in ("s", "skip", ""):
            continue
        if choice == "c":
            copy_message(draft["message"])
            continue
        if choice == "o":
            ghl_open_inbox()
            continue
        ch = {"g": "ghl", "i": "imessage", "w": "whatsapp"}.get(choice)
        if not ch:
            print("   Unknown key")
            continue
        if ch == "imessage" and not draft["phone"]:
            print("   ! No phone — try g or w via GHL inbox")
            continue
        ns = argparse.Namespace(
            file=str(path), channel=ch, yes=False,
        )
        try:
            cmd_send(ns)
        except SystemExit as e:
            print(f"   ! {e}")

    return 0


def cmd_channels() -> int:
    cfg = load_config()
    print("Outbound channels\n")
    ghl_ok = bool(os.environ.get("GHL_API_KEY") and os.environ.get("GHL_LOCATION_ID"))
    print(f"  GHL API:     {'✓ ready (SMS → WhatsApp when connected in GHL)' if ghl_ok else '○ set GHL_API_KEY + GHL_LOCATION_ID'}")
    print(f"  iMessage:    {'✓ ' + str(IMESSAGE_SEND) if IMESSAGE_SEND.is_file() else '○ script missing'}")
    print(f"  WhatsApp:    ✓ wa.me deep link (personal); customers → use GHL")
    print(f"  Default:     leads={cfg.get('lead_default','ghl')} collections={cfg.get('collections_default','ghl')}")
    print(f"  Fallback:    {' → '.join(cfg.get('fallback_order', []))}")
    if ghl_ok:
        print(f"\n  GHL inbox: https://app.gohighlevel.com/v2/location/{os.environ['GHL_LOCATION_ID']}/conversations/conversations")
    return 0


def main() -> int:
    load_env(ROOT / "AUTOMATIONS" / ".env")
    load_env(ROOT / "tmmt-os" / ".env.local")
    for proxy in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        os.environ.pop(proxy, None)

    parser = argparse.ArgumentParser(description="Multi-channel outbound (iMessage, GHL, WhatsApp)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("channels", help="Show channel status")

    p_send = sub.add_parser("send", help="Send one draft file")
    p_send.add_argument("--file", required=True)
    p_send.add_argument(
        "--channel",
        choices=["ghl", "imessage", "whatsapp", "auto"],
        default="auto",
    )
    p_send.add_argument("--yes", action="store_true", help="Skip confirmation")

    p_q = sub.add_parser("queue", help="Interactive send queue for today")
    p_q.add_argument("--date", default="")
    p_q.add_argument("--limit", type=int, default=20)

    args = parser.parse_args()
    if args.cmd == "channels":
        return cmd_channels()
    if args.cmd == "send":
        return cmd_send(args)
    if args.cmd == "queue":
        return cmd_queue(args)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
