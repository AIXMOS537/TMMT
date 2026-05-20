export const DEFAULT_INSURANCE_MARKUP = 2;
export const DEFAULT_PROFIT_MARGIN_PERCENT = 20;
export const DEFAULT_MIN_VEHICLE_MARGIN_PERCENT = 8;

/** Staff may apply discounts up to this % off list without manager sign-off. */
export const STAFF_AUTO_APPROVE_MAX_DISCOUNT_PERCENT = 10;

/** Discounts above this % require manager approval before applying the close rate. */
export const MANAGER_APPROVAL_DISCOUNT_THRESHOLD_PERCENT = 10;

/** From this % up (until supervisor threshold), flag supervisor/owner internally — manager may still approve. */
export const INTERNAL_SUPERVISOR_NOTIFY_MIN_PERCENT = 20;

/** At or above this %, supervisor or owner must approve (manager alone is not enough). */
export const SUPERVISOR_APPROVAL_DISCOUNT_THRESHOLD_PERCENT = 30;
