// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";
import BrandName from "./BrandName";
import BrandProvider from "./BrandProvider";
import { TENANTS } from "@/lib/platform/tenant-resolve";

describe("BrandName", () => {
  it("defaults to TMMT outside a provider so chrome never crashes", () => {
    const { container } = render(<BrandName />);
    expect(within(container).getByText("TMMT")).toBeTruthy();
  });

  it("renders the tenant display name inside a provider", () => {
    const { container } = render(
      <BrandProvider brand={TENANTS.moe_legacy}>
        <BrandName />
      </BrandProvider>,
    );
    expect(within(container).getByText("AIXMOS Credit")).toBeTruthy();
  });

  it("can render the legal entity name", () => {
    const { container } = render(
      <BrandProvider brand={TENANTS.aixmos}>
        <BrandName variant="legal" />
      </BrandProvider>,
    );
    expect(within(container).getByText("All In One Management Solutions LLC")).toBeTruthy();
  });
});
