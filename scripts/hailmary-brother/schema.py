#!/usr/bin/env python3
"""Brother layer DB — uses Dual Setup Sync schema (deprecated standalone DB)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "dual-sync"))

from schema import init_db, print_status  # noqa: E402

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Brother inbox (dual-sync DB)")
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()
    conn = init_db()
    print_status(conn)
