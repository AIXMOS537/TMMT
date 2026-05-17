import type { CanonicalRenterStage } from "./types";

type StageMapFile = {
  pipelines: Record<
    string,
    {
      business_line: string;
      pipeline_name?: string;
      stages: Record<string, CanonicalRenterStage>;
    }
  >;
  default_canonical_stage?: CanonicalRenterStage;
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

  if (pipeline?.stages[norm]) {
    return { canonical: pipeline.stages[norm], businessLine: pipeline.business_line };
  }

  for (const p of Object.values(map.pipelines)) {
    if (p.stages[norm]) {
      return { canonical: p.stages[norm], businessLine: p.business_line };
    }
  }

  return { canonical: defaultStage, businessLine: pipeline?.business_line ?? "rentals" };
}
