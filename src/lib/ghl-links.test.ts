import { describe, it, expect } from "vitest";
import { isLiveGhlUrl } from "./ghl-links";

describe("isLiveGhlUrl", () => {
  it("is true only for http(s) URLs", () => {
    expect(isLiveGhlUrl("https://app.gohighlevel.com/x")).toBe(true);
    expect(isLiveGhlUrl("http://localhost/x")).toBe(true);
  });
  it("is false for unset/sentinel values", () => {
    expect(isLiveGhlUrl("")).toBe(false);
    expect(isLiveGhlUrl("#checkout-pending")).toBe(false);
    expect(isLiveGhlUrl("/relative")).toBe(false);
  });
});
