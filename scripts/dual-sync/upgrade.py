#!/usr/bin/env python3
"""Dual Setup Sync — upgrade registry schema_version and local DB."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description="Upgrade dual-sync registry + DB")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sys.path.insert(0, str(SCRIPTS))
    from registry import load_registry, LOCAL, validate
    from schema import init_db, import_registry, CURRENT_SCHEMA, get_schema_version

    try:
        data = load_registry()
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        sys.exit(1)

    reg_ver = int(data.get("schema_version") or 1)
    print(f"Registry schema_version: {reg_ver}")

    errs = validate(data)
    if errs:
        print("Registry validation FAILED:")
        for e in errs:
            print(f"  • {e}")
        sys.exit(1)
    print("Registry validation: PASS")

    conn = init_db()
    db_ver = get_schema_version(conn)
    print(f"Local DB schema_version: {db_ver} (target {CURRENT_SCHEMA})")

    if args.dry_run:
        print("Dry run — no import.")
        return

    if db_ver < CURRENT_SCHEMA:
        print(f"Migrated DB → v{CURRENT_SCHEMA}")

    n = import_registry(conn, data)
    print(f"Synced {n} records from registry.")

    if LOCAL.is_file():
        print(f"Local registry: {LOCAL}")
    else:
        print("Tip: copy example → dual-sync.registry.local.yaml for production numbers")


if __name__ == "__main__":
    main()
