/**
 * Shared credit-desk messages. Lives outside the "use server" actions module,
 * which may only export async functions.
 */
export const CONFLICT_ERROR = "This case changed since it was loaded (someone else saved first). Reload and try again.";
