import { describe, it, expect } from "vitest";
import { hashPassphrase, makeSeal, verifyPassphrase } from "./owner";

const SALT = "00112233445566778899aabbccddeeff";

describe("owner control (master passphrase)", () => {
  it("hash is deterministic for the same passphrase + salt", () => {
    expect(hashPassphrase("open sesame", SALT)).toBe(hashPassphrase("open sesame", SALT));
  });

  it("different passphrases produce different hashes", () => {
    expect(hashPassphrase("a", SALT)).not.toBe(hashPassphrase("b", SALT));
  });

  it("makeSeal produces a 'salt:hash' seal that verifies the right passphrase", () => {
    const seal = makeSeal("X owns everything", SALT);
    expect(seal).toBe(`${SALT}:${hashPassphrase("X owns everything", SALT)}`);
    expect(verifyPassphrase("X owns everything", seal)).toBe(true);
  });

  it("rejects the wrong passphrase", () => {
    const seal = makeSeal("correct horse", SALT);
    expect(verifyPassphrase("wrong horse", seal)).toBe(false);
  });

  it("rejects a malformed seal", () => {
    expect(verifyPassphrase("anything", "not-a-seal")).toBe(false);
    expect(verifyPassphrase("anything", "")).toBe(false);
  });
});
