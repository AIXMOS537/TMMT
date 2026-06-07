import type { CanonicalRenterStage } from "./types";
import { loadStageMap } from "./stage-map";

/** First GHL stage label that maps to this canonical stage (for outbound sync). */
export function resolveGhlStageLabel(args: {
  pipelineId?: string | null;
  pipelineName?: string | null;
  canonical: CanonicalRenterStage;
}): string | null {
  const map = loadStageMap();
  const pipeline =
    (args.pipelineId && map.pipelines[args.pipelineId]) ||
    Object.values(map.pipelines).find(
      (p) =>
        p.pipeline_name?.toLowerCase() === (args.pipelineName ?? "").trim().toLowerCase()
    );

  if (!pipeline) return null;

  for (const [ghlLabel, canonical] of Object.entries(pipeline.stages)) {
    if (canonical === args.canonical) return ghlLabel;
  }
  return null;
}
