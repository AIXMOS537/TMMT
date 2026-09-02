// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import CommandHubNav from "./CommandHubNav";

let pathname = "/fleet";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

afterEach(cleanup);

const HREFS = ["/command", "/fleet", "/leads", "/dispatch"];

describe("CommandHubNav", () => {
  it("renders a row of pills outside dispatch", () => {
    pathname = "/fleet";
    render(<CommandHubNav allowedHrefs={HREFS} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hub" })).toHaveAttribute("href", "/command");
    expect(screen.getByRole("link", { name: "Fleet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();
  });

  it("collapses to a vertical dropdown on the dispatch page", () => {
    pathname = "/dispatch";
    render(<CommandHubNav allowedHrefs={HREFS} />);

    const trigger = screen.getByRole("button", { name: /Dispatch cockpit/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Fleet" })).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Fleet/ })).toHaveAttribute("href", "/fleet");
    expect(screen.getByText("Fleet & rentals")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("stays a dropdown on nested dispatch routes", () => {
    pathname = "/dispatch/incident/new";
    render(<CommandHubNav allowedHrefs={HREFS} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("only renders links the account is allowed to see", () => {
    pathname = "/fleet";
    render(<CommandHubNav allowedHrefs={["/command", "/leads"]} />);

    expect(screen.getByRole("link", { name: "Leads" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Fleet" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Command desk" })).not.toBeInTheDocument();
  });

  it("renders nothing when the account has no command hub links", () => {
    pathname = "/executive";
    const { container } = render(<CommandHubNav allowedHrefs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
