// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";
import BrandLogo from "./BrandLogo";
import { TENANTS, type TenantBrand } from "@/lib/platform/tenant-resolve";

const withCustomLogo: TenantBrand = {
  ...TENANTS.tmmt_property,
  slug: "acme",
  displayName: "Acme Freight",
  initials: "AF",
  hasCustomLogo: true,
  theme: {
    ...TENANTS.tmmt_property.theme,
    logoPath: "/brands/acme/logo.svg",
    markPath: "/brands/acme/mark.svg",
  },
};

describe("BrandLogo", () => {
  it("draws a monogram when there is no artwork yet", () => {
    const { container } = render(<BrandLogo brand={TENANTS.aixmos_credit} />);
    expect(container.querySelector("img")).toBeNull();
    expect(within(container).getByText("AC")).toBeTruthy();
    expect(within(container).getByText("AIXMOS Credit")).toBeTruthy();
  });

  it("labels the mark for screen readers", () => {
    const { container } = render(<BrandLogo brand={TENANTS.tmmt_property} />);
    expect(within(container).getByRole("img", { name: "TMMT" })).toBeTruthy();
  });

  it("serves the client's own file once they have one", () => {
    const { container } = render(<BrandLogo brand={withCustomLogo} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/brands/acme/logo.svg");
    expect(within(container).queryByText("Acme Freight")).toBeNull();
  });

  it("omits the name in the mark variant", () => {
    const { container } = render(<BrandLogo brand={TENANTS.tmmt_property} variant="mark" />);
    expect(within(container).getByText("TM")).toBeTruthy();
    expect(within(container).queryByText("TMMT")).toBeNull();
  });

  it("renders text only for the wordmark variant", () => {
    const { container } = render(<BrandLogo brand={TENANTS.tmmt_property} variant="wordmark" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(within(container).getByText("TMMT")).toBeTruthy();
  });
});
