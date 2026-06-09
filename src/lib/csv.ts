// Client-side CSV export — turns admin table rows into a downloadable file.
// No dependency on how columns render to React; exports raw/typed values so
// the output opens cleanly in Excel / Google Sheets.

export interface CsvColumn<T> {
  key: string;
  label: string;
  /** Optional override for the exported value (defaults to row[key]). */
  csvValue?: (row: T) => string | number | boolean | null | undefined;
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote when the cell contains a delimiter, quote, or newline; double any quotes.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => escapeCell(c.csvValue ? c.csvValue(row) : row[c.key]))
      .join(","),
  );
  return [header, ...body].join("\r\n");
}

/** Build a CSV from rows/columns and trigger a browser download. */
export function downloadCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const csv = toCsv(rows, columns);
  // Prepend a UTF-8 BOM so Excel detects encoding correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
