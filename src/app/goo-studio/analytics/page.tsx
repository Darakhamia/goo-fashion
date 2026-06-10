"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { AnalyticsResponse, RangeOption } from "./types";

const TrafficChart   = dynamic(() => import("./Charts").then((m) => m.TrafficChart),   { ssr: false });
const DevicePie      = dynamic(() => import("./Charts").then((m) => m.DevicePie),      { ssr: false });
const BrowserPie     = dynamic(() => import("./Charts").then((m) => m.BrowserPie),     { ssr: false });
const CountriesChart = dynamic(() => import("./Charts").then((m) => m.CountriesChart), { ssr: false });
const FunnelChart    = dynamic(() => import("./Charts").then((m) => m.FunnelChart),    { ssr: false });
const EventsBarChart = dynamic(() => import("./Charts").then((m) => m.EventsBarChart), { ssr: false });

const RANGES: { value: RangeOption; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d",  label: "7d"  },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

function fmtNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function fmtMs(n: number | null | undefined): string {
  if (n == null) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${n} ms`;
}

function fmtDelta(pct: number): { label: string; positive: boolean } {
  if (pct === 0) return { label: "Flat vs prev period", positive: true };
  const sign = pct > 0 ? "▲" : "▼";
  return { label: `${sign} ${Math.abs(pct)}% vs prev period`, positive: pct >= 0 };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ h = 6 }: { h?: number }) {
  return <div className="animate-pulse bg-[var(--surface)]" style={{ height: `${h * 4}px`, width: "100%" }} />;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, delta, sub, loading,
}: {
  label: string; value?: string; delta?: { label: string; positive: boolean }; sub?: string; loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5" style={{ background: "var(--background)" }}>
      <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">{label}</p>
      {loading ? (
        <Skeleton h={8} />
      ) : (
        <>
          <p className="font-display text-3xl font-light text-[var(--foreground)] mb-1">{value ?? "—"}</p>
          {delta && (
            <p className={`text-[10px] tracking-wide ${delta.positive ? "text-emerald-600" : "text-red-500"}`}>
              {delta.label}
            </p>
          )}
          {sub && <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );
}

// ── Vital card ────────────────────────────────────────────────────────────────
function vitalColor(metric: string, value: number | null): string {
  if (value === null) return "text-[var(--foreground-subtle)]";
  const thresholds: Record<string, [number, number]> = {
    LCP:  [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800],
  };
  const [good, bad] = thresholds[metric] ?? [0, 0];
  if (value <= good) return "text-emerald-600";
  if (value <= bad)  return "text-amber-500";
  return "text-red-500";
}

function vitalRatingLabel(metric: string, value: number | null): string {
  if (value === null) return "No data";
  const thresholds: Record<string, [number, number]> = {
    LCP:  [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800],
  };
  const [good, bad] = thresholds[metric] ?? [0, 0];
  if (value <= good) return "Good";
  if (value <= bad)  return "Needs improvement";
  return "Poor";
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`mb-10 ${className}`}>
      <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">{title}</h2>
      {children}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Analytics</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {loading ? "Loading…" : data ? `${fmtNumber(data.summary.pageViews)} page views · last ${range}` : "No data"}
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="rounded-xl border border-[var(--border)] p-5" style={{ background: "var(--background)" }}>
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Online Now</p>
          {loading ? (
            <Skeleton h={8} />
          ) : (
            <>
              <p className="font-display text-3xl font-light text-[var(--foreground)] mb-1 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                {fmtNumber(data?.summary.onlineNow)}
              </p>
              <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide mt-0.5">Active in last 5 min</p>
            </>
          )}
        </div>
        <StatCard
          label="Page Views"
          value={fmtNumber(data?.summary.pageViews)}
          sub={`${fmtNumber(data?.summary.uniqueVisitors)} unique sessions`}
          loading={loading}
        />
        <StatCard
          label="Unique Visitors"
          value={fmtNumber(data?.summary.uniqueVisitors)}
          delta={data ? fmtDelta(data.summary.visitorsDelta) : undefined}
          sub={`${fmtNumber(data?.summary.signedInVisitors)} signed in`}
          loading={loading}
        />
        <StatCard
          label="Avg Load Time"
          value={fmtMs(data?.summary.avgLoadMs)}
          sub={`p75 ${fmtMs(data?.summary.p75LoadMs)}`}
          loading={loading}
        />
        <StatCard
          label="Avg TTFB"
          value={fmtMs(data?.summary.avgTtfbMs)}
          sub="Time to First Byte"
          loading={loading}
        />
      </div>

      {/* Retention quick stats */}
      {data && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {[
            { label: "DAU", value: data.retention.dau, hint: "Active today" },
            { label: "WAU", value: data.retention.wau, hint: "Active this week" },
            { label: "MAU", value: data.retention.mau, hint: "Active this month" },
            { label: "Stickiness", value: `${data.retention.stickiness}%`, hint: "DAU / MAU" },
            { label: "New", value: data.newVsReturning.newSessions, hint: "First-seen sessions" },
            { label: "Returning", value: data.newVsReturning.returningSessions, hint: "Seen in prev period" },
          ].map((s) => (
            <div key={s.label} className="border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
              <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">{s.label}</p>
              <p className="font-display text-xl font-light text-[var(--foreground)]">{typeof s.value === "number" ? fmtNumber(s.value) : s.value}</p>
              <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{s.hint}</p>
            </div>
          ))}
        </div>
      )}

      {/* Business + AI usage */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
          <Section title="Revenue & Subscriptions" className="mb-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
                <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">MRR</p>
                <p className="font-display text-2xl font-light text-[var(--foreground)]">{fmtNumber(data.business.mrrUah)} ₴</p>
                <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{fmtNumber(data.business.activeSubscriptions)} active subs</p>
              </div>
              <div className="border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
                <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">At Risk</p>
                <p className="font-display text-2xl font-light text-[var(--foreground)]">{fmtNumber(data.business.pastDue + data.business.autoRenewOff)}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">
                  {data.business.pastDue} past due · {data.business.autoRenewOff} renew off · {data.business.canceled} canceled
                </p>
              </div>
              <div className="col-span-2 border border-[var(--border)]" style={{ background: "var(--background)" }}>
                {data.business.byPlan.length === 0 ? (
                  <div className="px-4 py-5 text-xs text-[var(--foreground-subtle)] text-center">No paid subscriptions yet</div>
                ) : (
                  data.business.byPlan.map((p) => {
                    const max = Math.max(...data.business.byPlan.map((x) => x.count));
                    const w = max > 0 ? Math.max(2, Math.round((p.count / max) * 100)) : 0;
                    return (
                      <div key={p.plan} className="relative border-b border-[var(--border)] last:border-0 px-4 py-2.5">
                        <div className="absolute inset-0 bg-[var(--fg-overlay-05)]" style={{ width: `${w}%` }} />
                        <div className="relative flex items-center justify-between">
                          <span className="text-xs text-[var(--foreground)] capitalize">{p.plan}</span>
                          <span className="text-xs text-[var(--foreground-muted)] tabular-nums">{p.count}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Section>
          <Section title="AI Usage" className="mb-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
                <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">Stylist Messages</p>
                <p className="font-display text-2xl font-light text-[var(--foreground)]">{fmtNumber(data.aiUsage.stylistMessages)}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">signed-in users, this period</p>
              </div>
              <div className="border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
                <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">Image Generations</p>
                <p className="font-display text-2xl font-light text-[var(--foreground)]">{fmtNumber(data.aiUsage.imageGenerations)}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">
                  {data.aiUsage.imageGenerationErrors > 0
                    ? `${fmtNumber(data.aiUsage.imageGenerationErrors)} failed`
                    : "no failures"}
                </p>
              </div>
              <div className="col-span-2 border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
                <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-2">Stylist messages per day</p>
                {data.aiUsage.stylistDaily.length === 0 ? (
                  <p className="text-xs text-[var(--foreground-subtle)] text-center py-3">No stylist usage yet</p>
                ) : (
                  <div className="flex items-end gap-[2px] h-16">
                    {data.aiUsage.stylistDaily.map((d) => {
                      const max = Math.max(...data.aiUsage.stylistDaily.map((x) => x.count));
                      const h = max > 0 ? Math.max(4, Math.round((d.count / max) * 100)) : 0;
                      return (
                        <div
                          key={d.date}
                          title={`${d.date}: ${d.count}`}
                          className="flex-1 bg-[var(--foreground)] opacity-70 hover:opacity-100 transition-opacity rounded-t-sm"
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Traffic chart */}
      <Section title="Traffic Over Time">
        <div className="rounded-xl border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
          {loading && <Skeleton h={65} />}
          {!loading && data && <TrafficChart data={data} />}
        </div>
      </Section>

      {/* Activity heatmap */}
      {data && (
        <Section title="Activity by Hour (UTC)">
          <div className="rounded-xl border border-[var(--border)] p-4 overflow-x-auto" style={{ background: "var(--background)" }}>
            <HourHeatmap heatmap={data.heatmap} />
          </div>
        </Section>
      )}

      {/* Web Vitals */}
      <Section title="Core Web Vitals — p75">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={24} />)
            : data?.vitals.map((v) => {
                const display =
                  v.metric === "CLS"
                    ? (v.p75?.toFixed(3) ?? "—")
                    : v.p75 != null ? fmtMs(Math.round(v.p75)) : "—";
                return (
                  <div key={v.metric} className="border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
                    <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-2">{v.metric}</p>
                    <p className={`font-display text-2xl font-light ${vitalColor(v.metric, v.p75)}`}>{display}</p>
                    <p className={`text-[10px] mt-1 ${vitalColor(v.metric, v.p75)}`}>{vitalRatingLabel(v.metric, v.p75)}</p>
                    <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{fmtNumber(v.samples)} samples</p>
                  </div>
                );
              })}
        </div>
      </Section>

      {/* Devices + Browsers + Countries */}
      <Section title="Audience">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--border)] p-6" style={{ background: "var(--background)", minHeight: 160 }}>
            {loading ? <Skeleton h={36} /> : <DevicePie items={data?.devices ?? []} />}
          </div>
          <div className="rounded-xl border border-[var(--border)] p-6" style={{ background: "var(--background)", minHeight: 160 }}>
            {loading ? <Skeleton h={36} /> : <BrowserPie items={data?.browsers ?? []} />}
          </div>
          <div className="rounded-xl border border-[var(--border)] p-6" style={{ background: "var(--background)", minHeight: 160 }}>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Top Countries</p>
            {loading ? <Skeleton h={24} /> : <CountriesChart items={data?.countries ?? []} />}
          </div>
        </div>
      </Section>

      {/* Funnel */}
      <Section title="Conversion Funnel (unique sessions)">
        <div className="border border-[var(--border)] p-6" style={{ background: "var(--background)" }}>
          {loading ? <Skeleton h={24} /> : data && <FunnelChart funnel={data.funnel} />}
        </div>
      </Section>

      {/* Top pages + products + outfits */}
      <Section title="Top Content">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <TopTable title="Pages"    rows={data?.topPages.map((p) => ({ key: p.path, label: p.path, count: p.views, sub: p.avgLoadMs ? `${p.avgLoadMs} ms avg` : "" })) ?? []} loading={loading} />
          <TopTable title="Products" rows={data?.topProducts.map((p) => ({ key: p.key, label: p.name ?? p.key, count: p.count, sub: p.brand ?? "", img: p.imageUrl, href: `/product/${p.key}` })) ?? []} loading={loading} />
          <TopTable title="Outfits"  rows={data?.topOutfits.map((o) => ({ key: o.key, label: o.name || o.key, count: o.count, sub: "", img: o.imageUrl, href: `/outfit/${o.key}` })) ?? []} loading={loading} />
        </div>
      </Section>

      {/* Sources */}
      <Section title="Traffic Sources & Search">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <RowList title="Referrers"    items={data?.referrers ?? []}   loading={loading} />
          <RowList title="UTM Sources"  items={data?.utmSources ?? []}  loading={loading} empty="No UTM-tagged traffic yet" />
          <RowList title="Search Terms" items={data?.searchTerms ?? []} loading={loading} empty="No on-site searches yet" />
        </div>
      </Section>

      {/* Events */}
      <Section title="Event Breakdown">
        <div className="border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
          {loading && <Skeleton h={24} />}
          {!loading && data?.events.length === 0 && (
            <div className="py-6 text-xs text-[var(--foreground-subtle)] text-center">
              No tracked events yet. Events fire when users view products, save outfits, or generate looks.
            </div>
          )}
          {!loading && data && data.events.length > 0 && <EventsBarChart events={data.events} />}
        </div>
      </Section>
    </div>
  );
}

// ── Shared list components ────────────────────────────────────────────────────

function RowList({
  title, items, loading, empty = "No data yet",
}: {
  title: string; items: { key: string; count: number }[]; loading: boolean; empty?: string;
}) {
  const max = items.length ? Math.max(...items.map((i) => i.count)) : 0;
  return (
    <div>
      <h3 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">{title}</h3>
      <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
        {loading && <div className="h-24 animate-pulse bg-[var(--surface)]" />}
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
  title, rows, loading,
}: {
  title: string;
  rows: { key: string; label: string; count: number; sub: string; img?: string | null; href?: string }[];
  loading: boolean;
}) {
  return (
    <div>
      <h3 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">{title}</h3>
      <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
        {loading && <div className="h-24 animate-pulse bg-[var(--surface)]" />}
        {!loading && rows.length === 0 && <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">No data yet</div>}
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] last:border-0 gap-3">
            {r.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.img} alt="" className="w-8 h-10 shrink-0 rounded object-cover bg-[var(--surface)]" loading="lazy" />
            )}
            <div className="min-w-0 flex-1">
              {r.href ? (
                <a href={r.href} target="_blank" rel="noreferrer" className="text-xs text-[var(--foreground)] hover:underline truncate block">{r.label}</a>
              ) : (
                <span className="text-xs text-[var(--foreground)] truncate block">{r.label}</span>
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

// ── Hour-of-week heatmap ──────────────────────────────────────────────────────
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function HourHeatmap({ heatmap }: { heatmap: number[][] }) {
  const max = Math.max(1, ...heatmap.flat());
  return (
    <div className="min-w-[640px]">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: "36px repeat(24, 1fr)" }}>
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className="text-center text-[8px] text-[var(--foreground-subtle)]">
            {h % 3 === 0 ? h : ""}
          </div>
        ))}
        {heatmap.map((row, d) => (
          <React.Fragment key={d}>
            <div className="text-[9px] text-[var(--foreground-subtle)] flex items-center">{WEEKDAYS[d]}</div>
            {row.map((count, h) => (
              <div
                key={h}
                title={`${WEEKDAYS[d]} ${String(h).padStart(2, "0")}:00 UTC — ${count.toLocaleString()} views`}
                className="aspect-square rounded-[3px]"
                style={{
                  background: count === 0
                    ? "var(--surface)"
                    : `color-mix(in srgb, var(--foreground) ${Math.max(12, Math.round((count / max) * 100))}%, var(--surface))`,
                }}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
