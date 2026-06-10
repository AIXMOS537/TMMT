export type MarketingKpiWeek = {
  week_start: string;
  followers: number;
  reel_views: number;
  story_views: number;
  dm_started: number;
  calls_booked: number;
  new_subscribers: number;
  email_list_growth: number;
  notes: string | null;
  ghl_synced_at?: string | null;
  ghl_auto?: Record<string, unknown> | null;
  updated_at: string;
};

/** PDF Marketing Rollout — Month 1 vs Month 3 weekly targets */
export const MARKETING_KPI_TARGETS = {
  followers: { month1: 100, month3: 300 },
  reel_views: { month1: 5000, month3: 25000 },
  story_views: { month1: 500, month3: 2000 },
  dm_started: { month1: 30, month3: 100 },
  calls_booked: { month1: 3, month3: 10 },
  new_subscribers: { month1: 5, month3: 20 },
  email_list_growth: { month1: 50, month3: 200 },
} as const;

export type MarketingKpiMetricKey = keyof typeof MARKETING_KPI_TARGETS;
