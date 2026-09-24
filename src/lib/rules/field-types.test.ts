import { describe, expect, it } from "vitest";

import {
  DERIVED_FIELD_TYPES,
  isDerivedField,
  validateField,
  validateRecord,
  type FieldSpec,
  type FieldType,
} from "./field-types";

/** The 23 types VERIFIED in use in base appcenWUju039rD7b (capability matrix §2). */
const ALL_TYPES: FieldType[] = [
  "singleLineText", "multilineText", "phoneNumber", "email", "url", "number", "currency",
  "percent", "date", "dateTime", "checkbox", "singleSelect", "multipleSelects",
  "multipleAttachments", "multipleRecordLinks", "multipleLookupValues", "rollup", "formula",
  "autoNumber", "barcode", "createdBy", "lastModifiedTime", "aiText",
];

const spec = (type: FieldType, extra: Partial<FieldSpec> = {}): FieldSpec => ({
  key: "f",
  label: "Field",
  type,
  ...extra,
});

describe("field registry covers the real base", () => {
  it("declares all 23 field types in use", () => {
    expect(ALL_TYPES).toHaveLength(23);
    expect(new Set(ALL_TYPES).size).toBe(23);
  });

  it("classifies every type as either derived or writable — none unhandled", () => {
    for (const type of ALL_TYPES) {
      const issues = validateField(spec(type, { options: ["A"] }), null);
      // A blank, non-required value yields no issues for a writable type, and the
      // derived-write error for a computed one. Either way the type is handled.
      if (isDerivedField(type)) {
        expect(issues[0]?.code).toBe("derived_field_write");
      } else {
        expect(issues).toEqual([]);
      }
    }
  });
});

describe("derived fields are never writable — this is what keeps rollups fresh", () => {
  it("rejects a write to every computed type", () => {
    expect([...DERIVED_FIELD_TYPES].sort()).toEqual(
      ["autoNumber", "createdBy", "formula", "lastModifiedTime", "multipleLookupValues", "rollup"].sort(),
    );
    for (const type of DERIVED_FIELD_TYPES) {
      const issues = validateField(spec(type), 123);
      expect(issues[0].code).toBe("derived_field_write");
      expect(issues[0].detail).toMatch(/stale/);
    }
  });

  it("does not complain about a derived field the caller simply did not write", () => {
    const r = validateRecord([spec("rollup", { key: "balance", label: "Balance" })], {});
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

describe("blank handling — blank is never coerced", () => {
  it("accepts blank when the field is not required", () => {
    expect(validateField(spec("singleLineText"), null)).toEqual([]);
    expect(validateField(spec("number"), "")).toEqual([]);
  });

  it("rejects blank only when the caller declared the field required", () => {
    const issues = validateField(spec("singleLineText", { required: true }), null);
    expect(issues[0].code).toBe("required_missing");
  });

  it("treats checkbox false and number 0 as values, not blanks", () => {
    expect(validateField(spec("checkbox", { required: true }), false)).toEqual([]);
    expect(validateField(spec("number", { required: true }), 0)).toEqual([]);
  });
});

describe("select options — the 'ou' artefact cannot be created here", () => {
  const eligibility = spec("singleSelect", {
    key: "eligibility_status",
    label: "Eligibility Status",
    options: ["Eligible", "Not Eligible", "out of radius"],
  });

  it("accepts a declared option", () => {
    expect(validateField(eligibility, "out of radius")).toEqual([]);
  });

  it("rejects the truncated value Airtable would have silently created", () => {
    const issues = validateField(eligibility, "ou");
    expect(issues[0].code).toBe("unknown_select_option");
    expect(issues[0].detail).toMatch(/would have CREATED/);
  });

  it("refuses to validate a singleSelect with no declared option set", () => {
    const issues = validateField(spec("singleSelect"), "anything");
    expect(issues[0].code).toBe("options_not_declared");
  });

  it("names every undeclared value in a multipleSelects write", () => {
    const s = spec("multipleSelects", { options: ["A", "B"] });
    expect(validateField(s, ["A", "B"])).toEqual([]);
    const issues = validateField(s, ["A", "Z"]);
    expect(issues[0].code).toBe("unknown_select_option");
    expect(issues[0].detail).toMatch(/"Z"/);
  });
});

describe("numeric types", () => {
  it("accepts real numbers", () => {
    expect(validateField(spec("currency"), 500)).toEqual([]);
    expect(validateField(spec("number"), -1.5)).toEqual([]);
  });

  it("rejects a numeric-looking string rather than coercing it", () => {
    const issues = validateField(spec("currency"), "500.00");
    expect(issues[0].code).toBe("numeric_string");
    expect(issues[0].detail).toMatch(/PostgREST/);
  });

  it("rejects NaN and Infinity", () => {
    expect(validateField(spec("number"), Number.NaN)[0].code).toBe("wrong_type");
    expect(validateField(spec("number"), Infinity)[0].code).toBe("wrong_type");
  });
});

describe("percent — the 100x partner-payout trap", () => {
  it("accepts a decimal percent, which is how Airtable stores it", () => {
    expect(validateField(spec("percent"), 0.7)).toEqual([]);
    expect(validateField(spec("percent"), 1)).toEqual([]);
  });

  it("warns — not errors — when a value above 1 looks like an integer percent", () => {
    const issues = validateField(spec("percent", { label: "Partner %" }), 70);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].code).toBe("percent_looks_like_integer");
    expect(issues[0].detail).toMatch(/7000%/);
    expect(issues[0].detail).toMatch(/100x error/);
  });
});

describe("text-shaped types", () => {
  it("validates email permissively but rejects obvious nonsense", () => {
    expect(validateField(spec("email"), "a@b.co")).toEqual([]);
    expect(validateField(spec("email"), "not-an-email")[0].code).toBe("invalid_email");
  });

  it("validates a URL by parsing it", () => {
    expect(validateField(spec("url"), "https://example.com/x")).toEqual([]);
    expect(validateField(spec("url"), "example dot com")[0].code).toBe("invalid_url");
  });

  it("checks a phone has digits without imposing a format", () => {
    // Format/normalisation policy stays with outbound-gate.ts — a second normaliser is how
    // a do-not-contact check starts missing numbers.
    expect(validateField(spec("phoneNumber"), "+1 (571) 555-0100")).toEqual([]);
    expect(validateField(spec("phoneNumber"), "no digits here")[0].code).toBe("wrong_type");
  });

  it("parses dates from both Date objects and ISO strings", () => {
    expect(validateField(spec("date"), new Date("2026-09-24"))).toEqual([]);
    expect(validateField(spec("dateTime"), "2026-09-24T20:00:00Z")).toEqual([]);
    expect(validateField(spec("date"), new Date("nope"))[0].code).toBe("invalid_date");
    expect(validateField(spec("date"), "the fourth")[0].code).toBe("invalid_date");
  });
});

describe("attachments — a value without provenance means a MISSING file", () => {
  const att = spec("multipleAttachments", { key: "docs", label: "Documents" });

  it("accepts an attachment carrying a storage path and a hash", () => {
    expect(
      validateField(att, [{ storage_path: "background-checks/x.pdf", sha256: "abc123" }]),
    ).toEqual([]);
  });

  it("rejects an attachment with no provenance", () => {
    const issues = validateField(att, [{ url: "https://airtable.com/signed/expired" }]);
    expect(issues[0].code).toBe("attachment_without_provenance");
    expect(issues[0].detail).toMatch(/MISSING file/);
  });

  it("rejects one missing only the hash", () => {
    const issues = validateField(att, [{ storage_path: "tickets/y.pdf", sha256: null }]);
    expect(issues[0].code).toBe("attachment_without_provenance");
  });
});

describe("validateRecord", () => {
  const specs: FieldSpec[] = [
    { key: "email", label: "Email", type: "email", required: true },
    { key: "weekly_rate", label: "Weekly Rate", type: "currency" },
    { key: "balance", label: "Balance", type: "rollup" },
  ];

  it("passes a clean record", () => {
    const r = validateRecord(specs, { email: "a@b.co", weekly_rate: 500 });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("blocks the write when any error is present", () => {
    const r = validateRecord(specs, { email: "bad", weekly_rate: "500.00" });
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code).sort()).toEqual(["invalid_email", "numeric_string"]);
  });

  it("blocks an attempt to write the derived rollup", () => {
    const r = validateRecord(specs, { email: "a@b.co", balance: 150 });
    expect(r.ok).toBe(false);
    expect(r.errors[0].code).toBe("derived_field_write");
  });

  it("warns about an undeclared key instead of silently accepting it", () => {
    const r = validateRecord(specs, { email: "a@b.co", mystery: 1 });
    expect(r.ok).toBe(true);
    expect(r.warnings[0].detail).toMatch(/not a declared field/);
  });

  it("does not let a warning alone block the write", () => {
    const pct: FieldSpec[] = [{ key: "p", label: "Partner %", type: "percent" }];
    const r = validateRecord(pct, { p: 70 });
    expect(r.ok).toBe(true);
    expect(r.warnings[0].code).toBe("percent_looks_like_integer");
  });
});
