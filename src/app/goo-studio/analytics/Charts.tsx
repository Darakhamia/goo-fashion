"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFormat, useT, type Key, type T } from "../_i18n";
import type { AnalyticsResponse } from "./types";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatBucket(b: string, range: AnalyticsResponse["range"]): string {
  if (range === "24h") return b.slice(11, 16);
  return b.slice(5);
}

// A ramp from the foreground token toward the surface, so every slice stays
// visible in both themes.
const PALETTE = [
  "var(--foreground)",
  "color-mix(in srgb, var(--foreground) 72%, var(--background))",
  "color-mix(in srgb, var(--foreground) 52%, var(--background))",
  "color-mix(in srgb, var(--foreground) 36%, var(--background))",
  "color-mix(in srgb, var(--foreground) 24%, var(--background))",
  "color-mix(in srgb, var(--foreground) 14%, var(--background))",
];

const tooltipStyle = {
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    fontSize: 11,
    color: "var(--foreground)",
    borderRadius: 0,
  },
  labelStyle: {
    color: "var(--foreground-muted)",
    fontSize: 11,
  },
};

/** A data key the API sends for "no value" ("unknown", "Unknown"). */
function isUnknown(key: string | null | undefined): boolean {
  return !key || key.toLowerCase() === "unknown";
}

// ── Traffic over time ─────────────────────────────────────────────────────────

// The legend is in the page's panel caption (page.tsx): page views are the
// solid foreground line, sessions the dashed muted one.
export function TrafficChart({ data }: { data: AnalyticsResponse }) {
  const t = useT();
  const f = useFormat();
  const chartData = data.timeseries.map((p) => ({
    label: formatBucket(p.bucket, data.range),
    views: p.views,
    sessions: p.sessions,
  }));

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="goo-views" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="var(--foreground)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="goo-sessions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="var(--foreground)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--border)" }} allowDecimals={false} tickFormatter={(v) => f.number(Number(v))} />
          <Tooltip {...tooltipStyle} formatter={(value) => f.number(Number(value))} />
          <Area type="monotone" dataKey="views" name={t("analytics.traffic.views")} stroke="var(--foreground)" strokeWidth={1.5} fill="url(#goo-views)" />
          <Area type="monotone" dataKey="sessions" name={t("analytics.traffic.sessions")} stroke="var(--foreground-muted)" strokeWidth={1.2} strokeDasharray="4 4" fill="url(#goo-sessions)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Device / Browser pie charts ───────────────────────────────────────────────

interface PieItem { key: string; count: number }

/** Device types the API reports, in words; anything else shows as it came. */
const DEVICE_LABEL: Record<string, Key> = {
  mobile: "analytics.device.mobile",
  desktop: "analytics.device.desktop",
  tablet: "analytics.device.tablet",
};

function SimplePie({ items, title, label }: { items: PieItem[]; title: string; label: (key: string) => string }) {
  const t = useT();
  const f = useFormat();
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col h-full">
        <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-3">{title}</p>
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--foreground-subtle)]">{t("analytics.noData")}</div>
      </div>
    );
  }
  const data = items.map((item, i) => ({
    name: isUnknown(item.key) ? t("analytics.unknown") : label(item.key),
    value: item.count,
    pct: Math.round((item.count / total) * 100),
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="flex flex-col h-full">
      <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mb-3">{title}</p>
      <div className="flex items-center gap-4">
        <div style={{ width: 100, height: 100, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46} strokeWidth={0}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => { const n = Number(value); return [`${f.number(n)} (${Math.round((n / total) * 100)}%)`, ""]; }}
                {...tooltipStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5 min-w-0">
          {data.map((d) => (
            <li key={d.name} className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-[11px] text-[var(--foreground)] truncate">{d.name}</span>
              <span className="text-[11px] text-[var(--foreground-muted)] tabular-nums ml-auto pl-2">{d.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DevicePie({ items }: { items: PieItem[] }) {
  const t = useT();
  return (
    <SimplePie
      items={items}
      title={t("analytics.devices")}
      label={(key) => (DEVICE_LABEL[key] ? t(DEVICE_LABEL[key]) : key)}
    />
  );
}

export function BrowserPie({ items }: { items: PieItem[] }) {
  const t = useT();
  return <SimplePie items={items} title={t("analytics.browsers")} label={(key) => key} />;
}

// ── Countries horizontal bar chart ────────────────────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AO: "Angola", AR: "Argentina",
  AM: "Armenia", AU: "Australia", AT: "Austria", AZ: "Azerbaijan",
  BD: "Bangladesh", BY: "Belarus", BE: "Belgium", BR: "Brazil", BG: "Bulgaria",
  CA: "Canada", CL: "Chile", CN: "China", CO: "Colombia", HR: "Croatia",
  CZ: "Czech Republic", DK: "Denmark", EG: "Egypt", EE: "Estonia",
  FI: "Finland", FR: "France", GE: "Georgia", DE: "Germany", GH: "Ghana",
  GR: "Greece", HK: "Hong Kong", HU: "Hungary", IN: "India", ID: "Indonesia",
  IE: "Ireland", IL: "Israel", IT: "Italy", JP: "Japan", JO: "Jordan",
  KZ: "Kazakhstan", KE: "Kenya", KR: "South Korea", KW: "Kuwait",
  LV: "Latvia", LT: "Lithuania", MK: "North Macedonia", MY: "Malaysia",
  MX: "Mexico", MD: "Moldova", MA: "Morocco", NL: "Netherlands",
  NZ: "New Zealand", NG: "Nigeria", NO: "Norway", PK: "Pakistan",
  PE: "Peru", PH: "Philippines", PL: "Poland", PT: "Portugal",
  QA: "Qatar", RO: "Romania", RU: "Russia", SA: "Saudi Arabia",
  RS: "Serbia", SG: "Singapore", SK: "Slovakia", ZA: "South Africa",
  ES: "Spain", LK: "Sri Lanka", SE: "Sweden", CH: "Switzerland",
  TW: "Taiwan", TH: "Thailand", TN: "Tunisia", TR: "Turkey",
  UA: "Ukraine", AE: "UAE", GB: "United Kingdom", US: "United States",
  UZ: "Uzbekistan", VN: "Vietnam",
};

function countryFlag(code: string): string {
  try {
    return code.toUpperCase().replace(/[A-Z]/g, (c) =>
      String.fromCodePoint(127397 + c.charCodeAt(0))
    );
  } catch {
    return "";
  }
}

function countryLabel(code: string, t: T): string {
  if (isUnknown(code)) return t("analytics.unknown");
  const flag = countryFlag(code);
  const name = COUNTRY_NAMES[code.toUpperCase()] ?? code;
  return `${flag} ${name}`;
}

export function CountriesChart({ items }: { items: PieItem[] }) {
  const t = useT();
  const f = useFormat();
  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-[var(--foreground-subtle)]">
        {t("analytics.noCountries")}
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.count));
  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
        const barW = max > 0 ? Math.max(2, Math.round((item.count / max) * 100)) : 0;
        return (
          <div key={item.key ?? idx}>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-[var(--foreground)]">{countryLabel(item.key, t)}</span>
              <span className="text-[11px] text-[var(--foreground-muted)] tabular-nums">{f.number(item.count)} <span className="text-[var(--foreground-subtle)]">· {pct}%</span></span>
            </div>
            <div className="h-1.5 bg-[var(--background)] rounded-none">
              <div className="h-full bg-[var(--foreground)] transition-[width]" style={{ width: `${barW}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Funnel bar chart ──────────────────────────────────────────────────────────

/** The funnel steps the API names, in words; a step it adds later shows as it came. */
const FUNNEL_STEP: Record<string, Key> = {
  "Visited site": "analytics.funnel.visited",
  "Viewed product": "analytics.funnel.viewedProduct",
  "Saved outfit": "analytics.funnel.savedOutfit",
  "Generated look": "analytics.funnel.generatedLook",
};

export function FunnelChart({ funnel }: { funnel: AnalyticsResponse["funnel"] }) {
  const t = useT();
  const f = useFormat();
  if (!funnel.length) return null;

  const max = Math.max(...funnel.map((f) => f.sessions));

  return (
    <div className="space-y-3">
      {funnel.map((step, i) => {
        // A step whose event the site does not send yet has no number to show,
        // and no conversion to or from it.
        const prevStep = i > 0 ? funnel[i - 1] : null;
        const showConv = !!prevStep && prevStep.tracked && step.tracked;
        const prev = prevStep ? prevStep.sessions : step.sessions;
        const conv = prev > 0 ? Math.round((step.sessions / prev) * 100) : 0;
        const barW = step.tracked && max > 0 ? Math.max(2, Math.round((step.sessions / max) * 100)) : 0;
        return (
          <div key={step.step}>
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-[var(--foreground-subtle)] w-4">{i + 1}</span>
                <span className={`text-xs ${step.tracked ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"}`}>
                  {FUNNEL_STEP[step.step] ? t(FUNNEL_STEP[step.step]) : step.step}
                </span>
              </div>
              {step.tracked ? (
                <div className="text-[11px] text-[var(--foreground-muted)] tabular-nums">
                  {f.number(step.sessions)}
                  {showConv && (
                    <span className={`ml-2 ${conv >= 50 ? "text-[var(--ok)]" : conv >= 25 ? "text-[var(--warn)]" : "text-[var(--err)]"}`}>
                      · {conv}%
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-[var(--foreground-subtle)]">{t("analytics.notTracked")}</div>
              )}
            </div>
            <div className="h-2 bg-[var(--background)]">
              <div
                className="h-full transition-[width]"
                style={{
                  width: `${barW}%`,
                  // The opacity is set on the element, not put into an
                  // rgba(): the project has no --foreground-rgb token, so the
                  // 0,0,0 fallback always won here, painting black bars on the
                  // dark surface.
                  background: "var(--foreground)",
                  opacity: i === 0 ? 1 : 0.8 - i * 0.15,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Events bar chart ──────────────────────────────────────────────────────────

export function EventsBarChart({ events }: { events: AnalyticsResponse["events"] }) {
  const t = useT();
  const f = useFormat();
  if (!events.length) return null;
  const data = events.slice(0, 10).map((e) => ({ name: e.event.replace(/_/g, " "), count: e.count }));
  return (
    <div style={{ width: "100%", height: Math.max(160, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={{ stroke: "var(--border)" }} allowDecimals={false} tickFormatter={(v) => f.number(Number(v))} />
          <YAxis type="category" dataKey="name" width={120} stroke="var(--foreground-subtle)" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} formatter={(value) => f.number(Number(value))} />
          <Bar dataKey="count" name={t("analytics.events.count")} fill="var(--foreground)" radius={0} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
