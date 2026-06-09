// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ExportButton, type Column } from "./ui";

type Row = Record<string, unknown>;
const columns: Column<Row>[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Name" },
];
const rows: Row[] = [{ id: 1, name: "Ada" }];

beforeEach(() => {
  // jsdom doesn't implement object URLs — stub so downloadCsv() can run.
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
  // Prevent the anchor's real navigation/download in jsdom.
  HTMLAnchorElement.prototype.click = vi.fn();
});
afterEach(cleanup);

describe("ExportButton", () => {
  it("is disabled when there is no data", () => {
    render(<ExportButton data={[]} columns={columns} filename="x" />);
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeDisabled();
  });

  it("is enabled with data and triggers a CSV download on click", () => {
    render(<ExportButton data={rows} columns={columns} filename="report" />);
    const btn = screen.getByRole("button", { name: /Export CSV/ });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("honors a custom label", () => {
    render(<ExportButton data={rows} columns={columns} filename="x" label="Download" />);
    expect(screen.getByRole("button", { name: /Download/ })).toBeInTheDocument();
  });
});
