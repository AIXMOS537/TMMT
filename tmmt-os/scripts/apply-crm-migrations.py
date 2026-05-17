#!/usr/bin/env python3
"""Apply 0002 + 0003 when SUPABASE_DB_URL or DATABASE_URL is set."""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "supabase/migrations/0002_crm_sync.sql",
    ROOT / "supabase/migrations/0003_portal_renter_view.sql",
]


def main() -> int:
    db_url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    if not db_url:
        print(
            "Set SUPABASE_DB_URL (Supabase → Settings → Database → URI, mode Session)\n"
            "  export SUPABASE_DB_URL='postgresql://postgres.[ref]:[PASSWORD]@...'\n"
            "  python3 scripts/apply-crm-migrations.py\n"
            "Or paste RUN_0002_0003_IN_SQL_EDITOR.sql in the SQL Editor.",
            file=sys.stderr,
        )
        return 1

    try:
        import psycopg2
    except ImportError:
        print("pip3 install psycopg2-binary", file=sys.stderr)
        return 1

    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            for path in FILES:
                sql = path.read_text(encoding="utf-8")
                print(f"Applying {path.name}...")
                cur.execute(sql)
                print(f"  OK")
        print("All CRM migrations applied.")
        return 0
    except Exception as exc:
        print(f"Failed: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
