export function caseRef(row: Record<string, unknown>): string {
  return String(row.ref_code ?? row.case_number ?? "—");
}

export function caseSubject(row: Record<string, unknown>): string {
  return String(row.subject ?? row.title ?? "");
}

export function caseClickUpUrl(row: Record<string, unknown>): string {
  return String(row.clickup_task_url ?? row.clickup_url ?? "");
}

export function caseInternalNotes(row: Record<string, unknown>): string {
  if (row.internal_notes) return String(row.internal_notes);
  const meta = row.metadata as { internal_notes?: string } | null | undefined;
  return meta?.internal_notes ?? "";
}

export function casePriority(row: Record<string, unknown>): string | null {
  if (row.priority != null && row.priority !== "") return String(row.priority);
  const meta = row.metadata as { priority?: string } | null | undefined;
  return meta?.priority ?? null;
}
