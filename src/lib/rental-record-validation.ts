/** Shared by the live action and offline queue; no browser or server dependencies. */
export function validateRentalRecord(table: string, record: Record<string, unknown>): string | null {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "Invalid record.";

  const moneyFields = table === "customer_payments"
    ? ["amount"]
    : table === "contracts"
      ? ["base_price", "taxes_and_fees", "insurance_fee", "total_contract_amount"]
      : [];
  for (const field of moneyFields) {
    const value = record[field];
    // Status-only edits and existing nullable amounts remain supported.
    if (value == null) continue;
    const numeric = typeof value === "number"
      || (typeof value === "string" && /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()));
    if (!numeric || !Number.isFinite(Number(value))) {
      return `${field.replaceAll("_", " ")} must be a valid number. Enter the amount without currency symbols or a payment schedule.`;
    }
  }

  if (table === "contracts") {
    for (const field of ["start_date", "end_date"]) {
      const value = record[field];
      if (value == null) continue;
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${field.replaceAll("_", " ")} must be a valid calendar date.`;
      }
      const parsed = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        return `${field.replaceAll("_", " ")} must be a valid calendar date.`;
      }
    }
    if (typeof record.start_date === "string" && typeof record.end_date === "string"
      && record.end_date < record.start_date) {
      return "End date cannot be before start date.";
    }
  }
  return null;
}
