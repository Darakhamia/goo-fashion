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
  };
  timeseries: { bucket: string; views: number; uniqueVisitors: number }[];
  topPages:    { path: string; views: number; avgLoadMs: number | null }[];
  topProducts: { key: string; count: number }[];
  topOutfits:  { key: string; count: number }[];
  referrers:   { key: string; count: number }[];
  utmSources:  { key: string; count: number }[];
  devices:     { key: string; count: number }[];
  browsers:    { key: string; count: number }[];
  countries:   { key: string; count: number }[];
  vitals: { metric: string; p75: number | null; p90: number | null; median: number | null; samples: number }[];
  funnel: { step: string; sessions: number }[];
  retention: { dau: number; wau: number; mau: number; stickiness: number };
  events: { event: string; count: number }[];
}
