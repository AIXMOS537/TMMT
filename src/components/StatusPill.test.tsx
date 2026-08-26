// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { StatusPill } from "./ui";

afterEach(cleanup);

const options = ["Scheduled", "Completed", "No-Show", "Late", "Cancelled"];

describe("StatusPill", () => {
  it("renders the current status", () => {
    render(<StatusPill status="Scheduled" options={options} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /Scheduled/ })).toBeInTheDocument();
  });

  it("opens the dropdown on click and lists the options", () => {
    render(<StatusPill status="Scheduled" options={options} onChange={() => {}} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Scheduled/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No-Show" })).toBeInTheDocument();
  });

  it("calls onChange with the picked status and closes", () => {
    const onChange = vi.fn();
    render(<StatusPill status="Scheduled" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Scheduled/ }));
    const list = screen.getByRole("listbox");
    fireEvent.click(within(list).getByRole("button", { name: "No-Show" }));
    expect(onChange).toHaveBeenCalledWith("No-Show");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not call onChange when re-selecting the current status", () => {
    const onChange = vi.fn();
    render(<StatusPill status="Scheduled" options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Scheduled/ }));
    const list = screen.getByRole("listbox");
    fireEvent.click(within(list).getByRole("button", { name: "Scheduled" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not open when disabled", () => {
    render(<StatusPill status="Scheduled" options={options} onChange={() => {}} disabled />);
    fireEvent.click(screen.getByRole("button", { name: /Scheduled/ }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
