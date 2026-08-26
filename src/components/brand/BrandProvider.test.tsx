// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, within } from "@testing-library/react";
import BrandProvider from "./BrandProvider";
import { TENANTS } from "@/lib/platform/tenant-resolve";

function wrapper(container: HTMLElement) {
  return container.firstElementChild as HTMLElement;
}

describe("BrandProvider", () => {
  it("tags the subtree with the tenant", () => {
    const { container } = render(
      <BrandProvider brand={TENANTS.moe_legacy}>
        <span>portal</span>
      </BrandProvider>,
    );
    const el = wrapper(container);
    expect(el.dataset.brand).toBe("moe_legacy");
    expect(within(container).getByText("portal")).toBeTruthy();
  });

  it("declares the tenant palette as CSS variables", () => {
    const { container } = render(
      <BrandProvider brand={TENANTS.moe_legacy}>
        <span>x</span>
      </BrandProvider>,
    );
    expect(wrapper(container).style.getPropertyValue("--brand-primary")).toBe("#34d399");
  });

  it("gives each tenant a different palette", () => {
    const read = (slug: string) => {
      const { container } = render(
        <BrandProvider brand={TENANTS[slug]}>
          <span>x</span>
        </BrandProvider>,
      );
      return wrapper(container).style.getPropertyValue("--brand-primary");
    };
    expect(read("tmmt_property")).toBe("#a78bfa");
    expect(read("aixmos")).toBe("#7fffd4");
  });

  it("only paints the background when asked", () => {
    const plain = render(
      <BrandProvider brand={TENANTS.aixmos}>
        <span>x</span>
      </BrandProvider>,
    );
    expect(wrapper(plain.container).style.background).toBe("");
    const painted = render(
      <BrandProvider brand={TENANTS.aixmos} paint>
        <span>x</span>
      </BrandProvider>,
    );
    expect(wrapper(painted.container).style.background).toBe("var(--brand-bg)");
  });
});
