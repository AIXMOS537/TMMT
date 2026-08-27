/**
 * Hostname handling for operator onboarding.
 *
 * Pure and dependency-free so the rules can be tested without a database or a
 * network, and so the same normalisation runs in the form, the server action
 * and the verifier. A hostname that normalises three different ways is a
 * tenancy bug waiting to happen: `organization_domains.hostname` is the unique
 * key that decides which tenant a visitor lands in.
 */

/** What Vercel apex A records point at, and the CNAME target for subdomains. */
export const VERCEL_A_RECORD = "76.76.21.21";
export const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";

export type HostnameCheck =
  | { ok: true; hostname: string; isApex: boolean }
  | { ok: false; reason: string };

/**
 * Lowercases, strips scheme, path, port and a trailing dot.
 *
 * The trailing dot matters: DNS answers come back as "example.com." and a
 * naive comparison against "example.com" fails, which would make a correctly
 * configured domain look unverified forever.
 */
export function normalizeHostname(input: string | null | undefined): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Rejects anything that cannot be a real public hostname.
 *
 * Deliberately strict. A typo accepted here becomes a row in a table whose
 * unique index then blocks the correct value, and someone has to work out why
 * the domain "already exists" when nobody recognises it.
 */
export function checkHostname(input: string | null | undefined): HostnameCheck {
  const hostname = normalizeHostname(input);
  if (!hostname) return { ok: false, reason: "Enter a domain." };
  if (hostname.length > 253) return { ok: false, reason: "That domain is too long." };
  if (hostname.includes(" ")) return { ok: false, reason: "A domain cannot contain spaces." };

  const labels = hostname.split(".");
  if (labels.length < 2) {
    return { ok: false, reason: "Use a full domain, like joes-auto.com." };
  }
  for (const label of labels) {
    if (!LABEL.test(label)) {
      return { ok: false, reason: `"${label}" is not a valid part of a domain.` };
    }
  }
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1])) {
    return { ok: false, reason: "That does not end in a real domain suffix." };
  }
  // localhost and .local resolve differently per machine — never a tenant host.
  if (hostname.endsWith(".local") || hostname === "localhost") {
    return { ok: false, reason: "Local-only names cannot be operator domains." };
  }

  return { ok: true, hostname, isApex: labels.length === 2 };
}

/** The DNS record an operator must create, phrased for the person creating it. */
export function dnsInstruction(hostname: string): {
  type: "A" | "CNAME";
  name: string;
  value: string;
} {
  const check = checkHostname(hostname);
  if (!check.ok) return { type: "CNAME", name: hostname, value: VERCEL_CNAME_TARGET };
  // An apex cannot be a CNAME in standard DNS, which is why the two cases
  // differ and why telling everyone "add a CNAME" produces failed setups.
  return check.isApex
    ? { type: "A", name: "@", value: VERCEL_A_RECORD }
    : { type: "CNAME", name: check.hostname.split(".")[0], value: VERCEL_CNAME_TARGET };
}

export interface DnsAnswer {
  Status: number;
  Answer?: Array<{ name: string; type: number; data: string }>;
}

/**
 * Does this DNS answer show the host pointing at us?
 *
 * Split from the fetch so the matching rules are testable without a network.
 * Accepts either the A record or a CNAME chain ending at Vercel, because both
 * are correct setups depending on whether the host is an apex.
 */
export function answerPointsAtVercel(answer: DnsAnswer | null | undefined): boolean {
  if (!answer || answer.Status !== 0 || !answer.Answer?.length) return false;
  return answer.Answer.some((rec) => {
    const data = normalizeHostname(rec.data);
    return data === VERCEL_A_RECORD || data.endsWith("vercel-dns.com") || data.endsWith("vercel.app");
  });
}
