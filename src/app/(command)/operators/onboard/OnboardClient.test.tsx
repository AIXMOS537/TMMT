// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/**
 * The server actions are mocked: this asserts what the operator-onboarding
 * screen SHOWS, which is the part a person depends on. The DNS instructions in
 * particular are the whole handoff — if they render wrong, an operator's domain
 * silently never goes live.
 */
// vi.hoisted, because vi.mock is lifted above ordinary const declarations and
// would otherwise read these before they exist.
const { onboardOperator, verifyOperatorDomain } = vi.hoisted(() => ({
  onboardOperator: vi.fn(),
  verifyOperatorDomain: vi.fn(),
}));
vi.mock("./actions", () => ({ onboardOperator, verifyOperatorDomain }));

import OnboardClient from "./OnboardClient";

const CREATED = {
  orgId: "org-1",
  hostname: "joes-auto.com",
  dns: { type: "A" as const, name: "@", value: "76.76.21.21" },
  adminInvited: true,
};

beforeEach(() => {
  onboardOperator.mockReset();
  verifyOperatorDomain.mockReset();
});
afterEach(cleanup);

function fill() {
  fireEvent.change(screen.getByPlaceholderText("Joe's Auto"), { target: { value: "Joe's Auto" } });
  fireEvent.change(screen.getByPlaceholderText("joes-auto.com"), { target: { value: "joes-auto.com" } });
}

describe("OnboardClient", () => {
  it("says up front that the licence starts inactive", () => {
    // The operator is created but switched off. Someone reading this screen
    // must not believe they have just turned a paying customer on.
    render(<OnboardClient />);
    expect(screen.getByText(/starts/i)).toBeInTheDocument();
    expect(screen.getAllByText(/inactive/i).length).toBeGreaterThan(0);
  });

  it("submits what was typed and passes the chosen modules", async () => {
    onboardOperator.mockResolvedValue({ success: true, data: CREATED });
    render(<OnboardClient />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create operator/i }));

    await waitFor(() => expect(onboardOperator).toHaveBeenCalledTimes(1));
    expect(onboardOperator).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Joe's Auto",
        hostname: "joes-auto.com",
        modules: ["rentals_app"],
      }),
    );
  });

  it("shows the exact DNS record after creating", async () => {
    onboardOperator.mockResolvedValue({ success: true, data: CREATED });
    render(<OnboardClient />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create operator/i }));

    await screen.findByText(/have them add this dns record/i);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("@")).toBeInTheDocument();
    expect(screen.getByText("76.76.21.21")).toBeInTheDocument();
  });

  it("surfaces a failure instead of pretending it worked", async () => {
    onboardOperator.mockResolvedValue({
      success: false,
      error: "joes-auto.com is already registered to Someone Else.",
    });
    render(<OnboardClient />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create operator/i }));

    await screen.findByText(/already registered to Someone Else/i);
    // And must not advance to the success screen.
    expect(screen.queryByText(/have them add this dns record/i)).not.toBeInTheDocument();
  });

  it("reports an unverified domain without claiming success", async () => {
    onboardOperator.mockResolvedValue({ success: true, data: CREATED });
    verifyOperatorDomain.mockResolvedValue({
      success: true,
      data: { verified: false, detail: "joes-auto.com does not point here yet." },
    });
    render(<OnboardClient />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create operator/i }));
    await screen.findByText(/have them add this dns record/i);

    fireEvent.click(screen.getByRole("button", { name: /check dns now/i }));
    await screen.findByText(/does not point here yet/i);
    // The button stays available, because the operator will fix DNS and retry.
    expect(screen.getByRole("button", { name: /check dns now/i })).toBeEnabled();
  });

  it("locks the check button once the domain verifies", async () => {
    onboardOperator.mockResolvedValue({ success: true, data: CREATED });
    verifyOperatorDomain.mockResolvedValue({
      success: true,
      data: { verified: true, detail: "joes-auto.com is verified." },
    });
    render(<OnboardClient />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create operator/i }));
    await screen.findByText(/have them add this dns record/i);

    fireEvent.click(screen.getByRole("button", { name: /check dns now/i }));
    await screen.findByText(/is verified/i);
    expect(screen.getByRole("button", { name: /verified/i })).toBeDisabled();
  });

  it("says plainly when no admin was invited", async () => {
    onboardOperator.mockResolvedValue({ success: true, data: { ...CREATED, adminInvited: false } });
    render(<OnboardClient />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /create operator/i }));

    await screen.findByText(/no admin added yet/i);
  });
});
