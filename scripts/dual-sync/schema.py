#!/usr/bin/env python3
"""Dual Setup Sync — universal local state DB (versioned, upgradeable)."""

from __future__ import annotations

import argparse
import os
import sqlite3
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CURRENT_SCHEMA = 1


def resolve_db_path() -> Path:
    if os.environ.get("DUAL_SYNC_DB"):
        p = Path(os.environ["DUAL_SYNC_DB"])
        p.parent.mkdir(parents=True, exist_ok=True)
        return p
    for p in (
        Path.home() / ".hailmary" / "dual-sync.db",
        ROOT / ".hailmary" / "dual-sync.db",
    ):
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            test = sqlite3.connect(p)
            test.close()
            return p
        except (OSError, sqlite3.Error):
            continue
    raise RuntimeError("Cannot open dual-sync database in ~/.hailmary or repo .hailmary")

MIGRATIONS: dict[int, str] = {
    1: """
CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS principals (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    tier TEXT NOT NULL,
    org_slug TEXT,
    brain_mesh TEXT,
    voice_ladder_default TEXT NOT NULL DEFAULT 'draft',
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
    mesh_name TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    principal_id TEXT NOT NULL,
    always_on INTEGER NOT NULL DEFAULT 0,
    channels TEXT,
    synced_at INTEGER,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_pairs (
    pair_id TEXT PRIMARY KEY,
    principal_id TEXT NOT NULL,
    mobile_mesh TEXT NOT NULL,
    brain_mesh TEXT NOT NULL,
    modules TEXT,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_voice (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    principal_id TEXT NOT NULL,
    handle TEXT NOT NULL,
    display_name TEXT,
    relationship TEXT,
    register TEXT,
    ladder TEXT NOT NULL DEFAULT 'draft',
    approved_samples INTEGER NOT NULL DEFAULT 0,
    config_json TEXT,
    updated_at INTEGER NOT NULL,
    UNIQUE(principal_id, handle)
);

CREATE TABLE IF NOT EXISTS sync_inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    principal_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    sender_handle TEXT NOT NULL,
    sender_name TEXT,
    text TEXT,
    device_mesh TEXT,
    received_at INTEGER NOT NULL,
    route TEXT NOT NULL DEFAULT 'pending',
    ladder TEXT NOT NULL DEFAULT 'draft',
    owner_sender INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inbox_id INTEGER REFERENCES sync_inbox(id),
    principal_id TEXT NOT NULL,
    reply_handle TEXT NOT NULL,
    draft_text TEXT NOT NULL,
    final_text TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    source TEXT NOT NULL DEFAULT 'dual-sync',
    approved_at INTEGER,
    sent_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    principal_id TEXT,
    device_mesh TEXT,
    payload_json TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inbox_status ON sync_inbox(status);
CREATE INDEX IF NOT EXISTS idx_inbox_principal ON sync_inbox(principal_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON sync_outbox(status);
CREATE INDEX IF NOT EXISTS idx_voice_principal ON contact_voice(principal_id);
""",
}


def get_schema_version(conn: sqlite3.Connection) -> int:
    try:
        row = conn.execute(
            "SELECT value FROM schema_meta WHERE key = 'schema_version'"
        ).fetchone()
        return int(row[0]) if row else 0
    except sqlite3.Error:
        return 0


def migrate(conn: sqlite3.Connection, target: int = CURRENT_SCHEMA) -> None:
    current = get_schema_version(conn)
    while current < target:
        nxt = current + 1
        sql = MIGRATIONS.get(nxt)
        if not sql:
            raise RuntimeError(f"No migration for schema version {nxt}")
        conn.executescript(sql)
        conn.execute(
            "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)",
            (str(nxt),),
        )
        conn.commit()
        current = nxt


def init_db() -> sqlite3.Connection:
    db_path = resolve_db_path()
    conn = sqlite3.connect(db_path)
    migrate(conn)
    return conn


def import_registry(conn: sqlite3.Connection, registry: dict) -> int:
    """Import principals/devices/pairs from validated registry YAML dict."""
    now = int(time.time())
    n = 0
    for pid, p in (registry.get("principals") or {}).items():
        conn.execute(
            """INSERT OR REPLACE INTO principals
               (id, display_name, tier, org_slug, brain_mesh, voice_ladder_default, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                pid,
                p.get("display_name"),
                p.get("tier", "operator"),
                p.get("org_slug"),
                p.get("brain_mesh"),
                p.get("voice_ladder_default", "draft"),
                now,
            ),
        )
        n += 1

    for mesh, d in (registry.get("devices") or {}).items():
        channels = ",".join(d.get("channels") or [])
        conn.execute(
            """INSERT OR REPLACE INTO devices
               (mesh_name, role, principal_id, always_on, channels, synced_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                mesh,
                d.get("role", "mobile_command"),
                d.get("principal_id", "unknown"),
                1 if d.get("always_on") else 0,
                channels,
                now,
                now,
            ),
        )
        n += 1

    for pair_id, pair in (registry.get("sync_pairs") or {}).items():
        mods = ",".join(pair.get("sync_modules") or [])
        conn.execute(
            """INSERT OR REPLACE INTO sync_pairs
               (pair_id, principal_id, mobile_mesh, brain_mesh, modules, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                pair_id,
                pair.get("principal_id"),
                pair.get("mobile_mesh"),
                pair.get("brain_mesh"),
                mods,
                now,
            ),
        )
        n += 1

    conn.commit()
    return n


def print_status(conn: sqlite3.Connection) -> None:
    ver = get_schema_version(conn)
    db_path = resolve_db_path()
    print(f"DB: {db_path}  schema_version={ver}")
    for table in ("principals", "devices", "sync_pairs", "sync_inbox", "sync_outbox", "contact_voice"):
        try:
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"  {table}: {count}")
        except sqlite3.Error:
            print(f"  {table}: (missing)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Dual Setup Sync database")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--import-registry", action="store_true", help="Load from local registry YAML")
    args = parser.parse_args()

    conn = init_db()

    if args.import_registry:
        import sys
        sys.path.insert(0, str(Path(__file__).parent))
        from registry import load_registry, validate

        data = load_registry()
        errs = validate(data)
        if errs:
            print("Registry invalid — fix before import:")
            for e in errs:
                print(f"  • {e}")
            sys.exit(1)
        n = import_registry(conn, data)
        print(f"Imported {n} registry records into {resolve_db_path()}")

    print_status(conn)


if __name__ == "__main__":
    main()
