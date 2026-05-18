import type { CanonicalRenterStage } from "./types";

export const DISPATCH_CANONICAL_STAGES = [
  "lead",
  "quoted",
  "booked",
  "pickup_scheduled",
  "in_transit",
  "delivered",
  "pod_received",
  "closed_won",
  "closed_lost",
] as const;

export type CanonicalDispatchStage = (typeof DISPATCH_CANONICAL_STAGES)[number];

type StageMapFile = {
  pipelines: Record<
    string,
    {
      business_line: string;
      pipeline_name?: string;
      stages: Record<string, CanonicalRenterStage | CanonicalDispatchStage>;
    }
  >;
  default_canonical_stage?: CanonicalRenterStage;
  dispatch_default_stage?: CanonicalDispatchStage;
};

let cachedMap: StageMapFile | null = null;

function loadMap(): StageMapFile {
  if (cachedMap) return cachedMap;
  try {
    // Optional runtime config — copy GHL_PIPELINE_STAGE_MAP.example.json on deploy host or bake at build
    const raw = process.env.GHL_PIPELINE_STAGE_MAP_JSON;
    if (raw) {
      cachedMap = JSON.parse(raw) as StageMapFile;
      return cachedMap;
    }
  } catch {
    /* fall through */
  }
  cachedMap = { pipelines: {}, default_canonical_stage: "inquiry" };
  return cachedMap;
}

export function resolveCanonicalStage(args: {
  pipelineId?: string;
  pipelineName?: string;
  stageName: string;
}): { canonical: CanonicalRenterStage; businessLine: string } {
  const map = loadMap();
  const norm = args.stageName.trim().toLowerCase();
  const defaultStage = map.default_canonical_stage ?? "inquiry";

  const pipeline =
    (args.pipelineId && map.pipelines[args.pipelineId]) ||
    Object.values(map.pipelines).find(
      (p) => p.pipeline_name?.toLowerCase() === args.pipelineName?.trim().toLowerCase()
    );

  if (pipeline?.stages[norm] && pipeline.business_line !== "dispatch") {
    return {
      canonical: pipeline.stages[norm] as CanonicalRenterStage,
      businessLine: pipeline.business_line,
    };
  }

  for (const p of Object.values(map.pipelines)) {
    if (p.stages[norm] && p.business_line !== "dispatch") {
      return {
        canonical: p.stages[norm] as CanonicalRenterStage,
        businessLine: p.business_line,
      };
    }
  }

  return { canonical: defaultStage, businessLine: pipeline?.business_line ?? "rentals" };
}

const DISPATCH_STAGE_FALLBACK: Record<string, CanonicalDispatchStage> = {
  "new lead": "lead",
  lead: "lead",
  quoted: "quoted",
  quote: "quoted",
  booked: "booked",
  "pickup scheduled": "pickup_scheduled",
  pickup: "pickup_scheduled",
  "in transit": "in_transit",
  transit: "in_transit",
  delivered: "delivered",
  delivery: "delivered",
  pod: "pod_received",
  "pod received": "pod_received",
  won: "closed_won",
  lost: "closed_lost",
};

export function resolveDispatchStage(args: {
  pipelineId?: string;
  pipelineName?: string;
  stageName: string;
}): { canonical: CanonicalDispatchStage; businessLine: string } {
  const map = loadMap();
  const norm = args.stageName.trim().toLowerCase();
  const defaultStage = map.dispatch_default_stage ?? "lead";

  const pipeline =
    (args.pipelineId && map.pipelines[args.pipelineId]) ||
    Object.values(map.pipelines).find(
      (p) =>
        p.business_line === "dispatch" &&
        p.pipeline_name?.toLowerCase() === args.pipelineName?.trim().toLowerCase()
    ) ||
    Object.values(map.pipelines).find((p) => p.business_line === "dispatch");

  if (pipeline?.stages[norm]) {
    return {
      canonical: pipeline.stages[norm] as CanonicalDispatchStage,
      businessLine: "dispatch",
    };
  }

  if (DISPATCH_STAGE_FALLBACK[norm]) {
    return { canonical: DISPATCH_STAGE_FALLBACK[norm], businessLine: "dispatch" };
  }

  return { canonical: defaultStage, businessLine: "dispatch" };
}

export function isDispatchPipeline(pipelineName?: string, businessLine?: string) {
  const p = (pipelineName ?? "").toLowerCase();
  const b = (businessLine ?? "").toLowerCase();
  return b === "dispatch" || p.includes("dispatch") || p.includes("logistics");
}
