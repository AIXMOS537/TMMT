/**
 * Schema contract for the rental reservation spine.
 *
 * WHAT THIS TEST IS, HONESTLY: a structural guard over the migration text. The
 * migration is NOT applied to production, so there is no live table here. The
 * behaviour (23P01 on overlap, a waiting second writer, org isolation) was proven
 * on the throwaway project and is recorded in M1-HANDOFF-E6.md; this file makes
 * sure nobody quietly edits away the pieces that behaviour depends on. Remove the
 * exclusion constraint, its status WHERE clause, the FK, the block enforcement or
 * RLS, and this goes red.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260924180000_rental_reservation_spine.sql",
);

const raw = existsSync(MIGRATION) ? readFileSync(MIGRATION, "utf8") : "";
/** Strip `--` comments so a constraint that only survives in a comment does not pass. */
const code = raw
  .split("\n")
  .map((l) => l.replace(/--.*$/, ""))
  .join("\n");
const norm = code.replace(/\s+/g, " ").toLowerCase();

const OCCUPYING = "status in ('pending','confirmed','converted_to_rental')";

describe("reservation spine migration exists", () => {
  it("is on disk — if this fails, nothing below means anything", () => {
    expect(existsSync(MIGRATION)).toBe(true);
    expect(norm.length).toBeGreaterThan(2000);
  });

  it("runs in one transaction", () => {
    expect(norm.trimStart().startsWith("begin;")).toBe(true);
    expect(norm.trimEnd().endsWith("commit;")).toBe(true);
  });
});

describe("reservation vs reservation: exclusion on (org_id, vehicle_id, period)", () => {
  it("declares the exclusion constraint with the occupying-status WHERE clause", () => {
    expect(norm).toContain(
      "add constraint reservations_no_double_booking exclude using gist " +
        "(org_id with =, vehicle_id with =, period with &&) " +
        `where (${OCCUPYING})`,
    );
  });

  it("cancelled and expired are NOT in the occupying set", () => {
    const where = norm.match(/reservations_no_double_booking exclude using gist \([^)]*\) where \(([^)]*)\)/);
    expect(where, "exclusion WHERE clause not found").not.toBeNull();
    expect(where![1]).not.toContain("cancelled");
    expect(where![1]).not.toContain("expired");
  });

  it("pins the lifecycle vocabulary", () => {
    expect(norm).toContain(
      "check (status in ('pending','confirmed','cancelled','expired','converted_to_rental'))",
    );
  });

  it("guards lifecycle transitions (terminal states are final)", () => {
    expect(norm).toContain("create or replace function public.rsv_guard_reservation_transition()");
    expect(norm).toContain(
      "(old.status = 'pending' and new.status in ('confirmed','cancelled','expired'))",
    );
    expect(norm).toContain(
      "(old.status = 'confirmed' and new.status in ('cancelled','expired','converted_to_rental'))",
    );
    expect(norm).toMatch(/create trigger reservations_guard_transition before update on public\.reservations/);
  });
});

describe("canonical vehicle FK", () => {
  it("reservations.vehicle_id references public.vehicles(id)", () => {
    expect(norm).toContain(
      "add constraint reservations_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id)",
    );
  });

  it("vehicle_blocks.vehicle_id references public.vehicles(id)", () => {
    expect(norm).toContain(
      "add constraint vehicle_blocks_vehicle_id_fkey foreign key (vehicle_id) references public.vehicles(id)",
    );
  });

  it("never touches the legacy fleet table", () => {
    expect(norm).not.toMatch(/public\.fleet\b/);
    expect(norm).not.toMatch(/\balter table (public\.)?fleet\b/);
  });
});

describe("block vs reservation: enforced in the database", () => {
  it("vehicle_blocks has the four kinds", () => {
    expect(norm).toContain(
      "check (kind in ('maintenance','out_of_service','owner_hold','damage'))",
    );
    expect(norm).toMatch(/period tstzrange not null/);
  });

  it("the occupancy ledger carries ONE exclusion that only fires across source types", () => {
    expect(norm).toContain(
      "add constraint vehicle_occupancy_no_block_overlap exclude using gist " +
        "(vehicle_id with =, period with &&, source_type with <>)",
    );
  });

  it("both tables feed the ledger on insert, update and delete", () => {
    for (const t of ["reservations", "vehicle_blocks"]) {
      expect(norm).toMatch(
        new RegExp(
          `create trigger ${t}_sync_occupancy after insert or update or delete on public\\.${t} ` +
            "for each row execute function public\\.rsv_sync_occupancy\\(\\)",
        ),
      );
    }
  });

  it("only occupying reservations and ACTIVE blocks land in the ledger", () => {
    expect(norm).toContain("when 'block' then new.status = 'active'");
    expect(norm).toContain(`else new.${OCCUPYING}`);
  });

  it("the ledger writer is SECURITY DEFINER with a pinned search_path", () => {
    const fn = norm.slice(norm.indexOf("create or replace function public.rsv_sync_occupancy()"));
    expect(fn.slice(0, 200)).toContain("security definer set search_path = ''");
  });

  it("org_id is pinned to the vehicle's org on both tables", () => {
    expect(norm).toMatch(/create trigger reservations_enforce_vehicle_org before insert or update of vehicle_id, org_id on public\.reservations/);
    expect(norm).toMatch(/create trigger vehicle_blocks_enforce_vehicle_org before insert or update of vehicle_id, org_id on public\.vehicle_blocks/);
  });
});

describe("RLS", () => {
  const TABLES = ["reservations", "vehicle_blocks", "vehicle_occupancy"] as const;

  it("is enabled on every spine table", () => {
    for (const t of TABLES) {
      expect(norm).toMatch(new RegExp(`alter table public\\.${t} enable row level security`));
    }
  });

  it("reads are org-scoped with the repo's staff bypass", () => {
    for (const t of TABLES) {
      expect(norm).toContain(
        `create policy org_member_read on public.${t} for select to authenticated ` +
          "using (public.is_staff() or public.is_org_member(org_id))",
      );
    }
  });

  it("writes to reservations and blocks must name an org the caller belongs to", () => {
    for (const t of ["reservations", "vehicle_blocks"]) {
      expect(norm).toContain(
        `create policy org_member_write on public.${t} for all to authenticated ` +
          "using (public.is_staff() or public.is_org_member(org_id)) " +
          "with check (public.is_staff() or (org_id is not null and public.is_org_member(org_id)))",
      );
    }
  });

  it("clients cannot write the occupancy ledger, and anon gets nothing", () => {
    expect(norm).not.toMatch(/create policy org_member_write on public\.vehicle_occupancy/);
    expect(norm).toContain(
      "revoke all on public.reservations, public.vehicle_blocks, public.vehicle_occupancy from anon, authenticated;",
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
    expect(triggers.length).toBe(5);
    for (const tr of triggers) {
      const [, name, table] = tr.match(/create trigger (\w+) \w+ [^;]*? on ([\w.]+)/)!;
      expect(norm, `trigger ${name} is not dropped first`).toContain(
        `drop trigger if exists ${name} on ${table};`,
      );
    }
  });

  it("every add constraint sits behind a pg_constraint existence check", () => {
    const added = [...norm.matchAll(/add constraint (\w+)/g)].map((m) => m[1]);
    expect(added.length).toBeGreaterThanOrEqual(9);
    for (const c of added) {
      expect(norm, `constraint ${c} is not existence-guarded`).toContain(
        `if not exists (select 1 from pg_constraint where conname = '${c}'`,
      );
    }
  });
});
