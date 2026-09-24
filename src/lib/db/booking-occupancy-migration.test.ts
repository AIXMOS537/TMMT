/**
 * Schema contract for vehicle blocks + the booking occupancy ledger (E6b).
 *
 * WHAT THIS TEST IS, HONESTLY: a structural guard over the migration text. The
 * migration is NOT applied to production, so there is no live table here. The
 * behaviour (23P01 on overlap, a waiting second writer, hold expiry, org
 * isolation) was proven on the throwaway project against a copy of the live
 * bookings shape and is recorded in M1-HANDOFF-E6.md. This file makes sure
 * nobody quietly edits away the pieces that behaviour depends on.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { HOLD_TTL_MINUTES, BLOCKING_STATUSES } from "@/lib/rental-pricing/availability";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const MIGRATION = join(MIGRATIONS, "20260924180000_vehicle_blocks_and_booking_occupancy.sql");

const raw = existsSync(MIGRATION) ? readFileSync(MIGRATION, "utf8") : "";
/** Strip `--` comments so a constraint that only survives in a comment does not pass. */
const code = raw
  .split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n");
const norm = code.replace(/\s+/g, " ").toLowerCase();

const OCCUPYING = "status in ('hold','confirmed','active')";

describe("migration exists", () => {
  it("is on disk — if this fails, nothing below means anything", () => {
    expect(existsSync(MIGRATION)).toBe(true);
    expect(norm.length).toBeGreaterThan(2000);
  });

  it("runs in one transaction", () => {
    expect(norm.trimStart().startsWith("begin;")).toBe(true);
    expect(norm.trimEnd().endsWith("commit;")).toBe(true);
  });
});

describe("bookings is canonical — no second reservation table", () => {
  it("creates no reservations table anywhere in the repo's migrations", () => {
    for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql"))) {
      const sql = readFileSync(join(MIGRATIONS, f), "utf8").toLowerCase();
      expect(sql, `${f} creates public.reservations`).not.toMatch(
        /create table (if not exists )?(public\.)?reservations\b/,
      );
    }
  });

  it("never touches the legacy fleet table", () => {
    expect(norm).not.toMatch(/public\.fleet\b/);
  });

  it("uses the same occupying statuses as the app", () => {
    expect([...BLOCKING_STATUSES]).toEqual(["hold", "confirmed", "active"]);
  });
});

describe("records the live bookings guards, create-only-if-missing", () => {
  const GUARDS: [string, string][] = [
    [
      "bookings_status_check",
      "check (status in ('hold','confirmed','active','completed','cancelled','no_show'))",
    ],
    ["bookings_interval_sane", "check (starts_at is null or ends_at is null or ends_at > starts_at)"],
    [
      "bookings_no_overlap",
      "exclude using gist (vehicle_id with =, tstzrange(starts_at, ends_at, '[)') with &&) " +
        `where (vehicle_id is not null and starts_at is not null and ends_at is not null and ${OCCUPYING})`,
    ],
  ];

  for (const [name, def] of GUARDS) {
    it(`${name} matches prod and sits behind an existence check`, () => {
      expect(norm).toContain(
        `if not exists (select 1 from pg_constraint where conname = '${name}' and conrelid = 'public.bookings'::regclass)`,
      );
      expect(norm).toContain(`alter table public.bookings add constraint ${name} ${def}`);
    });
  }

  it("records the calendar index with IF NOT EXISTS", () => {
    expect(norm).toContain(
      `create index if not exists bookings_vehicle_window_idx on public.bookings (vehicle_id, starts_at, ends_at) where ${OCCUPYING}`,
    );
  });

  it("changes exactly one thing on bookings' columns: the status default, to 'hold'", () => {
    expect(norm).not.toMatch(/drop constraint[^;]*bookings/);
    expect(norm).not.toMatch(/policy [^;]* on public\.bookings/);
    const alters = norm.match(/alter table public\.bookings (alter|drop)[^;]*;/g) ?? [];
    expect(alters).toEqual(["alter table public.bookings alter column status set default 'hold';"]);
  });

  it("the new default is inside the allowed status set", () => {
    expect(norm).toContain("check (status in ('hold','confirmed','active','completed','cancelled','no_show'))");
    expect(norm).not.toContain("'inquiry'");
  });
});

describe("block vs booking: one exclusion on the occupancy ledger", () => {
  it("vehicle_blocks has the four kinds and an FK to the canonical vehicle", () => {
    expect(norm).toContain("check (kind in ('maintenance','out_of_service','owner_hold','damage'))");
    expect(norm).toContain(
      "add constraint vehicle_blocks_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id)",
    );
  });

  it("the ledger's exclusion only fires across source types", () => {
    expect(norm).toContain(
      "add constraint vehicle_occupancy_no_block_overlap exclude using gist " +
        "(vehicle_id with =, period with &&, source_type with <>)",
    );
    expect(norm).toContain("check (source_type in ('booking','block'))");
  });

  it("bookings and vehicle_blocks both feed the ledger on insert, update and delete", () => {
    for (const t of ["bookings", "vehicle_blocks"]) {
      expect(norm).toMatch(
        new RegExp(
          `create trigger ${t}_sync_occupancy after insert or update or delete on public\\.${t} ` +
            "for each row execute function public\\.vehicle_occupancy_sync\\(\\)",
        ),
      );
    }
  });

  it("only occupying bookings with a car and dates, and ACTIVE blocks, land in the ledger", () => {
    expect(norm).toContain("v_occupies := new.status = 'active'");
    expect(norm).toContain(
      `v_occupies := new.${OCCUPYING} and new.vehicle_id is not null and new.starts_at is not null and new.ends_at is not null`,
    );
    expect(norm).toContain("v_period := tstzrange(new.starts_at, new.ends_at, '[)')");
  });

  it("backfills bookings that already occupy a car, idempotently", () => {
    expect(norm).toMatch(/insert into public\.vehicle_occupancy[^;]*from public\.bookings b[^;]*on conflict \(source_type, source_id\) do nothing;/);
  });

  it("the ledger writer is SECURITY DEFINER with a pinned search_path", () => {
    const fn = norm.slice(norm.indexOf("create or replace function public.vehicle_occupancy_sync()"));
    expect(fn.slice(0, 200)).toContain("security definer set search_path = ''");
  });
});

describe("tenant integrity: row org must match the vehicle's org", () => {
  it("one shared function raises 23514 with the vehicle_org_mismatch marker", () => {
    const fn = norm.slice(norm.indexOf("create or replace function public.enforce_vehicle_org()"));
    expect(fn.slice(0, 200)).toContain("security definer set search_path = ''");
    expect(fn).toContain("if v_org is not null and v_org is distinct from new.org_id then");
    expect(fn).toContain("raise exception 'vehicle_org_mismatch:");
    expect(fn).toContain("using errcode = '23514'");
    const raise = fn.slice(fn.indexOf("raise exception 'vehicle_org_mismatch:"), fn.indexOf("using errcode = '23514'"));
    expect(raise, "the message must not reveal the vehicle's own org").not.toContain("v_org");
  });

  for (const t of ["bookings", "vehicle_blocks"]) {
    it(`${t} runs it before insert or update of vehicle_id, org_id`, () => {
      expect(norm).toContain(
        `create trigger ${t}_enforce_vehicle_org before insert or update of vehicle_id, org_id on public.${t} ` +
          "for each row execute function public.enforce_vehicle_org();",
      );
    });
  }
});

describe("old 20260916235900 file is safe to re-run", () => {
  const OLD = join(MIGRATIONS, "20260916235900_bookings_no_double_booking.sql");
  const oldNorm = readFileSync(OLD, "utf8")
    .split("\n")
    .map((l) => l.replace(/--.*$/, ""))
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();

  for (const c of ["bookings_status_check", "bookings_interval_sane", "bookings_no_overlap"]) {
    it(`${c} is behind an existence check`, () => {
      expect(oldNorm).toContain(
        `if not exists (select 1 from pg_constraint where conname = '${c}' and conrelid = 'public.bookings'::regclass)`,
      );
    });
  }

  it("has no bare add constraint left", () => {
    const adds = oldNorm.split("add constraint").length - 1;
    const guarded = oldNorm.split("if not exists (select 1 from pg_constraint").length - 1;
    expect(adds).toBe(3);
    expect(guarded).toBe(adds);
  });
});

describe("hold expiry", () => {
  it("the SQL default TTL equals HOLD_TTL_MINUTES", () => {
    expect(norm).toContain(
      `create or replace function public.expire_stale_booking_holds( p_ttl interval default interval '${HOLD_TTL_MINUTES} minutes' )`,
    );
  });

  it("expires only holds older than the TTL, into an existing status", () => {
    expect(norm).toContain("set status = 'cancelled'");
    expect(norm).toContain("'cancel_reason', 'hold_expired'");
    expect(norm).toContain("where b.status = 'hold' and b.created_at < now() - p_ttl");
  });

  it("is callable by service_role only", () => {
    expect(norm).toContain(
      "revoke all on function public.expire_stale_booking_holds(interval) from public, anon, authenticated;",
    );
    expect(norm).toContain("grant execute on function public.expire_stale_booking_holds(interval) to service_role;");
  });

  it("is scheduled by pg_cron under a stable job name (idempotent upsert)", () => {
    expect(norm).toContain(
      "perform cron.schedule('expire-stale-booking-holds', '*/5 * * * *', 'select public.expire_stale_booking_holds()')",
    );
  });
});

describe("RLS", () => {
  it("is enabled on the new tables", () => {
    for (const t of ["vehicle_blocks", "vehicle_occupancy"]) {
      expect(norm).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
    }
  });

  it("reads are org-scoped with the repo's staff bypass", () => {
    for (const t of ["vehicle_blocks", "vehicle_occupancy"]) {
      expect(norm).toContain(
        `create policy org_member_read on public.${t} for select to authenticated ` +
          "using (public.is_staff() or public.is_org_member(org_id))",
      );
    }
  });

  it("block writes must name an org the caller belongs to", () => {
    expect(norm).toContain(
      "create policy org_member_write on public.vehicle_blocks for all to authenticated " +
        "using (public.is_staff() or public.is_org_member(org_id)) " +
        "with check (public.is_staff() or (org_id is not null and public.is_org_member(org_id)))",
    );
  });

  it("clients cannot write the occupancy ledger, and anon gets nothing", () => {
    expect(norm).not.toMatch(/create policy org_member_write on public\.vehicle_occupancy/);
    expect(norm).toContain(
      "revoke all on public.vehicle_blocks, public.vehicle_occupancy from anon, authenticated;",
    );
    expect(norm).toContain("grant select on public.vehicle_occupancy to authenticated;");
    expect(norm).not.toMatch(/grant [^;]*(insert|update|delete|truncate|all)[^;]*vehicle_occupancy/);
  });
});

describe("idempotency", () => {
  it("guards every create", () => {
    expect(norm).not.toMatch(/create table (?!if not exists)/);
    expect(norm).not.toMatch(/create index (?!if not exists)/);
    expect(norm).not.toMatch(/create function /);
    const policies = norm.match(/create policy (\w+) on ([\w.]+)/g) ?? [];
    for (const p of policies) {
      const [, name, table] = p.match(/create policy (\w+) on ([\w.]+)/)!;
      expect(norm, `policy ${name} on ${table} is not dropped first`).toContain(
        `drop policy if exists ${name} on ${table};`,
      );
    }
    const triggers = norm.match(/create trigger (\w+) \w+ [^;]*? on ([\w.]+)/g) ?? [];
    expect(triggers.length).toBe(4);
    for (const tr of triggers) {
      const [, name, table] = tr.match(/create trigger (\w+) \w+ [^;]*? on ([\w.]+)/)!;
      expect(norm, `trigger ${name} is not dropped first`).toContain(
        `drop trigger if exists ${name} on ${table};`,
      );
    }
  });

  it("every add constraint sits behind a pg_constraint existence check", () => {
    const added = [...norm.matchAll(/add constraint (\w+)/g)].map((m) => m[1]);
    expect(added.length).toBe(8);
    for (const c of added) {
      expect(norm, `constraint ${c} is not existence-guarded`).toContain(
        `if not exists (select 1 from pg_constraint where conname = '${c}'`,
      );
    }
  });
});
