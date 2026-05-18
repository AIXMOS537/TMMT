import { matchRoutingRule } from "./rules";
import type { DetectionInput, DetectionResult } from "./types";

/**
 * Map pipeline / stage / tags / source → work_type, ClickUp template, priority, agent profile.
 */
export function detectWorkFromEvent(input: DetectionInput): DetectionResult {
  return matchRoutingRule(input);
}
