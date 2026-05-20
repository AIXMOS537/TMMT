export type CooBriefingKind = "daily" | "weekly";

export type CooBriefing = {
  id: string;
  briefing_date: string;
  kind: CooBriefingKind;
  pipeline_health: string | null;
  escalations: string | null;
  director_sync: string | null;
  blockers: string | null;
  weekly_summary: string | null;
  loom_url: string | null;
  updated_at: string;
};
