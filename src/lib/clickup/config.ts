/** TMMT RENTALS ClickUp workspace — list routing defaults from audit.json (2026-05-20). */

export const CLICKUP_TEAM_ID = process.env.CLICKUP_TEAM_ID ?? "90132245195";

export const CLICKUP_LIST_FLEET =
  process.env.CLICKUP_LIST_FLEET ?? "901318986996"; // FLEET TASKS

export const CLICKUP_LIST_OPS =
  process.env.CLICKUP_LIST_OPS ?? "901318985770"; // CUSTOMER POLICY (empty — new ops intake)

export const CLICKUP_LIST_OPS_GENERAL =
  process.env.CLICKUP_LIST_OPS_GENERAL ?? "901318987056"; // OPS TASKS fallback

export const CLICKUP_LIST_REPO =
  process.env.CLICKUP_LIST_REPO ?? "901318985964"; // REPO DEPT TRACKING

export const CLICKUP_LIST_TICKETS =
  process.env.CLICKUP_LIST_TICKETS ?? "901318986343"; // TICKET DEPT

export const CLICKUP_WORKSPACE_URL =
  process.env.NEXT_PUBLIC_CLICKUP_WORKSPACE_URL ??
  `https://app.clickup.com/${CLICKUP_TEAM_ID}`;

export function clickupConfigured(): boolean {
  return Boolean(process.env.CLICKUP_API_TOKEN?.trim());
}

/** Map TMMT case request_type → ClickUp list id. */
export function listIdForRequestType(requestType: string): string {
  switch (requestType) {
    case "maintenance":
    case "inspection":
    case "towing":
    case "detailing":
      return CLICKUP_LIST_FLEET;
    case "insurance":
      return CLICKUP_LIST_TICKETS;
    case "rental_inquiry":
    case "general":
    default:
      return CLICKUP_LIST_OPS;
  }
}

export function listNameForId(listId: string): string {
  const map: Record<string, string> = {
    [CLICKUP_LIST_FLEET]: "FLEET TASKS",
    [CLICKUP_LIST_OPS]: "CUSTOMER POLICY",
    [CLICKUP_LIST_OPS_GENERAL]: "OPS TASKS",
    [CLICKUP_LIST_REPO]: "REPO DEPT TRACKING",
    [CLICKUP_LIST_TICKETS]: "TICKET DEPT",
  };
  return map[listId] ?? listId;
}
