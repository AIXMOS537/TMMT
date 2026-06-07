/** Normalize GHL workflow / native webhook field names. */
export function pickContactId(data: Record<string, unknown>): string | undefined {
  const direct = data.contact_id ?? data.contactId;
  if (typeof direct === "string" && direct.length > 0) return direct;

  const contact = data.contact;
  if (contact && typeof contact === "object" && !Array.isArray(contact)) {
    const c = contact as Record<string, unknown>;
    const id = c.id ?? c.contact_id ?? c.contactId;
    if (typeof id === "string" && id.length > 0) return id;
  }

  if (typeof data.id === "string" && (data.event as string | undefined)?.includes("contact")) {
    return data.id;
  }

  return undefined;
}

export function pickContactFields(data: Record<string, unknown>): {
  name?: string;
  email?: string;
  phone?: string;
} {
  const contact = data.contact;
  const block =
    contact && typeof contact === "object" && !Array.isArray(contact)
      ? (contact as Record<string, unknown>)
      : data;

  const name =
    (block.name as string | undefined) ??
    (block.full_name as string | undefined) ??
    (block.firstName && block.lastName
      ? `${block.firstName} ${block.lastName}`.trim()
      : undefined) ??
    (block.first_name && block.last_name
      ? `${block.first_name} ${block.last_name}`.trim()
      : undefined);

  return {
    name: typeof name === "string" ? name : undefined,
    email: typeof block.email === "string" ? block.email : undefined,
    phone:
      typeof block.phone === "string"
        ? block.phone
        : typeof block.phoneNumber === "string"
          ? block.phoneNumber
          : undefined,
  };
}

export function normalizeGhlEvent(data: Record<string, unknown>): string {
  const raw = data.event ?? data.type ?? data.trigger ?? "";
  return String(raw).toLowerCase().replace(/\s+/g, "_");
}

export function isOpportunityStagePayload(data: Record<string, unknown>): boolean {
  const event = normalizeGhlEvent(data);
  if (event.includes("opportunity") && event.includes("stage")) return true;
  if (event === "opportunity.stage_changed") return true;
  return typeof data.stage === "string" && data.stage.length > 0 && !!pickContactId(data);
}

export function isContactPayload(data: Record<string, unknown>): boolean {
  const event = normalizeGhlEvent(data);
  return event.includes("contact");
}

export function isFormPayload(data: Record<string, unknown>): boolean {
  const event = normalizeGhlEvent(data);
  return event.includes("form") || !!data.form_id || !!data.formId;
}

export function isAppointmentPayload(data: Record<string, unknown>): boolean {
  const event = normalizeGhlEvent(data);
  return event.includes("appointment") || !!data.appointment_id || !!data.appointmentId;
}
