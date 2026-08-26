/**
 * GHL Voice AI contact tags + custom fields.
 * Same addContactTag / updateContactCustomFields args as the original handler.
 */
import {
  addContactTag,
  updateContactCustomFields,
  type GhlLocationKind,
} from "@/lib/ghl/client";

export const VERTICAL_TAGS: Record<string, string> = {
  rentals: "bella-set",
  detailing: "bella-set",
  credit: "bella-set",
  funding: "bella-set",
  moving: "bella-set",
  cleaning: "bella-set",
};

export async function applyVerticalTags(
  contactId: string,
  baseTag: string,
  vertical: string,
  locationKind: GhlLocationKind,
  callerName?: string
): Promise<void> {
  await addContactTag(contactId, baseTag, locationKind);
  await addContactTag(contactId, `vertical:${vertical}`, locationKind);
  if (callerName) {
    await updateContactCustomFields(
      contactId,
      { bella_vertical: vertical, bella_last_touch: new Date().toISOString() },
      locationKind
    );
  }
}

export async function qualifyTags(
  contactId: string,
  baseTag: string,
  vertical: string,
  locationKind: GhlLocationKind
): Promise<void> {
  await addContactTag(contactId, "bella-qualified", locationKind);
  await addContactTag(contactId, baseTag, locationKind);
  await updateContactCustomFields(
    contactId,
    {
      bella_vertical: vertical,
      bella_qualified_at: new Date().toISOString(),
    },
    locationKind
  );
}

export async function bookTags(
  contactId: string,
  baseTag: string,
  vertical: string,
  locationKind: GhlLocationKind,
  appointmentTime?: string
): Promise<void> {
  const tags = ["bella-booked", baseTag, `vertical:${vertical}`];
  for (const t of tags) await addContactTag(contactId, t, locationKind);
  const fields: Record<string, string> = {
    bella_vertical: vertical,
    bella_booked_at: new Date().toISOString(),
  };
  if (appointmentTime) fields.bella_appointment = appointmentTime;
  await updateContactCustomFields(contactId, fields, locationKind);
}
