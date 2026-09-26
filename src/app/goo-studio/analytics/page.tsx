"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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

// Pill filter, the admin's one recipe (products page).
const pillCls = (active: boolean) =>
  `px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border rounded-full transition-colors ${
    active
      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
      : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
  }`;

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
    <div className="rounded-xl border border-[var(--border)] p-4 md:p-5 min-w-0" style={{ background: "var(--background)" }}>
      <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">{label}</p>
      {loading ? (
        <Skeleton h={8} />
      ) : (
        <>
          <p className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)] mb-1 break-words">{value ?? "—"}</p>
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
  // The request in flight. A new range or Refresh aborts it, so a slow answer
  // for the previous range cannot land on top of the new one.
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async (r: RangeOption) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?range=${r}`, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const body = (await res.json()) as AnalyticsResponse;
      if (controller.signal.aborted || body.range !== r) return;
      setData(body);
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => { load(range); }, [range, load]);
  useEffect(() => () => inFlight.current?.abort(), []);

  const days = data ? { "24h": 1, "7d": 7, "30d": 30, "90d": 90 }[data.range] : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Analytics</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {loading ? "Loading…" : data ? `${fmtNumber(data.summary.pageViews)} page views · last ${data.range}` : "No data"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              aria-pressed={range === r.value}
              className={pillCls(range === r.value)}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => load(range)}
            disabled={loading}
            className={`${pillCls(false)} disabled:opacity-50`}
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-400/30 bg-red-400/15 text-red-500 text-xs px-4 py-3">{error}</div>
      )}

      {data?.truncated && (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-500 text-xs px-4 py-3">
          Too many rows to read in one pass: only the newest rows of each table were counted, so the oldest part of
          this range is undercounted.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-[var(--border)] p-4 md:p-5 min-w-0" style={{ background: "var(--background)" }}>
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Online Now</p>
          {loading ? (
            <Skeleton h={8} />
          ) : (
            <>
              <p className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)] mb-1 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                {fmtNumber(data?.summary.onlineNow)}
              </p>
              <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide mt-0.5">Sessions active in last 5 min</p>
            </>
          )}
        </div>
        <StatCard
          label="Page Views"
          value={fmtNumber(data?.summary.pageViews)}
          loading={loading}
        />
        <StatCard
          label="Sessions"
          value={fmtNumber(data?.summary.sessions)}
          delta={data ? fmtDelta(data.summary.sessionsDelta) : undefined}
          sub={`${fmtNumber(data?.summary.signedInUsers)} signed-in users`}
          loading={loading}
        />
        <StatCard
          label="Avg Load Time"
          value={fmtMs(data?.summary.avgLoadMs)}
          sub={`p75 ${fmtMs(data?.summary.p75LoadMs)}`}
          loading={loading}
        />
      </div>

      {/* Sessions over fixed windows. A session ends after 30 min idle, so
          these count visits, not people. */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[
            { label: "Sessions · 24h", value: data.sessionWindows.last24h, hint: "Last 24 hours" },
            { label: "Sessions · 7d",  value: data.sessionWindows.last7d,  hint: "Last 7 days" },
            { label: "Sessions · 30d", value: data.sessionWindows.last30d, hint: "Last 30 days" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
              <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">{s.label}</p>
              <p className="font-display text-xl font-light text-[var(--foreground)]">{fmtNumber(s.value)}</p>
              <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{s.hint}</p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue lives on the Subscriptions page; one set of money figures. */}
      <Link
        href="/goo-studio/subscriptions"
        className="mb-10 flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] px-5 py-4 hover:border-[var(--border-strong)] transition-colors"
        style={{ background: "var(--background)" }}
      >
        <div>
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-1">Revenue & Subscriptions</p>
          <p className="text-xs text-[var(--foreground-subtle)]">MRR, plans, past-due and renewals are on the Subscriptions page.</p>
        </div>
        <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground)] whitespace-nowrap">Open →</span>
      </Link>

      {/* AI usage */}
      {data && (
        <Section title="AI Usage">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
              <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">Stylist Messages</p>
              <p className="font-display text-2xl font-light text-[var(--foreground)]">{fmtNumber(data.aiUsage.stylistMessages)}</p>
              {data.aiUsage.stylistError ? (
                <p className="text-[10px] text-red-500 mt-0.5">Could not load: {data.aiUsage.stylistError}</p>
              ) : (
                <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">
                  {data.range === "24h" ? "signed-in users, today (UTC)" : `signed-in users, last ${days} days`}
                </p>
              )}
            </div>
            <div className="rounded-xl border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
              <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-1">Image Generations</p>
              {data.aiUsage.imageGenerationsTracked ? (
                <>
                  <p className="font-display text-2xl font-light text-[var(--foreground)]">{fmtNumber(data.aiUsage.imageGenerations)}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">
                    {data.aiUsage.imageGenerationErrors > 0
                      ? `${fmtNumber(data.aiUsage.imageGenerationErrors)} failed`
                      : "no failures"}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-2xl font-light text-[var(--foreground-subtle)]">—</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">not tracked yet</p>
                </>
              )}
            </div>
            <div className="col-span-2 rounded-xl border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
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
        <Section title="Activity by Hour (Kyiv time)">
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
                  <div key={v.metric} className="rounded-xl border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
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
      <Section title="Conversion Funnel (sessions)">
        <div className="rounded-xl border border-[var(--border)] p-6" style={{ background: "var(--background)" }}>
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
        <div className="rounded-xl border border-[var(--border)] p-4" style={{ background: "var(--background)" }}>
          {loading && <Skeleton h={24} />}
          {!loading && data?.events.length === 0 && (
            <div className="py-6 text-xs text-[var(--foreground-subtle)] text-center">
              No tracked events yet. Events fire when users view products or outfits and search the catalog.
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
      <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: "var(--background)" }}>
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
      <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: "var(--background)" }}>
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
                title={`${WEEKDAYS[d]} ${String(h).padStart(2, "0")}:00 Kyiv — ${count.toLocaleString()} views`}
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
