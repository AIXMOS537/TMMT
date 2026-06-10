import { describe, it, expect } from "vitest";
import { toCsv, type CsvColumn } from "./csv";

type Row = Record<string, unknown>;

const cols: CsvColumn<Row>[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
];

describe("toCsv", () => {
  it("emits a header row then data rows, CRLF separated", () => {
    const csv = toCsv([{ id: 1, name: "Ada" }], cols);
    expect(csv).toBe("ID,Name\r\n1,Ada");
  });

  it("quotes cells containing commas, quotes, or newlines", () => {
    const csv = toCsv(
      [{ id: 1, name: "Smith, Jr." }, { id: 2, name: 'He said "hi"' }, { id: 3, name: "a\nb" }],
      cols,
    );
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('1,"Smith, Jr."');
    expect(lines[2]).toBe('2,"He said ""hi"""');
    expect(lines[3]).toBe('3,"a\nb"');
  });

  it("renders null/undefined as empty cells", () => {
    const csv = toCsv([{ id: null, name: undefined }], cols);
    expect(csv).toBe("ID,Name\r\n,");
  });

  it("honors csvValue overrides", () => {
    const csv = toCsv(
      [{ id: 1, name: "Ada" }],
      [{ key: "id", label: "ID", csvValue: (r) => `#${r.id}` }, { key: "name", label: "Name" }],
    );
    expect(csv).toBe("ID,Name\r\n#1,Ada");
  });

  it("returns just the header for an empty dataset", () => {
    expect(toCsv([], cols)).toBe("ID,Name");
  });
});
