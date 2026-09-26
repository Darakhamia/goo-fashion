import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// ──────────────────────────────────────────────────────────────────────────
// Aggregator for /goo-studio/analytics. Reads raw rows from page_views,
// web_vitals, and analytics_events within the selected range and rolls
// them up in-process. Tables are read page by page (see readAll), so the
// totals are not clipped at the PostgREST row cap.
//
// Everything keyed on session_id counts sessions, not people: the tracker
// starts a new session after 30 minutes idle.
// ──────────────────────────────────────────────────────────────────────────

type Range = "24h" | "7d" | "30d" | "90d";

const HOUR_MS = 3_600_000;
const DAY_MS  = 86_400_000;

function rangeMs(r: Range): number {
  switch (r) {
    case "24h": return 24 * HOUR_MS;
    case "7d":  return 7 * DAY_MS;
    case "30d": return 30 * DAY_MS;
    case "90d": return 90 * DAY_MS;
  }
}

function bucketSize(r: Range): "hour" | "day" {
  return r === "24h" ? "hour" : "day";
}

function bucketCount(r: Range): number {
  switch (r) {
    case "24h": return 24;
    case "7d":  return 7;
    case "30d": return 30;
    case "90d": return 90;
  }
}

interface PageViewRow {
  ts: string;
  session_id: string;
  user_id: string | null;
  path: string;
  referrer: string | null;
  utm_source: string | null;
  country: string | null;
  device: string | null;
  browser: string | null;
  load_ms: number | null;
}

interface WebVitalRow {
  metric: string;
  value: number;
}

interface EventRow {
  session_id: string;
  event: string;
  props: Record<string, unknown> | null;
}

// ── Paged reads ─────────────────────────────────────────────────────────────
// PostgREST answers any request with at most PGRST_DB_MAX_ROWS rows (1000
// unless the server raises it), whatever .limit() asks for, so one request
// per table stalls every counter at that cap. Tables are read page by page.
//
// Pages follow a keyset, not an OFFSET: each asks for the rows after the last
// one it got, so the database walks the index from where it stopped. With an
// OFFSET every page re-read all the rows it skipped — at 100k rows in, each
// page scanned 100k more, and a 90-day range cost hundreds of requests that
// held the database's connections for tens of seconds. One table's pages are
// read one after another.

const PAGE_SIZE = 1000;
/** Past this many rows only the newest are read, and the response says so. */
const MAX_ROWS = 200_000;

type PageResponse<T> = { data: T[] | null; error: { message: string } | null };

interface ReadResult<T> {
  rows: T[];
  /** More rows matched than MAX_ROWS; the oldest were left out. */
  truncated: boolean;
  error: string | null;
}

/** A value inside a PostgREST `or` filter, quoted so its dots and colons stay literal. */
const orValue = (v: string | number) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * Reads every row of a query, MAX_ROWS at most. `page(last)` must order the
 * rows newest first on a unique key and, given the previous page's last row,
 * return only the rows after it — so pages neither overlap nor skip and a
 * capped read keeps the most recent rows. Stops early when the request that
 * asked for the numbers has gone.
 */
async function readAll<T>(
  page: (last: T | null) => PromiseLike<PageResponse<T>>,
  signal?: AbortSignal,
): Promise<ReadResult<T>> {
  const rows: T[] = [];
  let last: T | null = null;
  // The server may cap a page below PAGE_SIZE: the biggest page seen is its size.
  let step = 0;
  for (;;) {
    if (signal?.aborted) return { rows: [], truncated: false, error: "request aborted" };
    const res = await page(last);
    if (res.error) return { rows: [], truncated: false, error: res.error.message };
    const data = res.data ?? [];
    if (data.length === 0) return { rows, truncated: false, error: null };
    step = Math.max(step, data.length);
    for (const row of data) rows.push(row);
    if (rows.length >= MAX_ROWS) return { rows: rows.slice(0, MAX_ROWS), truncated: true, error: null };
    // A page shorter than the server's page size is the last one.
    if (data.length < step) return { rows, truncated: false, error: null };
    last = data[data.length - 1];
  }
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

// The site does not send these events yet (audit plan task Б4-2; see the
// track() callers). Until one arrives, their zero means "not measured", not
// "nobody did it", and the page says so.
const NOT_YET_SENT = new Set(["save_outfit", "generate_success", "generate_error"]);

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }
  const sb = supabase;
  // An admin switching ranges aborts the old request; its reads stop too.
  const signal = req.signal;

  const { searchParams } = new URL(req.url);
  const range = (searchParams.get("range") as Range) || "7d";
  if (!["24h", "7d", "30d", "90d"].includes(range)) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const now = Date.now();
  const since = new Date(now - rangeMs(range)).toISOString();
  const prevSince = new Date(now - 2 * rangeMs(range)).toISOString();
  // Exclusive upper bound, fixed before the first page: rows written while the
  // pages are being read stay out, so every table is read over the same span.
  const until = new Date(now + 1).toISOString();
  const bucket = bucketSize(range);

  // Chart buckets: whole hours / UTC days ending with the current one, so the
  // chart includes this hour and today. The partial bucket at the start of the
  // rolling window is not drawn.
  const stepMs = bucket === "hour" ? HOUR_MS : DAY_MS;
  const buckets: string[] = [];
  for (let i = bucketCount(range) - 1; i >= 0; i--) {
    buckets.push(bucketKey(new Date(now - i * stepMs).toISOString(), bucket));
  }
  // Stylist usage is stored per UTC day: 24h shows today, longer ranges the
  // same calendar days as the chart.
  const stylistSinceDate = bucket === "hour" ? bucketKey(new Date(now).toISOString(), "day") : buckets[0];

  // Rows of `table` with ts in [from, to), newest first on (ts, id), each page
  // after the previous one's last row. The column list is built at runtime, so
  // supabase-js cannot type the rows; T names them.
  type Keyed = { ts: string; id: number | string };
  const newestFirst = <T>(table: string, columns: string, from: string, to: string) => {
    const select = [...new Set([...columns.split(","), "ts", "id"])].join(",");
    return (last: (T & Keyed) | null) => {
      let query = sb.from(table).select(select).gte("ts", from).lt("ts", to);
      if (last) {
        query = query.or(
          `ts.lt.${orValue(last.ts)},and(ts.eq.${orValue(last.ts)},id.lt.${orValue(last.id)})`,
        );
      }
      return query
        .order("ts", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE) as unknown as PromiseLike<PageResponse<T & Keyed>>;
    };
  };

  // ── Fetch raw rows ────────────────────────────────────────────────────────
  const fiveMinAgo = new Date(now - 5 * 60_000).toISOString();
  // Sessions over the last 30 days — the session windows below use their own
  // spans, not the selected range. A 30d or 90d range already holds them.
  const reuseMonth = range === "30d" || range === "90d";
  const [pvR, pvPrevR, wvR, evR, onlineR, monthR, stylistR] = await Promise.all([
    readAll(newestFirst<PageViewRow>(
      "page_views",
      "ts,session_id,user_id,path,referrer,utm_source,country,device,browser,load_ms",
      since, until,
    ), signal),
    // Previous window — for the comparison delta
    readAll(newestFirst<{ session_id: string }>("page_views", "session_id", prevSince, since), signal),
    readAll(newestFirst<WebVitalRow>("web_vitals", "metric,value", since, until), signal),
    readAll(newestFirst<EventRow>("analytics_events", "session_id,event,props", since, until), signal),
    // Realtime: sessions seen in the last 5 minutes
    readAll(newestFirst<{ session_id: string }>("page_views", "session_id", fiveMinAgo, until), signal),
    reuseMonth
      ? Promise.resolve(null)
      : readAll(
          newestFirst<{ ts: string; session_id: string }>("page_views", "ts,session_id", new Date(now - 30 * DAY_MS).toISOString(), until),
          signal,
        ),
    // Stylist AI usage per day over the range
    readAll<{ usage_date: string; user_id: string; count: number }>((last) => {
      let query = sb.from("stylist_daily_usage")
        .select("usage_date,user_id,count")
        .gte("usage_date", stylistSinceDate);
      if (last) {
        query = query.or(
          `usage_date.lt.${orValue(last.usage_date)},and(usage_date.eq.${orValue(last.usage_date)},user_id.lt.${orValue(last.user_id)})`,
        );
      }
      return query
        .order("usage_date", { ascending: false })
        .order("user_id", { ascending: false })
        .limit(PAGE_SIZE);
    }, signal),
  ]);

  // Zeros from a failed read would pass for "no traffic" — fail loudly instead.
  const mainReads: [string, ReadResult<unknown> | null][] = [
    ["page_views", pvR],
    ["page_views (previous period)", pvPrevR],
    ["web_vitals", wvR],
    ["analytics_events", evR],
    ["page_views (online now)", onlineR],
    ["page_views (last 30 days)", monthR],
  ];
  for (const [label, r] of mainReads) {
    if (r?.error) {
      return NextResponse.json({ error: `Could not read ${label}: ${r.error}` }, { status: 500 });
    }
  }

  const pageViews = pvR.rows;
  const vitals    = wvR.rows;
  const events    = evR.rows;
  const monthViews = monthR
    ? monthR.rows
    : pageViews.filter((pv) => now - Date.parse(pv.ts) <= 30 * DAY_MS);
  const truncated = [...mainReads.map(([, r]) => r), stylistR].some((r) => r?.truncated);

  // ── Summary counters ──────────────────────────────────────────────────────
  const sessions     = new Set(pageViews.map((r) => r.session_id));
  const users        = new Set(pageViews.filter((r) => r.user_id).map((r) => r.user_id));
  const prevSessions = new Set(pvPrevR.rows.map((r) => r.session_id));

  const loadMsSamples = pageViews.map((r) => r.load_ms).filter((v): v is number => typeof v === "number");

  const summary = {
    pageViews:     pageViews.length,
    sessions:      sessions.size,
    signedInUsers: users.size,
    avgLoadMs:     loadMsSamples.length ? Math.round(loadMsSamples.reduce((s, v) => s + v, 0) / loadMsSamples.length) : null,
    p75LoadMs:     percentile(loadMsSamples, 75),
    sessionsDelta: prevSessions.size === 0
      ? (sessions.size > 0 ? 100 : 0)
      : Math.round(((sessions.size - prevSessions.size) / prevSessions.size) * 100),
    onlineNow:     new Set(onlineR.rows.map((r) => r.session_id)).size,
  };

  // ── Time series ───────────────────────────────────────────────────────────
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
    bucket:   b,
    views:    tsViews.get(b) ?? 0,
    sessions: tsSessions.get(b)?.size ?? 0,
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
      samples:  samples.length,
    };
  });

  // ── Domain events breakdown ───────────────────────────────────────────────
  const eventBreakdown = new Map<string, number>();
  for (const e of events) {
    eventBreakdown.set(e.event, (eventBreakdown.get(e.event) ?? 0) + 1);
  }
  const eventsList = Array.from(eventBreakdown.entries())
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count);
  const isTracked = (event: string) => !NOT_YET_SENT.has(event) || eventBreakdown.has(event);

  // ── Funnel ────────────────────────────────────────────────────────────────
  // Count sessions that hit each step, in order.
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
    { step: "Visited site",   sessions: sessions.size,         tracked: true },
    { step: "Viewed product", sessions: productSessions.size,  tracked: true },
    { step: "Saved outfit",   sessions: saveSessions.size,     tracked: isTracked("save_outfit") },
    { step: "Generated look", sessions: generateSessions.size, tracked: isTracked("generate_success") },
  ];

  // ── Session windows (24h / 7d / 30d) ──────────────────────────────────────
  // Computed from a fixed 30-day window (monthViews), independent of the
  // selected range, so the numbers mean what their labels say.
  const last24h = new Set<string>();
  const last7d  = new Set<string>();
  const last30d = new Set<string>();
  for (const pv of monthViews) {
    const age = now - Date.parse(pv.ts);
    if (age <= DAY_MS)     last24h.add(pv.session_id);
    if (age <= 7 * DAY_MS) last7d.add(pv.session_id);
    last30d.add(pv.session_id);
  }
  const sessionWindows = { last24h: last24h.size, last7d: last7d.size, last30d: last30d.size };

  // ── AI usage ──────────────────────────────────────────────────────────────
  const stylistUsage = stylistR.rows;
  const stylistByDay = new Map<string, number>();
  for (const r of stylistUsage) {
    stylistByDay.set(r.usage_date, (stylistByDay.get(r.usage_date) ?? 0) + r.count);
  }
  const aiUsage = {
    stylistMessages: stylistR.error ? null : stylistUsage.reduce((s, r) => s + r.count, 0),
    stylistError: stylistR.error,
    stylistDaily: Array.from(stylistByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    imageGenerations: eventBreakdown.get("generate_success") ?? 0,
    imageGenerationErrors: eventBreakdown.get("generate_error") ?? 0,
    imageGenerationsTracked: isTracked("generate_success") || isTracked("generate_error"),
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
      ? sb.from("products").select("id,name,brand,image_url").in("id", topProductsRaw.map((p) => p.key))
      : Promise.resolve({ data: [], error: null }),
    topOutfitsRaw.length
      ? sb.from("outfits").select("id,name,image_url").in("id", topOutfitsRaw.map((o) => o.key))
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
    range,
    truncated,
    summary,
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
    sessionWindows,
    aiUsage,
    heatmap,
    events:      eventsList,
  });
}
