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
import type { AnalyticsResponse } from "./types";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatBucket(b: string, range: AnalyticsResponse["range"]): string {
  if (range === "24h") return b.slice(11, 16);
  return b.slice(5);
}

const PALETTE = [
  "var(--foreground)",
  "#6b7280",
  "#9ca3af",
  "#d1d5db",
  "#374151",
  "#1f2937",
];

const tooltipStyle = {
  contentStyle: {
    background: "var(--background)",
    border: "1px solid var(--border)",
    fontSize: 11,
    color: "var(--foreground)",
    borderRadius: 0,
  },
  labelStyle: {
    color: "var(--foreground-muted)",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
  },
};

// ── Traffic over time ─────────────────────────────────────────────────────────

export function TrafficChart({ data }: { data: AnalyticsResponse }) {
  const chartData = data.timeseries.map((t) => ({
    label: formatBucket(t.bucket, data.range),
    views: t.views,
    uniqueVisitors: t.uniqueVisitors,
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
            <linearGradient id="goo-unique" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="var(--foreground)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={{ stroke: "var(--border)" }} allowDecimals={false} />
          <Tooltip {...tooltipStyle} />
          <Area type="monotone" dataKey="views" name="Views" stroke="var(--foreground)" strokeWidth={1.5} fill="url(#goo-views)" />
          <Area type="monotone" dataKey="uniqueVisitors" name="Unique" stroke="var(--foreground-muted)" strokeWidth={1.2} strokeDasharray="4 4" fill="url(#goo-unique)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Device / Browser pie charts ───────────────────────────────────────────────

interface PieItem { key: string; count: number }

function SimplePie({ items, title }: { items: PieItem[]; title: string }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col h-full">
        <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">{title}</p>
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--foreground-subtle)]">No data</div>
      </div>
    );
  }
  const data = items.map((item, i) => ({
    name: item.key || "Unknown",
    value: item.count,
    pct: Math.round((item.count / total) * 100),
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="flex flex-col h-full">
      <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">{title}</p>
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
                formatter={(value) => { const n = Number(value); return [`${n} (${Math.round((n / total) * 100)}%)`, ""]; }}
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
              <span className="text-[10px] text-[var(--foreground-muted)] tabular-nums ml-auto pl-2">{d.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DevicePie({ items }: { items: PieItem[] }) {
  return <SimplePie items={items} title="Devices" />;
}

export function BrowserPie({ items }: { items: PieItem[] }) {
  return <SimplePie items={items} title="Browsers" />;
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

function countryLabel(code: string): string {
  if (!code || code === "Unknown") return "Unknown";
  const flag = countryFlag(code);
  const name = COUNTRY_NAMES[code.toUpperCase()] ?? code;
  return `${flag} ${name}`;
}

export function CountriesChart({ items }: { items: PieItem[] }) {
  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-[var(--foreground-subtle)]">
        No country data yet
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
              <span className="text-xs text-[var(--foreground)]">{countryLabel(item.key)}</span>
              <span className="text-[11px] text-[var(--foreground-muted)] tabular-nums">{item.count.toLocaleString()} <span className="text-[var(--foreground-subtle)]">· {pct}%</span></span>
            </div>
            <div className="h-1.5 bg-[var(--surface)] rounded-none">
              <div className="h-full bg-[var(--foreground)] transition-all" style={{ width: `${barW}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Funnel bar chart ──────────────────────────────────────────────────────────

export function FunnelChart({ funnel }: { funnel: AnalyticsResponse["funnel"] }) {
  if (!funnel.length) return null;

  const max = Math.max(...funnel.map((f) => f.sessions));

  return (
    <div className="space-y-3">
      {funnel.map((step, i) => {
        const prev = i > 0 ? funnel[i - 1].sessions : step.sessions;
        const conv = prev > 0 ? Math.round((step.sessions / prev) * 100) : 0;
        const barW = max > 0 ? Math.max(2, Math.round((step.sessions / max) * 100)) : 0;
        return (
          <div key={step.step}>
            <div className="flex items-baseline justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[var(--foreground-subtle)] w-4">{i + 1}</span>
                <span className="text-xs text-[var(--foreground)]">{step.step}</span>
              </div>
              <div className="text-[11px] text-[var(--foreground-muted)] tabular-nums">
                {step.sessions.toLocaleString()}
                {i > 0 && (
                  <span className={`ml-2 ${conv >= 50 ? "text-emerald-600" : conv >= 25 ? "text-amber-500" : "text-red-500"}`}>
                    · {conv}%
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 bg-[var(--surface)]">
              <div
                className="h-full transition-all"
                style={{
                  width: `${barW}%`,
                  background: i === 0 ? "var(--foreground)" : `rgba(var(--foreground-rgb, 0,0,0), ${0.8 - i * 0.15})`,
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
  if (!events.length) return null;
  const data = events.slice(0, 10).map((e) => ({ name: e.event.replace(/_/g, " "), count: e.count }));
  return (
    <div style={{ width: "100%", height: Math.max(160, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={{ stroke: "var(--border)" }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={120} stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Bar dataKey="count" name="Events" fill="var(--foreground)" radius={0} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Default export (backward compat) ─────────────────────────────────────────

export default function AnalyticsCharts({ data }: { data: AnalyticsResponse }) {
  return <TrafficChart data={data} />;
}
