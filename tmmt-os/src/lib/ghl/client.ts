/**
 * GoHighLevel API v2 — best-effort outbound helpers.
 * Requires GHL_API_KEY + GHL_LOCATION_ID in server env.
 */

const GHL_BASE = "https://services.leadconnectorhq.com";

export function isGhlConfigured(): boolean {
  return Boolean(process.env.GHL_API_KEY?.trim() && process.env.GHL_LOCATION_ID?.trim());
}

function ghlHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };
}

export async function addContactTag(contactId: string, tag: string): Promise<void> {
  if (!isGhlConfigured()) return;

  const locationId = process.env.GHL_LOCATION_ID!;
  const res = await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify({ tags: [tag], locationId }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL addContactTag failed (${res.status}): ${body}`);
  }
}
