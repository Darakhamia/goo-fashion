export type RangeOption = "24h" | "7d" | "30d" | "90d";

export interface AnalyticsResponse {
  generatedAt: string;
  range: RangeOption;
  summary: {
    pageViews: number;
    uniqueVisitors: number;
    signedInVisitors: number;
    avgLoadMs: number | null;
    medianLoadMs: number | null;
    p75LoadMs: number | null;
    avgTtfbMs: number | null;
    visitorsDelta: number;
    onlineNow: number;
  };
  timeseries: { bucket: string; views: number; uniqueVisitors: number }[];
  topPages:    { path: string; views: number; avgLoadMs: number | null }[];
  topProducts: { key: string; count: number; name: string | null; brand: string | null; imageUrl: string | null }[];
  topOutfits:  { key: string; count: number; name: string | null; imageUrl: string | null }[];
  referrers:   { key: string; count: number }[];
  utmSources:  { key: string; count: number }[];
  devices:     { key: string; count: number }[];
  browsers:    { key: string; count: number }[];
  countries:   { key: string; count: number }[];
  searchTerms: { key: string; count: number }[];
  vitals: { metric: string; p75: number | null; p90: number | null; median: number | null; samples: number }[];
  funnel: { step: string; sessions: number }[];
  retention: { dau: number; wau: number; mau: number; stickiness: number };
  newVsReturning: { newSessions: number; returningSessions: number };
  business: {
    mrrUah: number;
    activeSubscriptions: number;
    byPlan: { plan: string; count: number }[];
    pastDue: number;
    canceled: number;
    autoRenewOff: number;
  };
  aiUsage: {
    stylistMessages: number;
    stylistDaily: { date: string; count: number }[];
    imageGenerations: number;
    imageGenerationErrors: number;
  };
  /** 7×24 page-view counts: [weekday (0=Mon)][hour UTC] */
  heatmap: number[][];
  events: { event: string; count: number }[];
}
