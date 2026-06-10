import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ──────────────────────────────────────────────────────────────────────────
// Aggregator for /admin/analytics. Fetches raw rows from page_views,
// web_vitals, and analytics_events within the selected range and rolls
// them up in-process. Fine up to a few hundred thousand rows.
// ──────────────────────────────────────────────────────────────────────────

type Range = "24h" | "7d" | "30d" | "90d";

function rangeMs(r: Range): number {
  switch (r) {
    case "24h": return 24 * 3_600_000;
    case "7d":  return 7 * 86_400_000;
    case "30d": return 30 * 86_400_000;
    case "90d": return 90 * 86_400_000;
  }
}

function bucketSize(r: Range): "hour" | "day" {
  return r === "24h" ? "hour" : "day";
}

interface PageViewRow {
  ts: string;
  session_id: string;
  user_id: string | null;
  path: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  load_ms: number | null;
  ttfb_ms: number | null;
}

interface WebVitalRow {
  ts: string;
  metric: string;
  value: number;
  path: string;
  rating: string | null;
  device: string | null;
}

interface EventRow {
  ts: string;
  session_id: string;
  user_id: string | null;
  event: string;
  target_id: string | null;
  props: Record<string, unknown> | null;
}

interface SubscriptionRow {
  plan: string;
  status: string;
  amount: number;
  auto_renew: boolean;
  current_period_end: string | null;
}

function safeReferrerHost(ref: string | null): string | null {
  if (!ref) return "direct";
  try {
    return new URL(ref).hostname.replace(/^www\./, "");
  } catch {
    return "direct";
  }
}

function bucketKey(ts: string, size: "hour" | "day"): string {
  const d = new Date(ts);
  if (size === "hour") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}:00`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function topN<T extends { count: number }>(map: Map<string, T>, n = 10): Array<T & { key: string }> {
  return Array.from(map.entries())
    .map(([key, v]) => ({ ...v, key }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") as Range) || "7d";
  if (!["24h", "7d", "30d", "90d"].includes(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const now = Date.now();
  const since = new Date(now - rangeMs(range)).toISOString();
  const bucket = bucketSize(range);
  const prevSince = new Date(now - 2 * rangeMs(range)).toISOString();

  // ── Fetch raw rows ────────────────────────────────────────────────────────
  const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();
  const [pvQ, pvPrevQ, wvQ, evQ, onlineQ, subsQ, stylistQ, monthQ] = await Promise.all([
    supabase.from("page_views")
      .select("ts,session_id,user_id,path,referrer,utm_source,utm_medium,utm_campaign,country,device,browser,os,load_ms,ttfb_ms")
      .gte("ts", since)
      .order("ts", { ascending: true })
      .limit(200_000),
    // Previous window — for comparison deltas (only need session_id + user_id)
    supabase.from("page_views")
      .select("session_id,user_id")
      .gte("ts", prevSince)
      .lt("ts", since)
      .limit(200_000),
    supabase.from("web_vitals")
      .select("ts,metric,value,path,rating,device")
      .gte("ts", since)
      .limit(200_000),
    supabase.from("analytics_events")
      .select("ts,session_id,user_id,event,target_id,props")
      .gte("ts", since)
      .limit(200_000),
    // Realtime: sessions seen in the last 5 minutes
    supabase.from("page_views")
      .select("session_id")
      .gte("ts", fiveMinAgo)
      .limit(10_000),
    // Billing ledger — may not exist if the migration hasn't been run
    supabase.from("subscriptions")
      .select("plan,status,amount,auto_renew,current_period_end")
      .limit(50_000),
    // Stylist AI usage per day over the range
    supabase.from("stylist_daily_usage")
      .select("usage_date,count")
      .gte("usage_date", since.slice(0, 10))
      .limit(100_000),
    // Sessions over the last 30 days — DAU/WAU/MAU must use their own windows,
    // not the selected range (otherwise "MAU" on a 24h range is just DAU).
    supabase.from("page_views")
      .select("ts,session_id")
      .gte("ts", new Date(now - 30 * 86_400_000).toISOString())
      .limit(200_000),
  ]);

  const pageViews = (pvQ.data ?? []) as PageViewRow[];
  const pageViewsPrev = (pvPrevQ.data ?? []) as { session_id: string; user_id: string | null }[];
  const vitals    = (wvQ.data ?? []) as WebVitalRow[];
  const events    = (evQ.data ?? []) as EventRow[];
  const onlineRows = (onlineQ.data ?? []) as { session_id: string }[];
  const subs = (subsQ.error ? [] : (subsQ.data ?? [])) as SubscriptionRow[];
  const stylistUsage = (stylistQ.error ? [] : (stylistQ.data ?? [])) as { usage_date: string; count: number }[];
  const monthViews = (monthQ.data ?? []) as { ts: string; session_id: string }[];

  // ── Summary counters ──────────────────────────────────────────────────────
  const uniqueSessions = new Set(pageViews.map((r) => r.session_id));
  const uniqueUsers    = new Set(pageViews.filter((r) => r.user_id).map((r) => r.user_id));
  const prevSessions   = new Set(pageViewsPrev.map((r) => r.session_id));

  const loadMsSamples = pageViews.map((r) => r.load_ms).filter((v): v is number => typeof v === "number");
  const ttfbSamples   = pageViews.map((r) => r.ttfb_ms).filter((v): v is number => typeof v === "number");

  const summary = {
    pageViews:       pageViews.length,
    uniqueVisitors:  uniqueSessions.size,
    signedInVisitors:uniqueUsers.size,
    avgLoadMs:       loadMsSamples.length ? Math.round(loadMsSamples.reduce((s, v) => s + v, 0) / loadMsSamples.length) : null,
    medianLoadMs:    percentile(loadMsSamples, 50),
    p75LoadMs:       percentile(loadMsSamples, 75),
    avgTtfbMs:       ttfbSamples.length ? Math.round(ttfbSamples.reduce((s, v) => s + v, 0) / ttfbSamples.length) : null,
    visitorsDelta:   prevSessions.size === 0
      ? (uniqueSessions.size > 0 ? 100 : 0)
      : Math.round(((uniqueSessions.size - prevSessions.size) / prevSessions.size) * 100),
  };

  // ── Time series ───────────────────────────────────────────────────────────
  // Generate empty buckets so the chart is continuous.
  const start = new Date(now - rangeMs(range));
  const buckets: string[] = [];
  if (bucket === "hour") {
    for (let i = 0; i < 24; i++) {
      const d = new Date(start.getTime() + i * 3_600_000);
      buckets.push(bucketKey(d.toISOString(), "hour"));
    }
  } else {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * 86_400_000);
      buckets.push(bucketKey(d.toISOString(), "day"));
    }
  }
  const tsViews    = new Map<string, number>();
  const tsSessions = new Map<string, Set<string>>();
  buckets.forEach((b) => { tsViews.set(b, 0); tsSessions.set(b, new Set()); });
  for (const pv of pageViews) {
    const k = bucketKey(pv.ts, bucket);
    tsViews.set(k, (tsViews.get(k) ?? 0) + 1);
    const set = tsSessions.get(k) ?? new Set<string>();
    set.add(pv.session_id);
    tsSessions.set(k, set);
  }
  const timeseries = buckets.map((b) => ({
    bucket: b,
    views:  tsViews.get(b)    ?? 0,
    uniqueVisitors: tsSessions.get(b)?.size ?? 0,
  }));

  // ── Top pages ─────────────────────────────────────────────────────────────
  const pageMap = new Map<string, { count: number; loadSum: number; loadN: number }>();
  for (const pv of pageViews) {
    const row = pageMap.get(pv.path) ?? { count: 0, loadSum: 0, loadN: 0 };
    row.count++;
    if (typeof pv.load_ms === "number") { row.loadSum += pv.load_ms; row.loadN++; }
    pageMap.set(pv.path, row);
  }
  const topPages = Array.from(pageMap.entries())
    .map(([path, v]) => ({ path, views: v.count, avgLoadMs: v.loadN ? Math.round(v.loadSum / v.loadN) : null }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);

  // ── Top products / outfits (derive from path) ─────────────────────────────
  const productViews = new Map<string, { count: number }>();
  const outfitViews  = new Map<string, { count: number }>();
  for (const pv of pageViews) {
    const m1 = /^\/product\/([^/?#]+)/.exec(pv.path);
    if (m1) {
      const r = productViews.get(m1[1]) ?? { count: 0 };
      r.count++;
      productViews.set(m1[1], r);
      continue;
    }
    const m2 = /^\/outfit\/([^/?#]+)/.exec(pv.path);
    if (m2) {
      const r = outfitViews.get(m2[1]) ?? { count: 0 };
      r.count++;
      outfitViews.set(m2[1], r);
    }
  }

  // ── Sources / UTM / devices / browsers / countries ────────────────────────
  const referrers = new Map<string, { count: number }>();
  const utmSources = new Map<string, { count: number }>();
  const devices   = new Map<string, { count: number }>();
  const browsers  = new Map<string, { count: number }>();
  const countries = new Map<string, { count: number }>();

  for (const pv of pageViews) {
    const ref = safeReferrerHost(pv.referrer);
    if (ref) { const r = referrers.get(ref) ?? { count: 0 }; r.count++; referrers.set(ref, r); }
    if (pv.utm_source) { const r = utmSources.get(pv.utm_source) ?? { count: 0 }; r.count++; utmSources.set(pv.utm_source, r); }
    const dev = pv.device ?? "unknown"; { const r = devices.get(dev)   ?? { count: 0 }; r.count++; devices.set(dev, r); }
    const br  = pv.browser ?? "unknown"; { const r = browsers.get(br)  ?? { count: 0 }; r.count++; browsers.set(br, r); }
    const co  = pv.country ?? "Unknown"; { const r = countries.get(co) ?? { count: 0 }; r.count++; countries.set(co, r); }
  }

  // ── Web Vitals: p75 per metric ────────────────────────────────────────────
  const vitalsBy = new Map<string, number[]>();
  for (const v of vitals) {
    const arr = vitalsBy.get(v.metric) ?? [];
    arr.push(v.value);
    vitalsBy.set(v.metric, arr);
  }
  const vitalsSummary = ["LCP", "INP", "CLS", "FCP", "TTFB"].map((metric) => {
    const samples = vitalsBy.get(metric) ?? [];
    return {
      metric,
      p75:      percentile(samples, 75),
      p90:      percentile(samples, 90),
      median:   percentile(samples, 50),
      samples:  samples.length,
    };
  });

  // ── Funnel ────────────────────────────────────────────────────────────────
  // Count unique sessions that hit each step, in order.
  const visitSessions    = uniqueSessions;
  const productSessions  = new Set<string>();
  const saveSessions     = new Set<string>();
  const generateSessions = new Set<string>();
  for (const pv of pageViews) {
    if (/^\/product\//.test(pv.path)) productSessions.add(pv.session_id);
  }
  for (const e of events) {
    if (e.event === "save_outfit")     saveSessions.add(e.session_id);
    if (e.event === "generate_success")generateSessions.add(e.session_id);
  }
  const funnel = [
    { step: "Visited site",        sessions: visitSessions.size    },
    { step: "Viewed product",      sessions: productSessions.size  },
    { step: "Saved outfit",        sessions: saveSessions.size     },
    { step: "Generated look",      sessions: generateSessions.size },
  ];

  // ── Retention (DAU / WAU / MAU) ───────────────────────────────────────────
  // Computed from a fixed 30-day window (monthViews), independent of the
  // selected range, so the numbers mean what their labels say.
  const dayMs = 86_400_000;
  const dau = new Set<string>();
  const wau = new Set<string>();
  const mau = new Set<string>();
  for (const pv of monthViews) {
    const age = now - Date.parse(pv.ts);
    if (age <= dayMs)       dau.add(pv.session_id);
    if (age <= 7 * dayMs)   wau.add(pv.session_id);
    mau.add(pv.session_id);
  }
  const retention = {
    dau: dau.size,
    wau: wau.size,
    mau: mau.size,
    stickiness: mau.size > 0 ? Math.round((dau.size / mau.size) * 100) : 0,
  };

  // ── Domain events breakdown ───────────────────────────────────────────────
  const eventBreakdown = new Map<string, number>();
  for (const e of events) {
    eventBreakdown.set(e.event, (eventBreakdown.get(e.event) ?? 0) + 1);
  }
  const eventsList = Array.from(eventBreakdown.entries())
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count);

  // ── Realtime + new vs returning ──────────────────────────────────────────
  const onlineNow = new Set(onlineRows.map((r) => r.session_id)).size;
  let returningSessions = 0;
  for (const s of uniqueSessions) if (prevSessions.has(s)) returningSessions++;
  const newVsReturning = {
    newSessions: uniqueSessions.size - returningSessions,
    returningSessions,
  };

  // ── Business (subscriptions ledger) ──────────────────────────────────────
  const activeSubs = subs.filter((s) => s.status === "active");
  const byPlan = new Map<string, number>();
  for (const s of activeSubs) byPlan.set(s.plan, (byPlan.get(s.plan) ?? 0) + 1);
  const business = {
    // amount is stored in minor units (kopiykas) — MRR in whole UAH
    mrrUah: Math.round(activeSubs.reduce((sum, s) => sum + s.amount, 0) / 100),
    activeSubscriptions: activeSubs.length,
    byPlan: Array.from(byPlan.entries()).map(([plan, count]) => ({ plan, count })),
    pastDue: subs.filter((s) => s.status === "past_due").length,
    canceled: subs.filter((s) => s.status === "canceled").length,
    autoRenewOff: activeSubs.filter((s) => !s.auto_renew).length,
  };

  // ── AI usage ──────────────────────────────────────────────────────────────
  const stylistByDay = new Map<string, number>();
  for (const r of stylistUsage) {
    stylistByDay.set(r.usage_date, (stylistByDay.get(r.usage_date) ?? 0) + r.count);
  }
  const aiUsage = {
    stylistMessages: stylistUsage.reduce((s, r) => s + r.count, 0),
    stylistDaily: Array.from(stylistByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    imageGenerations: eventBreakdown.get("generate_success") ?? 0,
    imageGenerationErrors: eventBreakdown.get("generate_error") ?? 0,
  };

  // ── Search terms ──────────────────────────────────────────────────────────
  const searchTerms = new Map<string, { count: number }>();
  for (const e of events) {
    if (e.event !== "search") continue;
    const q = typeof e.props?.query === "string" ? e.props.query.trim().toLowerCase() : "";
    if (!q) continue;
    const r = searchTerms.get(q) ?? { count: 0 };
    r.count++;
    searchTerms.set(q, r);
  }

  // ── Activity heatmap: Kyiv weekday (0=Mon) × hour ────────────────────────
  // Formatted via Intl for correct DST handling; cached per hour-bucket so we
  // run the (slow) formatter at most ~24×days times, not once per row.
  const kyivFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv", weekday: "short", hour: "numeric", hour12: false,
  });
  const WD_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const hourCache = new Map<string, { wd: number; hour: number }>();
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const pv of pageViews) {
    const bucketTs = pv.ts.slice(0, 13); // YYYY-MM-DDTHH
    let cell = hourCache.get(bucketTs);
    if (!cell) {
      const parts = kyivFmt.formatToParts(new Date(pv.ts));
      const wd = WD_INDEX[parts.find((p) => p.type === "weekday")?.value ?? "Mon"] ?? 0;
      const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
      cell = { wd, hour };
      hourCache.set(bucketTs, cell);
    }
    heatmap[cell.wd][cell.hour]++;
  }

  // ── Resolve product/outfit names for the top lists ───────────────────────
  const topProductsRaw = topN(productViews, 10);
  const topOutfitsRaw  = topN(outfitViews, 10);
  const [prodNamesQ, outfitNamesQ] = await Promise.all([
    topProductsRaw.length
      ? supabase.from("products").select("id,name,brand,image_url").in("id", topProductsRaw.map((p) => p.key))
      : Promise.resolve({ data: [], error: null }),
    topOutfitsRaw.length
      ? supabase.from("outfits").select("id,name,image_url").in("id", topOutfitsRaw.map((o) => o.key))
      : Promise.resolve({ data: [], error: null }),
  ]);
  const prodMeta = new Map(
    ((prodNamesQ.data ?? []) as { id: string; name: string; brand: string; image_url: string }[])
      .map((p) => [p.id, p])
  );
  const outfitMeta = new Map(
    ((outfitNamesQ.data ?? []) as { id: string; name: string; image_url: string }[])
      .map((o) => [o.id, o])
  );
  const topProducts = topProductsRaw.map((p) => ({
    ...p,
    name: prodMeta.get(p.key)?.name ?? null,
    brand: prodMeta.get(p.key)?.brand ?? null,
    imageUrl: prodMeta.get(p.key)?.image_url ?? null,
  }));
  const topOutfits = topOutfitsRaw.map((o) => ({
    ...o,
    name: outfitMeta.get(o.key)?.name ?? null,
    imageUrl: outfitMeta.get(o.key)?.image_url ?? null,
  }));

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    range,
    summary: { ...summary, onlineNow },
    timeseries,
    topPages,
    topProducts,
    topOutfits,
    referrers:   topN(referrers, 10),
    utmSources:  topN(utmSources, 10),
    devices:     topN(devices, 5),
    browsers:    topN(browsers, 5),
    countries:   topN(countries, 10),
    searchTerms: topN(searchTerms, 10),
    vitals:      vitalsSummary,
    funnel,
    retention,
    newVsReturning,
    business,
    aiUsage,
    heatmap,
    events:      eventsList,
  });
}
