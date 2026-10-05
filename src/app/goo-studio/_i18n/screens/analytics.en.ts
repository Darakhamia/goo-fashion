import type { Message } from "../en";

/** Analytics (with Charts) (GS4-12). Keys start with "analytics." unless shared with the core dictionary. */
export const analyticsEn = {
  // The head: the period, Refresh, one line of numbers.
  "analytics.subtitle": { one: "{count} page view · {period}", other: "{count} page views · {period}" },
  "analytics.period": "Period",
  "analytics.range.24h": "24h",
  "analytics.range.7d": "7d",
  "analytics.range.30d": "30d",
  "analytics.range.90d": "90d",
  "analytics.period.24h": "last 24 hours",
  "analytics.period.7d": "last 7 days",
  "analytics.period.30d": "last 30 days",
  "analytics.period.90d": "last 90 days",
  "analytics.refresh": "Refresh",
  "analytics.refreshing": "Refreshing…",
  "analytics.loadFailed": "Could not load analytics.",
  "analytics.truncated":
    "Too many rows to read in one pass: only the newest rows of each table were counted, so the oldest part of this range is undercounted.",
  "analytics.noData": "No data",
  "analytics.noDataYet": "No data yet",
  "analytics.notTracked": "not tracked yet",
  "analytics.unknown": "Unknown",
  "analytics.ms": "{value} ms",
  "analytics.seconds": "{value} s",

  // Key numbers.
  "analytics.kpis": "Key numbers",
  "analytics.kpi.online": "Online now",
  "analytics.kpi.onlineNote": "Sessions active in the last 5 min",
  "analytics.kpi.pageViews": "Page views",
  "analytics.kpi.sessions": "Sessions",
  "analytics.kpi.delta": "{pct} vs previous period",
  "analytics.kpi.flat": "Flat vs previous period",
  "analytics.kpi.deltaHint": "Sessions against the period of the same length before it",
  "analytics.kpi.signedIn": { one: "{count} signed-in user", other: "{count} signed-in users" },
  "analytics.kpi.avgLoad": "Avg load time",
  "analytics.kpi.p75": "p75 {value}",

  // Sessions over fixed windows and AI use.
  "analytics.more": "Sessions and AI usage",
  "analytics.window.24h": "Sessions · 24h",
  "analytics.window.7d": "Sessions · 7d",
  "analytics.window.30d": "Sessions · 30d",
  "analytics.window.24h.note": "Last 24 hours",
  "analytics.window.7d.note": "Last 7 days",
  "analytics.window.30d.note": "Last 30 days",
  "analytics.ai.stylist": "Stylist messages",
  "analytics.ai.stylistFailed": "Could not load: {error}",
  "analytics.ai.today": "signed-in users, today (UTC)",
  "analytics.ai.lastDays": { one: "signed-in users, last {count} day", other: "signed-in users, last {count} days" },
  "analytics.ai.images": "Image generations",
  "analytics.ai.imagesFailed": "{count} failed",
  "analytics.ai.noFailures": "no failures",
  "analytics.ai.perDay": "Stylist messages per day",
  "analytics.ai.perDayHint": "Signed-in users only",
  "analytics.ai.noUsage": "No stylist usage yet",

  // Traffic.
  "analytics.traffic": "Traffic over time",
  "analytics.traffic.hint.hourly": "Page views and sessions per hour",
  "analytics.traffic.hint.daily": "Page views and sessions per day",
  "analytics.traffic.views": "Page views",
  "analytics.traffic.sessions": "Sessions",

  // The link to Subscriptions.
  "analytics.revenue.title": "Revenue & subscriptions",
  "analytics.revenue.text": "MRR, plans, past-due and renewals are on the Subscriptions page.",
  "analytics.revenue.open": "Open →",

  // Activity by hour.
  "analytics.heatmap": "Activity by hour (Kyiv time)",
  "analytics.heatmap.cell": { one: "{day} {hour}:00 Kyiv — {count} view", other: "{day} {hour}:00 Kyiv — {count} views" },
  "analytics.day.mon": "Mon",
  "analytics.day.tue": "Tue",
  "analytics.day.wed": "Wed",
  "analytics.day.thu": "Thu",
  "analytics.day.fri": "Fri",
  "analytics.day.sat": "Sat",
  "analytics.day.sun": "Sun",

  // Core Web Vitals.
  "analytics.vitals": "Core Web Vitals — p75",
  "analytics.vital.good": "Good",
  "analytics.vital.needsWork": "Needs improvement",
  "analytics.vital.poor": "Poor",
  "analytics.vital.samples": { one: "{count} sample", other: "{count} samples" },

  // Audience.
  "analytics.audience": "Audience",
  "analytics.devices": "Devices",
  "analytics.browsers": "Browsers",
  "analytics.countries": "Top countries",
  "analytics.noCountries": "No country data yet",
  "analytics.device.mobile": "Mobile",
  "analytics.device.desktop": "Desktop",
  "analytics.device.tablet": "Tablet",

  // Funnel.
  "analytics.funnel": "Conversion funnel (sessions)",
  "analytics.funnel.visited": "Visited site",
  "analytics.funnel.viewedProduct": "Viewed product",
  "analytics.funnel.savedOutfit": "Saved outfit",
  "analytics.funnel.generatedLook": "Generated look",

  // Top content.
  "analytics.top": "Top content",
  "analytics.top.pages": "Pages",
  "analytics.top.products": "Products",
  "analytics.top.outfits": "Outfits",
  "analytics.top.avgLoad": "{ms} ms avg",

  // Sources and search.
  "analytics.sources": "Traffic sources & search",
  "analytics.referrers": "Referrers",
  "analytics.referrer.direct": "Direct",
  "analytics.utm": "UTM sources",
  "analytics.utm.empty": "No UTM-tagged traffic yet",
  "analytics.searchTerms": "Search terms",
  "analytics.search.empty": "No on-site searches yet",

  // Events.
  "analytics.events": "Event breakdown",
  "analytics.events.count": "Events",
  "analytics.events.empty": "No tracked events yet. Events fire when users view products or outfits and search the catalog.",
} as const satisfies Record<string, Message>;
