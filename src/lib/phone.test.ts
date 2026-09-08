import { describe, it, expect } from "vitest";
import { phoneDigits, phoneLast10, normalizeNanpPhone, normalizePhoneLoose } from "./phone";

describe("phoneDigits / phoneLast10", () => {
  it("strips formatting and enforces a minimum length", () => {
    expect(phoneDigits("(555) 111-2222")).toBe("5551112222");
    expect(phoneDigits("12345")).toBeNull();
    expect(phoneDigits(null)).toBeNull();
  });

  it("last10 is the do-not-contact / payment-matching key", () => {
    expect(phoneLast10("+1 555 111 2222")).toBe("5551112222");
    expect(phoneLast10("555-1212")).toBeNull();
  });
});

describe("normalizeNanpPhone (strict, public entry points)", () => {
  it("accepts 10 digits and 11 digits starting with 1", () => {
    expect(normalizeNanpPhone("(555) 111-2222")).toBe("+15551112222");
    expect(normalizeNanpPhone("1 555 111 2222")).toBe("+15551112222");
    expect(normalizeNanpPhone("+15551112222")).toBe("+15551112222");
  });

  it("rejects everything else instead of guessing", () => {
    expect(normalizeNanpPhone("+44 20 7946 0958")).toBeNull();
    expect(normalizeNanpPhone("2555111222")).toBe("+12555111222");
    expect(normalizeNanpPhone("25551112222")).toBeNull();
    expect(normalizeNanpPhone("12345")).toBeNull();
    expect(normalizeNanpPhone("")).toBeNull();
  });
});

describe("normalizePhoneLoose (existing records, keep rather than drop)", () => {
  it("matches the strict form for NANP input", () => {
    expect(normalizePhoneLoose("(555) 111-2222")).toBe("+15551112222");
    expect(normalizePhoneLoose("1 555 111 2222")).toBe("+15551112222");
  });

  it("keeps international and odd-length numbers as +digits", () => {
    expect(normalizePhoneLoose("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhoneLoose("25551112222")).toBe("+25551112222");
  });

  it("still drops obvious garbage", () => {
    expect(normalizePhoneLoose("12345")).toBeNull();
    expect(normalizePhoneLoose(undefined)).toBeNull();
  });
});

describe("the two policies agree wherever both accept the input", () => {
  it.each(["5551112222", "(555) 111-2222", "15551112222", "+1 555-111-2222"])("%s", (raw) => {
    expect(normalizeNanpPhone(raw)).toBe(normalizePhoneLoose(raw));
  });
});
