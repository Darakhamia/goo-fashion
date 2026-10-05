"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { KpiStrip, type Kpi } from "@/components/admin/KpiStrip";
import { FilterChips } from "@/components/admin/FilterBar";
import type { AnalyticsResponse, RangeOption } from "./types";
import { BANNER, PANEL } from "../_ui/recipes";
import { LOCALE, useFormat, useLang, useT, type Key, type Lang, type T } from "../_i18n";

/*
 * Analytics (docs/ADMIN_DESIGN.md §6 and 5.13, mockup "Analytics", GS4-12):
 * the head with the period and Refresh, the key numbers, traffic beside the
 * stylist's daily use, then the breakdowns. Everything comes from
 * GET /api/admin/analytics?range=…; the charts are in Charts.tsx.
 */

const TrafficChart   = dynamic(() => import("./Charts").then((m) => m.TrafficChart),   { ssr: false });
const DevicePie      = dynamic(() => import("./Charts").then((m) => m.DevicePie),      { ssr: false });
const BrowserPie     = dynamic(() => import("./Charts").then((m) => m.BrowserPie),     { ssr: false });
const CountriesChart = dynamic(() => import("./Charts").then((m) => m.CountriesChart), { ssr: false });
const FunnelChart    = dynamic(() => import("./Charts").then((m) => m.FunnelChart),    { ssr: false });
const EventsBarChart = dynamic(() => import("./Charts").then((m) => m.EventsBarChart), { ssr: false });

const RANGES: RangeOption[] = ["24h", "7d", "30d", "90d"];

/** The period chip. */
const RANGE_LABEL: Record<RangeOption, Key> = {
  "24h": "analytics.range.24h",
  "7d": "analytics.range.7d",
  "30d": "analytics.range.30d",
  "90d": "analytics.range.90d",
};

/** The period in the subtitle: "last 7 days". */
const RANGE_PERIOD: Record<RangeOption, Key> = {
  "24h": "analytics.period.24h",
  "7d": "analytics.period.7d",
  "30d": "analytics.period.30d",
  "90d": "analytics.period.90d",
};

/** The server's own message, or ours when it gave none. Kept as a key so the text follows the language switch. */
type Failure = { key: Key } | { text: string };

/** "840 ms", "1.84 s" ("1,84 с" in Russian). */
function fmtMs(n: number | null | undefined, t: T, lang: Lang): string {
  if (n == null) return "—";
  return n >= 1000
    ? t("analytics.seconds", { value: (n / 1000).toLocaleString(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
    : t("analytics.ms", { value: n });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ h = 6 }: { h?: number }) {
  return <div className="animate-pulse bg-[var(--background)]" style={{ height: `${h * 4}px`, width: "100%" }} />;
}

// ── Web vitals ────────────────────────────────────────────────────────────────
const VITAL_THRESHOLDS: Record<string, [number, number]> = {
  LCP:  [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800],
};

type Rating = "good" | "needsWork" | "poor" | "none";

function vitalRating(metric: string, value: number | null): Rating {
  if (value === null) return "none";
  const [good, bad] = VITAL_THRESHOLDS[metric] ?? [0, 0];
  if (value <= good) return "good";
  if (value <= bad)  return "needsWork";
  return "poor";
}

const RATING_COLOR: Record<Rating, string> = {
  good: "text-[var(--ok)]",
  needsWork: "text-[var(--warn)]",
  poor: "text-[var(--err)]",
  none: "text-[var(--foreground-subtle)]",
};

const RATING_LABEL: Record<Rating, Key> = {
  good: "analytics.vital.good",
  needsWork: "analytics.vital.needsWork",
  poor: "analytics.vital.poor",
  none: "analytics.noData",
};

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-4">{title}</h2>
      {children}
    </section>
  );
}

/** A chart panel with its title, one muted line and a legend (mockup "Analytics"). */
function ChartPanel({
  title,
  hint,
  legend,
  className = "",
  children,
}: {
  title: string;
  hint?: ReactNode;
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 ${PANEL} p-4 md:p-5 ${className}`}>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-2 mb-4">
        <div className="flex-[1_1_220px] min-w-0">
          <h2 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">{title}</h2>
          {hint && <p className="text-[12px] leading-[18px] text-[var(--foreground-muted)]">{hint}</p>}
        </div>
        {legend}
      </div>
      {children}
    </section>
  );
}

/** One series in a legend: the line as the chart draws it, and its name. */
function LegendLine({ label, dashed = false }: { label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] leading-[18px] text-[var(--foreground-muted)]">
      <svg
        width="20"
        height="8"
        viewBox="0 0 20 8"
        aria-hidden="true"
        className={dashed ? "text-[var(--foreground-muted)]" : "text-[var(--foreground)]"}
      >
        <line
          x1="1"
          y1="4"
          x2="19"
          y2="4"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={dashed ? "4 4" : undefined}
          strokeLinecap={dashed ? undefined : "round"}
        />
      </svg>
      {label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminAnalyticsPage() {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const [range, setRange] = useState<RangeOption>("7d");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Failure | null>(null);
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
      setError(e instanceof Error && e.message ? { text: e.message } : { key: "analytics.loadFailed" });
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
  const ms = (n: number | null | undefined) => fmtMs(n, t, lang);
  const skeleton = <Skeleton h={8} />;
  const s = data?.summary;

  const kpis: Kpi[] = [
    {
      key: "online",
      label: t("analytics.kpi.online"),
      value: loading ? skeleton : (
        <span className="inline-flex items-center gap-2.5 align-top">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="animate-ping motion-reduce:hidden absolute inline-flex h-full w-full rounded-full bg-[var(--ok)] opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--ok)]" />
          </span>
          {f.number(s?.onlineNow)}
        </span>
      ),
      note: loading ? undefined : t("analytics.kpi.onlineNote"),
    },
    {
      key: "pageViews",
      label: t("analytics.kpi.pageViews"),
      value: loading ? skeleton : f.number(s?.pageViews),
    },
    {
      key: "sessions",
      label: t("analytics.kpi.sessions"),
      value: loading ? skeleton : f.number(s?.sessions),
      // The change as text, not a colored arrow (ADMIN_DESIGN 5.6).
      note:
        loading || !s
          ? undefined
          : [
              s.sessionsDelta === 0
                ? t("analytics.kpi.flat")
                : t("analytics.kpi.delta", { pct: `${s.sessionsDelta > 0 ? "+" : "−"}${f.number(Math.abs(s.sessionsDelta))}%` }),
              t("analytics.kpi.signedIn", { count: s.signedInUsers }),
            ].join(" · "),
      noteTitle: t("analytics.kpi.deltaHint"),
    },
    {
      key: "load",
      label: t("analytics.kpi.avgLoad"),
      value: loading ? skeleton : ms(s?.avgLoadMs),
      note: loading || !s ? undefined : t("analytics.kpi.p75", { value: ms(s.p75LoadMs) }),
    },
  ];

  // Sessions over fixed windows, independent of the range: a session ends
  // after 30 min idle, so these count visits, not people. Then the AI's use.
  const ai = data?.aiUsage;
  const more: Kpi[] = data && ai
    ? [
        { key: "s24h", label: t("analytics.window.24h"), value: f.number(data.sessionWindows.last24h), note: t("analytics.window.24h.note") },
        { key: "s7d", label: t("analytics.window.7d"), value: f.number(data.sessionWindows.last7d), note: t("analytics.window.7d.note") },
        { key: "s30d", label: t("analytics.window.30d"), value: f.number(data.sessionWindows.last30d), note: t("analytics.window.30d.note") },
        {
          key: "stylist",
          label: t("analytics.ai.stylist"),
          value: f.number(ai.stylistMessages),
          note: ai.stylistError ? (
            <span className="text-[var(--err)]">{t("analytics.ai.stylistFailed", { error: ai.stylistError })}</span>
          ) : data.range === "24h" ? (
            t("analytics.ai.today")
          ) : (
            t("analytics.ai.lastDays", { count: days })
          ),
        },
        {
          key: "images",
          label: t("analytics.ai.images"),
          value: ai.imageGenerationsTracked ? f.number(ai.imageGenerations) : <span className="text-[var(--foreground-subtle)]">—</span>,
          note: !ai.imageGenerationsTracked
            ? t("analytics.notTracked")
            : ai.imageGenerationErrors > 0
              ? t("analytics.ai.imagesFailed", { count: ai.imageGenerationErrors })
              : t("analytics.ai.noFailures"),
        },
      ]
    : [];

  const stylistDaily = data?.aiUsage.stylistDaily ?? [];
  const stylistMax = Math.max(0, ...stylistDaily.map((x) => x.count));
  const stylistByDate = new Map(stylistDaily.map((x) => [x.date, x.count]));
  // The period's days, from the traffic buckets. Over 24 hours the stylist is
  // counted for today only, so today is the one slot.
  const lastBucket = data?.timeseries.at(-1)?.bucket;
  const stylistDays = !data
    ? []
    : data.range === "24h"
      ? lastBucket ? [lastBucket.slice(0, 10)] : []
      : data.timeseries.map((b) => b.bucket.slice(0, 10));

  return (
    <div>
      <PageHeader
        title={t("nav.analytics")}
        subtitle={
          loading
            ? t("common.loading")
            : data
              ? t("analytics.subtitle", { count: data.summary.pageViews, period: t(RANGE_PERIOD[data.range]) })
              : t("analytics.noData")
        }
        actions={[
          {
            key: "refresh",
            label: loading ? t("analytics.refreshing") : t("analytics.refresh"),
            onClick: () => load(range),
            disabled: loading,
          },
        ]}
      />

      <div className="flex flex-col gap-6 md:gap-8">
        <FilterChips
          label={t("analytics.period")}
          value={range}
          options={RANGES.map((r) => ({ value: r, label: t(RANGE_LABEL[r]) }))}
          onChange={(v) => setRange(v as RangeOption)}
        />

        {(error || data?.truncated) && (
          <div className="flex flex-col gap-3">
            {error && (
              <div role="alert" className={BANNER.err}>
                {"key" in error ? t(error.key) : error.text}
              </div>
            )}
            {data?.truncated && (
              <div className={BANNER.warn}>
                {t("analytics.truncated")}
              </div>
            )}
          </div>
        )}

        <KpiStrip label={t("analytics.kpis")} items={kpis} />

        {/* Traffic beside the stylist's daily use (mockup "Analytics"). */}
        <div className="flex flex-wrap gap-6">
          <ChartPanel
            className="flex-[2_1_560px]"
            title={t("analytics.traffic")}
            hint={data?.range === "24h" ? t("analytics.traffic.hint.hourly") : t("analytics.traffic.hint.daily")}
            legend={
              <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
                <LegendLine label={t("analytics.traffic.views")} />
                <LegendLine label={t("analytics.traffic.sessions")} dashed />
              </span>
            }
          >
            {loading && <Skeleton h={65} />}
            {!loading && data && <TrafficChart data={data} />}
          </ChartPanel>

          <ChartPanel className="flex-[1_1_300px]" title={t("analytics.ai.perDay")} hint={t("analytics.ai.perDayHint")}>
            {loading && <Skeleton h={65} />}
            {!loading && data && (stylistDaily.length === 0 ? (
              <p className="text-xs text-[var(--foreground-subtle)] text-center py-3">{t("analytics.ai.noUsage")}</p>
            ) : (
              // One slot per day of the period, the traffic chart's days: only days with messages
              // come back, and two bars alone in the panel read as the whole week. From md the
              // bars are as tall as the traffic chart beside them.
              <>
                <div className="flex items-end gap-px h-40 md:h-[260px] border-b border-[var(--border)]">
                  {stylistDays.map((date) => {
                    const count = stylistByDate.get(date) ?? 0;
                    const h = count > 0 && stylistMax > 0 ? Math.max(4, Math.round((count / stylistMax) * 100)) : 0;
                    return (
                      <div key={date} title={`${date}: ${f.number(count)}`} className="flex-1 h-full flex items-end justify-center">
                        <div
                          className="w-full max-w-6 bg-[var(--foreground)] opacity-70 hover:opacity-100 transition-opacity rounded-t-sm"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1.5 text-[11px] tabular-nums text-[var(--foreground-subtle)]">
                  <span>{stylistDays[0]?.slice(5)}</span>
                  {stylistDays.length > 1 && <span>{stylistDays[stylistDays.length - 1].slice(5)}</span>}
                </div>
              </>
            ))}
          </ChartPanel>
        </div>

        {more.length > 0 && <KpiStrip label={t("analytics.more")} items={more} />}

        {/* Revenue lives on the Subscriptions page; one set of money figures. */}
        <Link
          href="/goo-studio/subscriptions"
          className={`flex items-center justify-between gap-4 ${PANEL} px-5 py-4 hover:border-[var(--border-strong)] transition-colors`}
        >
          <div>
            <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-1">{t("analytics.revenue.title")}</p>
            <p className="text-xs text-[var(--foreground-subtle)]">{t("analytics.revenue.text")}</p>
          </div>
          <span className="text-[13px] font-medium text-[var(--foreground)] whitespace-nowrap">{t("analytics.revenue.open")}</span>
        </Link>

        {/* Activity heatmap */}
        {data && (
          <Section title={t("analytics.heatmap")}>
            <div className={`${PANEL} p-4`}>
              <HourHeatmap heatmap={data.heatmap} />
            </div>
          </Section>
        )}

        {/* Web Vitals */}
        <Section title={t("analytics.vitals")}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={24} />)
              : data?.vitals.map((v) => {
                  const display =
                    v.metric === "CLS"
                      ? (v.p75 != null ? v.p75.toLocaleString(LOCALE[lang], { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "—")
                      : v.p75 != null ? ms(Math.round(v.p75)) : "—";
                  const rating = vitalRating(v.metric, v.p75);
                  return (
                    <div key={v.metric} className={`${PANEL} p-4`}>
                      <p className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] mb-2">{v.metric}</p>
                      <p className={`font-display text-2xl font-light ${RATING_COLOR[rating]}`}>{display}</p>
                      <p className={`text-[12px] mt-1 ${RATING_COLOR[rating]}`}>{t(RATING_LABEL[rating])}</p>
                      <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5">{t("analytics.vital.samples", { count: v.samples })}</p>
                    </div>
                  );
                })}
          </div>
        </Section>

        {/* Devices + Browsers + Countries */}
        <Section title={t("analytics.audience")}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${PANEL} p-6 min-h-40`}>
              {loading ? <Skeleton h={36} /> : <DevicePie items={data?.devices ?? []} />}
            </div>
            <div className={`${PANEL} p-6 min-h-40`}>
              {loading ? <Skeleton h={36} /> : <BrowserPie items={data?.browsers ?? []} />}
            </div>
            <div className={`${PANEL} p-6 min-h-40`}>
              <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-3">{t("analytics.countries")}</p>
              {loading ? <Skeleton h={24} /> : <CountriesChart items={data?.countries ?? []} />}
            </div>
          </div>
        </Section>

        {/* Funnel */}
        <Section title={t("analytics.funnel")}>
          <div className={`${PANEL} p-6`}>
            {loading ? <Skeleton h={24} /> : data && <FunnelChart funnel={data.funnel} />}
          </div>
        </Section>

        {/* Top pages + products + outfits */}
        <Section title={t("analytics.top")}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TopTable
              title={t("analytics.top.pages")}
              rows={data?.topPages.map((p) => ({ key: p.path, label: p.path, count: p.views, sub: p.avgLoadMs ? t("analytics.top.avgLoad", { ms: p.avgLoadMs }) : "" })) ?? []}
              loading={loading}
            />
            <TopTable
              title={t("analytics.top.products")}
              rows={data?.topProducts.map((p) => ({ key: p.key, label: p.name ?? p.key, count: p.count, sub: p.brand ?? "", img: p.imageUrl, href: `/product/${p.key}` })) ?? []}
              loading={loading}
            />
            <TopTable
              title={t("analytics.top.outfits")}
              rows={data?.topOutfits.map((o) => ({ key: o.key, label: o.name || o.key, count: o.count, sub: "", img: o.imageUrl, href: `/outfit/${o.key}` })) ?? []}
              loading={loading}
            />
          </div>
        </Section>

        {/* Sources */}
        <Section title={t("analytics.sources")}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <RowList
              title={t("analytics.referrers")}
              items={data?.referrers ?? []}
              loading={loading}
              label={(key) => (key === "direct" ? t("analytics.referrer.direct") : key)}
            />
            <RowList title={t("analytics.utm")} items={data?.utmSources ?? []} loading={loading} empty={t("analytics.utm.empty")} />
            <RowList title={t("analytics.searchTerms")} items={data?.searchTerms ?? []} loading={loading} empty={t("analytics.search.empty")} />
          </div>
        </Section>

        {/* Events */}
        <Section title={t("analytics.events")}>
          <div className={`${PANEL} p-4`}>
            {loading && <Skeleton h={24} />}
            {!loading && data?.events.length === 0 && (
              <div className="py-6 text-xs text-[var(--foreground-subtle)] text-center">{t("analytics.events.empty")}</div>
            )}
            {!loading && data && data.events.length > 0 && <EventsBarChart events={data.events} />}
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Shared list components ────────────────────────────────────────────────────

function RowList({
  title, items, loading, empty, label = (key) => key,
}: {
  title: string;
  items: { key: string; count: number }[];
  loading: boolean;
  empty?: string;
  /** A data key in words, when it is a marker rather than a name ("direct"). */
  label?: (key: string) => string;
}) {
  const t = useT();
  const f = useFormat();
  const max = items.length ? Math.max(...items.map((i) => i.count)) : 0;
  return (
    <div>
      <h3 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-3">{title}</h3>
      <div className={`${PANEL} overflow-hidden`}>
        {loading && <div className="h-24 animate-pulse bg-[var(--background)]" />}
        {!loading && items.length === 0 && (
          <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">{empty ?? t("analytics.noDataYet")}</div>
        )}
        {items.map((item) => {
          const w = max > 0 ? Math.max(2, Math.round((item.count / max) * 100)) : 0;
          return (
            <div key={item.key} className="relative border-b border-[var(--border)] last:border-0 px-4 py-2.5">
              <div className="absolute inset-0 bg-[var(--fg-overlay-05)]" style={{ width: `${w}%` }} />
              <div className="relative flex items-center justify-between">
                <span className="text-xs text-[var(--foreground)] truncate max-w-[60%]">{item.key ? label(item.key) : "—"}</span>
                <span className="text-xs text-[var(--foreground-muted)] tabular-nums">{f.number(item.count)}</span>
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
  const t = useT();
  const f = useFormat();
  return (
    <div>
      <h3 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-3">{title}</h3>
      <div className={`${PANEL} overflow-hidden`}>
        {loading && <div className="h-24 animate-pulse bg-[var(--background)]" />}
        {!loading && rows.length === 0 && (
          <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">{t("analytics.noDataYet")}</div>
        )}
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] last:border-0 gap-3">
            {r.img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.img} alt="" className="w-8 h-10 shrink-0 rounded object-cover bg-[var(--background)]" loading="lazy" />
            )}
            <div className="min-w-0 flex-1">
              {r.href ? (
                <a href={r.href} target="_blank" rel="noreferrer" className="text-xs text-[var(--foreground)] hover:underline truncate block">{r.label}</a>
              ) : (
                <span className="text-xs text-[var(--foreground)] truncate block">{r.label}</span>
              )}
              {r.sub && <p className="text-[12px] text-[var(--foreground-subtle)]">{r.sub}</p>}
            </div>
            <span className="text-xs text-[var(--foreground-muted)] tabular-nums">{f.number(r.count)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hour-of-week heatmap ──────────────────────────────────────────────────────
const WEEKDAYS: Key[] = [
  "analytics.day.mon",
  "analytics.day.tue",
  "analytics.day.wed",
  "analytics.day.thu",
  "analytics.day.fri",
  "analytics.day.sat",
  "analytics.day.sun",
];

// The 24 hours fit the width of a phone too (GS4-11): smaller squares and an
// hour label every six hours instead of three.
function HourHeatmap({ heatmap }: { heatmap: number[][] }) {
  const t = useT();
  const max = Math.max(1, ...heatmap.flat());
  return (
    <div>
      <div className="grid gap-[2px] md:gap-[3px]" style={{ gridTemplateColumns: "32px repeat(24, minmax(0, 1fr))" }}>
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={h} className={`text-center text-[11px] text-[var(--foreground-subtle)] ${h % 6 ? "max-md:invisible" : ""}`}>
            {h % 3 === 0 ? h : ""}
          </div>
        ))}
        {heatmap.map((row, d) => {
          const day = t(WEEKDAYS[d]);
          return (
            <React.Fragment key={d}>
              <div className="text-[11px] text-[var(--foreground-subtle)] flex items-center">{day}</div>
              {row.map((count, h) => (
                <div
                  key={h}
                  title={t("analytics.heatmap.cell", { day, hour: String(h).padStart(2, "0"), count })}
                  className="aspect-square rounded-[3px]"
                  style={{
                    background: count === 0
                      ? "var(--background)"
                      : `color-mix(in srgb, var(--foreground) ${Math.max(12, Math.round((count / max) * 100))}%, var(--background))`,
                  }}
                />
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
