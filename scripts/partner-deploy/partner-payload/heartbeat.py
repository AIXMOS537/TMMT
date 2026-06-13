#!/usr/bin/env python3
"""
heartbeat.py — 24h heartbeat to Supabase.

Shipped data (matches §16-A clickwrap promise EXACTLY):
  - hardware_uuid (so the license cannot be copied)
  - app_version (running app version)
  - action_counter (logins, intakes_submitted, etc.) — counts, NOT contents

Does NOT ship: screen, files, client data, conversations.
"""
import json
import os
import pathlib
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

CONFIG = pathlib.Path.home() / ".config" / "tmmt" / "partner.env"
COUNTER_FILE = pathlib.Path.home() / "Library" / "Application Support" / "aixmos-partner" / "action-counter.json"
LOG = pathlib.Path.home() / "Library" / "Application Support" / "aixmos-partner" / "heartbeat.log"
APP_VERSION = "0.1.0-v1"


def log(msg: str) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as f:
        f.write(f"{time.strftime('%FT%TZ', time.gmtime())} {msg}\n")


def read_config() -> dict:
    out = {}
    for line in CONFIG.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def hardware_uuid() -> str:
    out = subprocess.check_output(
        ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"], text=True
    )
    for line in out.splitlines():
        if "IOPlatformUUID" in line:
            return line.split('"')[-2]
    raise RuntimeError("could not read IOPlatformUUID")


def read_and_reset_counter() -> dict:
    """Read the action counter file, reset to zero for next interval, return prior values."""
    if not COUNTER_FILE.exists():
        return {}
    try:
        prior = json.loads(COUNTER_FILE.read_text())
    except json.JSONDecodeError:
        prior = {}
    COUNTER_FILE.write_text("{}")
    return prior


def main() -> int:
    cfg = read_config()
    body = json.dumps(
        {
            "tenant_id": cfg["PARTNER_TENANT_ID"],
            "hardware_uuid": hardware_uuid(),
            "app_version": APP_VERSION,
            "action_counter": read_and_reset_counter(),
        }
    ).encode()

    req = urllib.request.Request(
        f"{cfg['SUPABASE_URL']}/rest/v1/partner_heartbeats",
        data=body,
        headers={
            "apikey": cfg["SUPABASE_ANON_KEY"],
            "Authorization": f"Bearer {cfg['SUPABASE_ANON_KEY']}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            log(f"heartbeat_ok status={resp.status}")
            return 0
    except urllib.error.HTTPError as e:
        log(f"heartbeat_http_error status={e.code} body={e.read()!r}")
        return 1
    except urllib.error.URLError as e:
        log(f"heartbeat_network_error err={e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
