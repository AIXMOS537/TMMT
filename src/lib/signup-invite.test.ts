import { describe, it, expect } from "vitest";
import {
  generateInviteCode,
  hashInviteCode,
  inviteRejection,
  isMalformedInviteCode,
  normalizeInviteCode,
  type InviteRow,
} from "./signup-invite";

const NOW = new Date("2026-08-31T00:00:00Z");
const future = "2026-09-30T00:00:00Z";
const past = "2026-08-01T00:00:00Z";

function row(over: Partial<InviteRow> = {}): InviteRow {
  return { id: "i1", email: null, expires_at: future, used_at: null, ...over };
}

describe("normalizeInviteCode", () => {
  it("is case- and punctuation-blind so a phoned-in code still works", () => {
    expect(normalizeInviteCode("ab3d-ef7h")).toBe("AB3DEF7H");
    expect(normalizeInviteCode(" AB3D EF7H ")).toBe("AB3DEF7H");
  });

  it("survives null and undefined without throwing", () => {
    expect(normalizeInviteCode(null)).toBe("");
    expect(normalizeInviteCode(undefined)).toBe("");
  });
});

describe("hashInviteCode", () => {
  it("matches regardless of how the user typed it", () => {
    expect(hashInviteCode("ab3d-ef7h")).toBe(hashInviteCode("AB3DEF7H"));
  });

  it("never returns the code itself", () => {
    const hash = hashInviteCode("AB3D-EF7H");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("AB3D");
  });

  it("gives different codes different hashes", () => {
    expect(hashInviteCode("AAAA-BBBB-CCCC-DDDD")).not.toBe(hashInviteCode("AAAA-BBBB-CCCC-DDDE"));
  });
});

describe("generateInviteCode", () => {
  it("mints a grouped 16-character code", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
    expect(normalizeInviteCode(code)).toHaveLength(16);
  });

  it("does not repeat itself", () => {
    const codes = new Set(Array.from({ length: 50 }, generateInviteCode));
    expect(codes.size).toBe(50);
  });

  it("omits the letters people mistype", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).not.toMatch(/[ILOU]/);
    }
  });
});

describe("isMalformedInviteCode", () => {
  it("rejects empty and short input before it ever reaches the database", () => {
    expect(isMalformedInviteCode("")).toBe(true);
    expect(isMalformedInviteCode(null)).toBe(true);
    expect(isMalformedInviteCode("   ")).toBe(true);
    expect(isMalformedInviteCode("ABC-123")).toBe(true);
  });

  it("accepts a real minted code", () => {
    expect(isMalformedInviteCode(generateInviteCode())).toBe(false);
  });
});

describe("inviteRejection", () => {
  it("accepts a fresh, unused, unlocked code", () => {
    expect(inviteRejection(row(), "new@example.com", NOW)).toBeNull();
  });

  it("refuses a code that does not exist", () => {
    expect(inviteRejection(null, "new@example.com", NOW)).toBe("unknown");
  });

  it("refuses a code that was already redeemed", () => {
    expect(inviteRejection(row({ used_at: past }), "new@example.com", NOW)).toBe("used");
  });

  it("refuses an expired code", () => {
    expect(inviteRejection(row({ expires_at: past }), "new@example.com", NOW)).toBe("expired");
  });

  it("refuses a code redeemed at the exact moment it expires", () => {
    expect(inviteRejection(row({ expires_at: NOW.toISOString() }), "a@b.com", NOW)).toBe("expired");
  });

  it("refuses an email-locked code presented by anyone else", () => {
    const locked = row({ email: "khan@example.com" });
    expect(inviteRejection(locked, "stranger@example.com", NOW)).toBe("wrong-email");
  });

  it("honours an email-locked code for its owner, whatever the casing", () => {
    const locked = row({ email: "Khan@Example.com " });
    expect(inviteRejection(locked, "khan@example.com", NOW)).toBeNull();
  });

  it("checks use before expiry so a burned code never reads as merely stale", () => {
    expect(inviteRejection(row({ used_at: past, expires_at: past }), "a@b.com", NOW)).toBe("used");
  });
});
