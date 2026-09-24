/**
 * Declarative field registry and write-boundary validation.
 *
 * Workstream B, P1 (`TMMT-AIRTABLE-CAPABILITY-MATRIX.md` §4.1 — "Validation / required /
 * defaults", acceptance test: *invalid write rejected at DB, not just UI*; and "Field types",
 * acceptance test: *each of the 23 types round-trips*). Marked in the matrix as requiring **no
 * owner decision** — which is true of the MECHANISM only, and this module is careful about the
 * difference:
 *
 *   - Whether a value is a valid email, a real number, or a declared select option
 *     is mechanism. This module decides it.
 *   - Whether a field is REQUIRED, and what its options ARE, is business policy. This module
 *     never invents either — both come from the caller's `FieldSpec`. There is no
 *     "sensible default" for requiredness.
 *
 * SCOPE — this is the application-boundary half of the acceptance test. The matrix asks for
 * rejection "at DB, not just UI"; the database half is a schema change and therefore needs an
 * owner-authorised change request, so it is not done here and is not pretended to be done.
 * What this replaces is validation "enforced ad-hoc in forms" — it moves the check off the UI
 * and onto the write path, where a service call or an import cannot route around it.
 *
 * THREE DOCUMENTED FAILURES THIS MAKES STRUCTURALLY IMPOSSIBLE
 *
 * 1. **Stale derived values.** Airtable computes `formula`, `rollup`, `multipleLookupValues`,
 *    `autoNumber`, `createdBy` and `lastModifiedTime`; they are never written by a user. Any
 *    write to one is rejected here. That is the same invariant `rollups.ts` protects, enforced
 *    one layer earlier: the standing rule is that rollups are RECOMPUTED, never copied.
 *
 * 2. **Select-option drift.** Airtable creates a new select option the moment someone free-types
 *    one, which is exactly how `"ou"` — a truncated `"out of radius"` — became a permanent
 *    choice on `Eligibility Status` that `bg_check_decide` rejects. A native registry refuses a
 *    value outside the declared option set, so the next `"ou"` cannot be created by a slip.
 *
 * 3. **Attachments with no provenance.** CLAUDE.md: *a populated jsonb attachment column is
 *    evidence of a MISSING file, not a migrated one* — the Airtable signed URL expired hours
 *    after any copy. An attachment value carrying no storage path and no sha256 is flagged.
 */

import { isBlank } from "./airtable-semantics";

/** The 23 Airtable field types VERIFIED in use in base `appcenWUju039rD7b` (matrix §2). */
export type FieldType =
  | "singleLineText"
  | "multilineText"
  | "phoneNumber"
  | "email"
  | "url"
  | "number"
  | "currency"
  | "percent"
  | "date"
  | "dateTime"
  | "checkbox"
  | "singleSelect"
  | "multipleSelects"
  | "multipleAttachments"
  | "multipleRecordLinks"
  | "multipleLookupValues"
  | "rollup"
  | "formula"
  | "autoNumber"
  | "barcode"
  | "createdBy"
  | "lastModifiedTime"
  | "aiText";

/**
 * Types the system computes. A user or import never supplies these, so a write to one is a
 * defect — usually a migration copying a computed value across as a literal.
 */
export const DERIVED_FIELD_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  "formula",
  "rollup",
  "multipleLookupValues",
  "autoNumber",
  "createdBy",
  "lastModifiedTime",
]);

export function isDerivedField(type: FieldType): boolean {
  return DERIVED_FIELD_TYPES.has(type);
}

export type FieldSpec = {
  key: string;
  label: string;
  type: FieldType;
  /** BUSINESS POLICY — supplied by the caller, never inferred. */
  required?: boolean;
  /** Declared choices for `singleSelect` / `multipleSelects`. Anything else is rejected. */
  options?: readonly string[];
};

export type IssueCode =
  | "derived_field_write"
  | "required_missing"
  | "wrong_type"
  | "unknown_select_option"
  | "numeric_string"
  | "percent_looks_like_integer"
  | "attachment_without_provenance"
  | "invalid_email"
  | "invalid_url"
  | "invalid_date"
  | "options_not_declared";

export type FieldIssue = {
  field: string;
  code: IssueCode;
  /** `error` blocks the write. `warning` is a finding the caller should see but may accept. */
  severity: "error" | "warning";
  detail: string;
};

function err(field: string, code: IssueCode, detail: string): FieldIssue {
  return { field, code, severity: "error", detail };
}
function warn(field: string, code: IssueCode, detail: string): FieldIssue {
  return { field, code, severity: "warning", detail };
}

/** Same PostgREST trap `rollups.ts` documents: Postgres numeric arrives as a JSON string. */
function looksNumericButIsNot(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value));
}

function checkNumeric(spec: FieldSpec, value: unknown): FieldIssue[] {
  if (looksNumericButIsNot(value)) {
    return [
      err(
        spec.key,
        "numeric_string",
        `${spec.label} is ${JSON.stringify(value)} — a numeric-looking STRING, not a number. ` +
          `Postgres numeric is serialised as a string by PostgREST; cast at the query boundary ` +
          `rather than coercing here.`,
      ),
    ];
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return [err(spec.key, "wrong_type", `${spec.label} must be a finite number.`)];
  }
  return [];
}

/**
 * Validate one field value against its spec.
 *
 * Blank is handled once, up front: a blank value is an error only when the caller declared the
 * field required. Blank is never coerced to 0, "" or false (CLAUDE.md: blank ≠ 0 ≠ false).
 */
export function validateField(spec: FieldSpec, value: unknown): FieldIssue[] {
  if (isDerivedField(spec.type)) {
    return [
      err(
        spec.key,
        "derived_field_write",
        `${spec.label} is a ${spec.type} — the system computes it. Writing it stores a snapshot ` +
          `that silently goes stale. Recompute it at read time instead (see rollups.ts).`,
      ),
    ];
  }

  // A checkbox is the one type with no blank state: Airtable stores true or false.
  if (isBlank(value)) {
    if (spec.required) {
      return [err(spec.key, "required_missing", `${spec.label} is required but blank.`)];
    }
    return [];
  }

  switch (spec.type) {
    case "singleLineText":
    case "multilineText":
    case "barcode":
    case "aiText":
      return typeof value === "string"
        ? []
        : [err(spec.key, "wrong_type", `${spec.label} must be text.`)];

    case "email": {
      if (typeof value !== "string") {
        return [err(spec.key, "wrong_type", `${spec.label} must be text.`)];
      }
      // Deliberately permissive: one @, no whitespace, something either side. A stricter
      // pattern rejects addresses that are legal under RFC 5322 and genuinely in use.
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? []
        : [err(spec.key, "invalid_email", `${spec.label} is not a valid email address.`)];
    }

    case "url": {
      if (typeof value !== "string") {
        return [err(spec.key, "wrong_type", `${spec.label} must be text.`)];
      }
      try {
        new URL(value);
        return [];
      } catch {
        return [err(spec.key, "invalid_url", `${spec.label} is not a parseable URL.`)];
      }
    }

    case "phoneNumber": {
      if (typeof value !== "string") {
        return [err(spec.key, "wrong_type", `${spec.label} must be text.`)];
      }
      // Presence of digits only. Formatting/normalisation policy is NOT decided here —
      // `src/lib/outbound-gate.ts` already owns number handling for contact decisions, and a
      // second, differently-behaved normaliser is how a DNC check starts missing numbers.
      return /\d/.test(value)
        ? []
        : [err(spec.key, "wrong_type", `${spec.label} contains no digits.`)];
    }

    case "number":
    case "currency":
      return checkNumeric(spec, value);

    case "percent": {
      const issues = checkNumeric(spec, value);
      if (issues.length > 0) return issues;
      // Airtable stores a percent as a DECIMAL: 0.70 means 70%. Storing 70 means 7000%, which
      // is how a partner payout becomes 100x wrong — the same trap `partner-economics.ts`
      // throws on. Flagged, not corrected: 1.5 could be a legitimate 150%.
      return (value as number) > 1
        ? [
            warn(
              spec.key,
              "percent_looks_like_integer",
              `${spec.label} is ${String(value)}. Percent fields store a DECIMAL (0.70 = 70%), ` +
                `so this reads as ${(value as number) * 100}%. If an integer percent was ` +
                `intended, this is a 100x error.`,
            ),
          ]
        : [];
    }

    case "date":
    case "dateTime": {
      if (value instanceof Date) {
        return Number.isNaN(value.getTime())
          ? [err(spec.key, "invalid_date", `${spec.label} is an Invalid Date.`)]
          : [];
      }
      if (typeof value !== "string") {
        return [err(spec.key, "wrong_type", `${spec.label} must be a date or ISO string.`)];
      }
      return Number.isNaN(Date.parse(value))
        ? [err(spec.key, "invalid_date", `${spec.label} is not a parseable date: ${value}.`)]
        : [];
    }

    case "checkbox":
      return typeof value === "boolean"
        ? []
        : [err(spec.key, "wrong_type", `${spec.label} must be true or false.`)];

    case "singleSelect": {
      if (typeof value !== "string") {
        return [err(spec.key, "wrong_type", `${spec.label} must be text.`)];
      }
      if (!spec.options) {
        return [
          err(
            spec.key,
            "options_not_declared",
            `${spec.label} is a singleSelect with no declared options, so no value can be ` +
              `validated. Declare the option set — that is what stops free-typed drift.`,
          ),
        ];
      }
      return spec.options.includes(value)
        ? []
        : [
            err(
              spec.key,
              "unknown_select_option",
              `${spec.label} = ${JSON.stringify(value)} is not a declared option ` +
                `(${spec.options.join(", ")}). Airtable would have CREATED this option on the ` +
                `spot — that is how the truncated "ou" became permanent. Rejected here.`,
            ),
          ];
    }

    case "multipleSelects": {
      if (!Array.isArray(value)) {
        return [err(spec.key, "wrong_type", `${spec.label} must be an array.`)];
      }
      if (!spec.options) {
        return [
          err(spec.key, "options_not_declared", `${spec.label} has no declared option set.`),
        ];
      }
      const declared = spec.options;
      const unknown = value.filter((v) => typeof v !== "string" || !declared.includes(v));
      return unknown.length === 0
        ? []
        : [
            err(
              spec.key,
              "unknown_select_option",
              `${spec.label} contains undeclared option(s): ${unknown.map((u) => JSON.stringify(u)).join(", ")}.`,
            ),
          ];
    }

    case "multipleRecordLinks":
      return Array.isArray(value) && value.every((v) => typeof v === "string")
        ? []
        : [err(spec.key, "wrong_type", `${spec.label} must be an array of record ids.`)];

    case "multipleAttachments": {
      if (!Array.isArray(value)) {
        return [err(spec.key, "wrong_type", `${spec.label} must be an array.`)];
      }
      // A value here without provenance is evidence of a MISSING file, not a stored one:
      // Airtable's signed URL expired hours after any copy. Gate 2 requires a storage path
      // and a sha256 on every extracted row (CR-003).
      const unprovenanced = value.filter((a) => {
        if (typeof a !== "object" || a === null) return true;
        const rec = a as Record<string, unknown>;
        return isBlank(rec.storage_path) || isBlank(rec.sha256);
      });
      return unprovenanced.length === 0
        ? []
        : [
            err(
              spec.key,
              "attachment_without_provenance",
              `${spec.label} has ${unprovenanced.length} attachment(s) with no storage_path or ` +
                `sha256. A populated attachment value without provenance is evidence of a ` +
                `MISSING file — the Airtable signed URL expires. See CR-003 / Gate 2.`,
            ),
          ];
    }

    // Derived types are handled above and cannot reach here.
    default:
      return [];
  }
}

export type ValidationResult = {
  /** False when any error was raised. Warnings alone do not block a write. */
  ok: boolean;
  errors: FieldIssue[];
  warnings: FieldIssue[];
};

/**
 * Validate a whole record against its field registry.
 *
 * Checks every declared field, and reports keys present on the record that no spec declares —
 * an undeclared key is usually a renamed column or a field that never got registered, and
 * letting it through is how data lands somewhere nothing reads it.
 */
export function validateRecord(
  specs: readonly FieldSpec[],
  record: Record<string, unknown>,
): ValidationResult {
  const issues: FieldIssue[] = [];

  for (const spec of specs) {
    // A derived field is only an error when the caller actually tries to write it.
    if (isDerivedField(spec.type) && !(spec.key in record)) continue;
    issues.push(...validateField(spec, record[spec.key]));
  }

  const declared = new Set(specs.map((s) => s.key));
  for (const key of Object.keys(record)) {
    if (!declared.has(key)) {
      issues.push(
        warn(key, "wrong_type", `"${key}" is not a declared field and was not validated.`),
      );
    }
  }

  return {
    ok: !issues.some((i) => i.severity === "error"),
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning"),
  };
}
