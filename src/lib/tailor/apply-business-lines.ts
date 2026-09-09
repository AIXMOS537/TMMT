import type { BusinessLineId, TmmtBusinessLine } from "@/lib/business-lines/types";
import { TAILOR_CONFIG } from "./config";

function mergeLine(
  line: TmmtBusinessLine,
  override: Partial<import("./types").TailorBusinessLineOverride> | undefined
): TmmtBusinessLine {
  if (!override) return line;
  return {
    ...line,
    ...override,
    intake: line.intake
      ? {
          ...line.intake,
          ...override.intake,
        }
      : line.intake,
  };
}

/** Apply enabled/disabled lists and per-line overrides from tailor.json */
export function applyTailorToBusinessLines(lines: TmmtBusinessLine[]): TmmtBusinessLine[] {
  const cfg = TAILOR_CONFIG.businessLines;
  if (!cfg) return lines;

  let result = [...lines];

  const enabled = cfg.enabled;
  if (enabled && enabled.length > 0) {
    const set = new Set(enabled);
    result = result.filter((l) => set.has(l.id));
  }

  const disabled = cfg.disabled ?? [];
  if (disabled.length > 0) {
    const set = new Set(disabled);
    result = result.filter((l) => !set.has(l.id));
  }

  const overrides = cfg.overrides ?? {};
  result = result.map((line) => mergeLine(line, overrides[line.id]));

  return result;
}

export function getTailoredPrimaryPublicLineId(): BusinessLineId {
  return TAILOR_CONFIG.brand.primaryPublicLineId ?? "rentals";
}
