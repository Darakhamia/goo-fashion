"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsResponse } from "./types";

function formatBucket(b: string, range: AnalyticsResponse["range"]): string {
  if (range === "24h") {
    const time = b.slice(11, 16);
    return time;
  }
  return b.slice(5);
}

export default function AnalyticsCharts({ data }: { data: AnalyticsResponse }) {
  const chartData = data.timeseries.map((t) => ({
    label: formatBucket(t.bucket, data.range),
    views: t.views,
    uniqueVisitors: t.uniqueVisitors,
  }));

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="goo-views" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="currentColor" stopOpacity={0.4} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="goo-unique" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="currentColor" stopOpacity={0.25} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis stroke="var(--foreground-subtle)" fontSize={10} tickLine={false} axisLine={{ stroke: "var(--border)" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              fontSize: 11,
              color: "var(--foreground)",
            }}
            labelStyle={{ color: "var(--foreground-muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em" }}
          />
          <Area
            type="monotone"
            dataKey="views"
            name="Views"
            stroke="var(--foreground)"
            strokeWidth={1.5}
            fill="url(#goo-views)"
            style={{ color: "var(--foreground)" }}
          />
          <Area
            type="monotone"
            dataKey="uniqueVisitors"
            name="Unique"
            stroke="var(--foreground-muted)"
            strokeWidth={1.2}
            strokeDasharray="4 4"
            fill="url(#goo-unique)"
            style={{ color: "var(--foreground-muted)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
