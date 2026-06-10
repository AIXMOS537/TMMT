import type { ApplicationStatus, AuditEntry, UserRole } from "./types";

export function createAuditEntry(
  actor: string,
  role: UserRole,
  action: string,
  opts?: {
    fromStatus?: ApplicationStatus;
    toStatus?: ApplicationStatus;
    notes?: string;
  }
): AuditEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    actor,
    role,
    action,
    ...opts,
  };
}
