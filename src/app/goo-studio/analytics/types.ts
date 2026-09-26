export type RangeOption = "24h" | "7d" | "30d" | "90d";

export interface AnalyticsResponse {
  range: RangeOption;
  /** A table held more rows than the API reads; only the newest were counted. */
  truncated: boolean;
  summary: {
    pageViews: number;
    /** Distinct session_id. A session ends after 30 min idle — these are not people. */
    sessions: number;
    /** Distinct signed-in user ids. */
    signedInUsers: number;
    avgLoadMs: number | null;
    p75LoadMs: number | null;
    /** Sessions vs the same-length period before, in percent. */
    sessionsDelta: number;
    onlineNow: number;
  };
  timeseries: { bucket: string; views: number; sessions: number }[];
  topPages:    { path: string; views: number; avgLoadMs: number | null }[];
  topProducts: { key: string; count: number; name: string | null; brand: string | null; imageUrl: string | null }[];
  topOutfits:  { key: string; count: number; name: string | null; imageUrl: string | null }[];
  referrers:   { key: string; count: number }[];
  utmSources:  { key: string; count: number }[];
  devices:     { key: string; count: number }[];
  browsers:    { key: string; count: number }[];
  countries:   { key: string; count: number }[];
  searchTerms: { key: string; count: number }[];
  vitals: { metric: string; p75: number | null; samples: number }[];
  /** `tracked: false` — the site does not send this step's event yet, so its 0 is not a measurement. */
  funnel: { step: string; sessions: number; tracked: boolean }[];
  /** Sessions over fixed windows, independent of the selected range. */
  sessionWindows: { last24h: number; last7d: number; last30d: number };
  aiUsage: {
    /** null when stylist_daily_usage could not be read — see stylistError. */
    stylistMessages: number | null;
    stylistError: string | null;
    stylistDaily: { date: string; count: number }[];
    imageGenerations: number;
    imageGenerationErrors: number;
    /** false — the site does not send generate_* events yet. */
    imageGenerationsTracked: boolean;
  };
  /** 7×24 page-view counts: [weekday (0=Mon)][hour, Kyiv time] */
  heatmap: number[][];
  events: { event: string; count: number }[];
}
