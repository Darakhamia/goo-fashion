"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { AnalyticsResponse, RangeOption } from "./types";

// Charts are heavy — load only when this page mounts.
const AnalyticsCharts = dynamic(() => import("./Charts"), { ssr: false });

const RANGES: { value: RangeOption; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d",  label: "7d"  },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

function fmtNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString();
}

function fmtMs(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${n} ms`;
}

function fmtDelta(pct: number): { label: string; positive: boolean } {
  if (pct === 0) return { label: "Flat vs previous period", positive: true };
  const sign = pct > 0 ? "+" : "";
  return { label: `${sign}${pct}% vs previous period`, positive: pct >= 0 };
}

function StatCard({ label, value, delta, sub }: { label: string; value: string; delta?: { label: string; positive: boolean }; sub?: string }) {
  return (
    <div className="border border-[var(--border)] p-6" style={{ background: "var(--background)" }}>
      <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">{label}</p>
      <p className="font-display text-3xl font-light text-[var(--foreground)] mb-2">{value}</p>
      {delta && (
        <p className={`text-[10px] tracking-wide ${delta.positive ? "text-emerald-600" : "text-red-500"}`}>
          {delta.label}
        </p>
      )}
      {sub && <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<RangeOption>("7d");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (r: RangeOption) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?range=${r}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const vitalColor = (metric: string, value: number | null): string => {
    if (value === null) return "text-[var(--foreground-subtle)]";
    const thresholds: Record<string, [number, number]> = {
      LCP:  [2500, 4000],
      INP:  [200, 500],
      CLS:  [0.1, 0.25],
      FCP:  [1800, 3000],
      TTFB: [800, 1800],
    };
    const [good, bad] = thresholds[metric] ?? [0, 0];
    if (value <= good) return "text-emerald-600";
    if (value <= bad)  return "text-amber-500";
    return "text-red-500";
  };

  const funnelMax = useMemo(() => {
    if (!data?.funnel?.length) return 0;
    return Math.max(...data.funnel.map((f) => f.sessions));
  }, [data]);

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Analytics</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {data ? `${fmtNumber(data.summary.pageViews)} page views in the last ${range}` : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`text-[10px] tracking-[0.14em] uppercase px-3 py-2 border transition-colors ${
                range === r.value
                  ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                  : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => load(range)}
            disabled={loading}
            className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] px-3 py-2 transition-colors disabled:opacity-50"
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 border border-red-500/40 bg-red-500/5 text-red-600 text-xs px-4 py-3">{error}</div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Page Views"
          value={fmtNumber(data?.summary.pageViews)}
          sub={`${fmtNumber(data?.summary.uniqueVisitors)} unique`}
        />
        <StatCard
          label="Unique Visitors"
          value={fmtNumber(data?.summary.uniqueVisitors)}
          delta={data ? fmtDelta(data.summary.visitorsDelta) : undefined}
          sub={`${fmtNumber(data?.summary.signedInVisitors)} signed-in`}
        />
        <StatCard
          label="Avg Load Time"
          value={fmtMs(data?.summary.avgLoadMs)}
          sub={`p75 ${fmtMs(data?.summary.p75LoadMs)}`}
        />
        <StatCard
          label="Avg TTFB"
          value={fmtMs(data?.summary.avgTtfbMs)}
          sub="Time to First Byte"
        />
      </div>

      {/* Chart: visits over time */}
      <section className="mb-10">
        <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">
          Traffic Over Time
        </h2>
        <div className="border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
          {data && <AnalyticsCharts data={data} />}
          {!data && <div className="h-64 flex items-center justify-center text-xs text-[var(--foreground-subtle)]">Loading…</div>}
        </div>
      </section>

      {/* Web Vitals */}
      <section className="mb-10">
        <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">
          Core Web Vitals
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {data?.vitals.map((v) => {
            const display = v.metric === "CLS"
              ? (v.p75?.toFixed(3) ?? "—")
              : (v.p75 !== null ? fmtMs(Math.round(v.p75)) : "—");
            return (
              <div key={v.metric} className="border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
                <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-2">{v.metric} (p75)</p>
                <p className={`font-display text-2xl font-light ${vitalColor(v.metric, v.p75)}`}>{display}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">{fmtNumber(v.samples)} samples</p>
              </div>
            );
          })}
          {!data && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-[var(--border)] p-4 h-24" style={{ background: "var(--background)" }} />
          ))}
        </div>
      </section>

      {/* Funnel */}
      <section className="mb-10">
        <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">
          Funnel (unique sessions)
        </h2>
        <div className="border border-[var(--border)] p-4 space-y-3" style={{ background: "var(--background)" }}>
          {data?.funnel.map((step, i) => {
            const prev = i > 0 ? data.funnel[i - 1].sessions : step.sessions;
            const conv = prev > 0 ? Math.round((step.sessions / prev) * 100) : 0;
            const width = funnelMax > 0 ? Math.max(4, Math.round((step.sessions / funnelMax) * 100)) : 0;
            return (
              <div key={step.step}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs text-[var(--foreground)]">{step.step}</span>
                  <span className="text-xs text-[var(--foreground-muted)] tabular-nums">
                    {fmtNumber(step.sessions)}{i > 0 && <span className="text-[var(--foreground-subtle)] ml-2">· {conv}%</span>}
                  </span>
                </div>
                <div className="h-2 bg-[var(--surface)]">
                  <div className="h-full bg-[var(--foreground)] transition-all" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Retention + Devices + Browsers */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="border border-[var(--border)] p-6" style={{ background: "var(--background)" }}>
          <h3 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">Retention</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><p className="text-[9px] text-[var(--foreground-subtle)] uppercase mb-1">DAU</p><p className="font-display text-xl font-light">{fmtNumber(data?.retention.dau)}</p></div>
            <div><p className="text-[9px] text-[var(--foreground-subtle)] uppercase mb-1">WAU</p><p className="font-display text-xl font-light">{fmtNumber(data?.retention.wau)}</p></div>
            <div><p className="text-[9px] text-[var(--foreground-subtle)] uppercase mb-1">MAU</p><p className="font-display text-xl font-light">{fmtNumber(data?.retention.mau)}</p></div>
            <div><p className="text-[9px] text-[var(--foreground-subtle)] uppercase mb-1">Stickiness</p><p className="font-display text-xl font-light">{data?.retention.stickiness ?? 0}%</p></div>
          </div>
        </div>

        <RowList title="Devices"  items={data?.devices.map((d)  => ({ key: d.key, count: d.count })) ?? []} loading={!data} />
        <RowList title="Browsers" items={data?.browsers.map((b) => ({ key: b.key, count: b.count })) ?? []} loading={!data} />
      </section>

      {/* Top pages + top products + top outfits */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        <TopTable title="Top Pages"    rows={data?.topPages.map((p) => ({ key: p.path, count: p.views, sub: p.avgLoadMs ? `${p.avgLoadMs} ms avg` : "" })) ?? []} loading={!data} />
        <TopTable title="Top Products" rows={data?.topProducts.map((p) => ({ key: p.key, count: p.count, sub: "", href: `/product/${p.key}` })) ?? []} loading={!data} />
        <TopTable title="Top Outfits"  rows={data?.topOutfits.map((o) => ({ key: o.key, count: o.count, sub: "", href: `/outfit/${o.key}` })) ?? []} loading={!data} />
      </section>

      {/* Referrers + UTM + Countries */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        <RowList title="Referrers" items={data?.referrers.map((r) => ({ key: r.key, count: r.count })) ?? []} loading={!data} />
        <RowList title="UTM Sources" items={data?.utmSources.map((u) => ({ key: u.key, count: u.count })) ?? []} loading={!data} empty="No UTM-tagged traffic yet" />
        <RowList title="Countries" items={data?.countries.map((c) => ({ key: c.key, count: c.count })) ?? []} loading={!data} />
      </section>

      {/* Events breakdown */}
      <section className="mb-10">
        <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">Event Breakdown</h2>
        <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
          {data?.events.length === 0 && (
            <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">No tracked events yet. Events fire when users view products, save outfits, or generate looks.</div>
          )}
          {data?.events.map((e) => (
            <div key={e.event} className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] last:border-0">
              <span className="text-xs text-[var(--foreground)] font-mono">{e.event}</span>
              <span className="text-xs text-[var(--foreground-muted)] tabular-nums">{fmtNumber(e.count)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function RowList({
  title,
  items,
  loading,
  empty = "No data yet",
}: {
  title: string;
  items: { key: string; count: number }[];
  loading: boolean;
  empty?: string;
}) {
  const max = items.length ? Math.max(...items.map((i) => i.count)) : 0;
  return (
    <div>
      <h3 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">{title}</h3>
      <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
        {loading && <div className="h-24 animate-pulse" />}
        {!loading && items.length === 0 && <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">{empty}</div>}
        {items.map((item) => {
          const w = max > 0 ? Math.max(2, Math.round((item.count / max) * 100)) : 0;
          return (
            <div key={item.key} className="relative border-b border-[var(--border)] last:border-0 px-4 py-2.5">
              <div className="absolute inset-0 bg-[var(--fg-overlay-05)]" style={{ width: `${w}%` }} />
              <div className="relative flex items-center justify-between">
                <span className="text-xs text-[var(--foreground)] truncate max-w-[60%]">{item.key || "—"}</span>
                <span className="text-xs text-[var(--foreground-muted)] tabular-nums">{item.count.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopTable({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: { key: string; count: number; sub: string; href?: string }[];
  loading: boolean;
}) {
  return (
    <div>
      <h3 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">{title}</h3>
      <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
        {loading && <div className="h-24 animate-pulse" />}
        {!loading && rows.length === 0 && <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">No data yet</div>}
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] last:border-0 gap-3">
            <div className="min-w-0 flex-1">
              {r.href ? (
                <a href={r.href} target="_blank" rel="noreferrer" className="text-xs text-[var(--foreground)] hover:underline truncate block">{r.key}</a>
              ) : (
                <span className="text-xs text-[var(--foreground)] truncate block">{r.key}</span>
              )}
              {r.sub && <p className="text-[10px] text-[var(--foreground-subtle)]">{r.sub}</p>}
            </div>
            <span className="text-xs text-[var(--foreground-muted)] tabular-nums">{r.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
