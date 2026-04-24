"use client";

import { useEffect, useState, useMemo } from "react";
import { useCurrency } from "@/lib/context/currency-context";
import type { PricePoint } from "@/lib/types";

interface Props {
  productId: string;
}

const W = 600;
const H = 160;
const PAD = { top: 16, right: 12, bottom: 32, left: 52 };

export default function PriceHistoryChart({ productId }: Props) {
  const { formatPrice } = useCurrency();
  const [data, setData] = useState<PricePoint[] | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/products/${productId}/price-history`)
      .then((r) => r.json())
      .then((d: PricePoint[]) => setData(d))
      .catch(() => setData([]));
  }, [productId]);

  const { points, minP, maxP, minD, maxD } = useMemo(() => {
    if (!data || data.length < 2) return { points: [], minP: 0, maxP: 0, minD: "", maxD: "" };
    const prices = data.map((d) => d.price);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const dates = data.map((d) => d.date);
    return { points: data, minP, maxP, minD: dates[0], maxD: dates[dates.length - 1] };
  }, [data]);

  const toX = (date: string) => {
    if (!minD || !maxD || minD === maxD) return PAD.left;
    const t = new Date(date).getTime();
    const t0 = new Date(minD).getTime();
    const t1 = new Date(maxD).getTime();
    return PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  };

  const toY = (price: number) => {
    const range = maxP - minP || 1;
    const pad = range * 0.15;
    return PAD.top + (1 - (price - (minP - pad)) / (range + pad * 2)) * (H - PAD.top - PAD.bottom);
  };

  if (!data) {
    return (
      <div className="mt-16 border-t border-[var(--border)] pt-10">
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">Price history</p>
        <div className="h-[160px] bg-[var(--surface)] animate-pulse" />
      </div>
    );
  }

  if (data.length < 2) return null;

  const polyline = points.map((p) => `${toX(p.date).toFixed(1)},${toY(p.price).toFixed(1)}`).join(" ");
  const fillPath = `M${toX(points[0].date).toFixed(1)},${toY(points[0].price).toFixed(1)} ` +
    points.slice(1).map((p) => `L${toX(p.date).toFixed(1)},${toY(p.price).toFixed(1)}`).join(" ") +
    ` L${toX(points[points.length - 1].date).toFixed(1)},${(H - PAD.bottom).toFixed(1)} L${toX(points[0].date).toFixed(1)},${(H - PAD.bottom).toFixed(1)} Z`;

  const hovPt = hovered !== null ? points[hovered] : null;
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const priceDiff = lastPt.price - firstPt.price;
  const pricePct = firstPt.price > 0 ? ((priceDiff / firstPt.price) * 100).toFixed(1) : "0";
  const isDown = priceDiff < 0;

  // Y-axis ticks (3 levels)
  const priceRange = maxP - minP || 1;
  const pad = priceRange * 0.15;
  const yTicks = [minP - pad, minP + (priceRange + pad * 2) / 2, maxP + pad].map((v) => Math.round(v));

  // X-axis labels: first, mid, last
  const xLabels = [
    { date: points[0].date, x: toX(points[0].date) },
    { date: points[Math.floor(points.length / 2)].date, x: toX(points[Math.floor(points.length / 2)].date) },
    { date: points[points.length - 1].date, x: toX(points[points.length - 1].date) },
  ];

  const fmt = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en", { month: "short", day: "numeric" });
  };

  return (
    <div className="mt-16 border-t border-[var(--border)] pt-10">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
          Price history — 30 days
        </p>
        <span className={`text-xs font-medium ${isDown ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
          {isDown ? "▼" : "▲"} {Math.abs(Number(pricePct))}% {isDown ? "cheaper" : "more expensive"} vs a month ago
        </span>
      </div>

      <div className="relative select-none">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: "160px" }}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--foreground)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--foreground)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick) => (
            <line
              key={tick}
              x1={PAD.left} y1={toY(tick).toFixed(1)}
              x2={W - PAD.right} y2={toY(tick).toFixed(1)}
              stroke="var(--border)" strokeWidth="1"
            />
          ))}

          {/* Fill area */}
          <path d={fillPath} fill="url(#chartFill)" />

          {/* Line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Hover zones (invisible wide strips for each data point) */}
          {points.map((p, i) => {
            const x = toX(p.date);
            const nextX = i < points.length - 1 ? toX(points[i + 1].date) : x;
            const prevX = i > 0 ? toX(points[i - 1].date) : x;
            const zoneW = Math.max(8, (nextX - prevX) / 2);
            return (
              <rect
                key={i}
                x={(x - zoneW / 2).toFixed(1)}
                y={0}
                width={zoneW.toFixed(1)}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
              />
            );
          })}

          {/* Y-axis labels */}
          {yTicks.map((tick) => (
            <text
              key={tick}
              x={PAD.left - 6}
              y={toY(tick) + 4}
              textAnchor="end"
              fontSize="9"
              fill="var(--foreground-subtle)"
              fontFamily="inherit"
            >
              ${tick}
            </text>
          ))}

          {/* X-axis labels */}
          {xLabels.map(({ date, x }, i) => (
            <text
              key={date}
              x={x}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
              fontSize="9"
              fill="var(--foreground-subtle)"
              fontFamily="inherit"
            >
              {fmt(date)}
            </text>
          ))}

          {/* Min/max markers */}
          {[
            { val: maxP, label: "High" },
            { val: minP, label: "Low" },
          ].map(({ val, label }) => {
            const idx = points.findIndex((p) => p.price === val);
            if (idx < 0) return null;
            const cx = toX(points[idx].date);
            const cy = toY(val);
            return (
              <g key={label}>
                <circle cx={cx} cy={cy} r={3} fill="var(--foreground)" />
                <text x={cx + 6} y={cy + 4} fontSize="8" fill="var(--foreground-muted)" fontFamily="inherit">
                  {label} ${val}
                </text>
              </g>
            );
          })}

          {/* Hover dot + tooltip */}
          {hovPt && (
            <g>
              <line
                x1={toX(hovPt.date)} y1={PAD.top}
                x2={toX(hovPt.date)} y2={H - PAD.bottom}
                stroke="var(--foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4"
              />
              <circle
                cx={toX(hovPt.date)} cy={toY(hovPt.price)}
                r={4} fill="var(--foreground)" stroke="var(--background)" strokeWidth="1.5"
              />
            </g>
          )}
        </svg>

        {/* Floating tooltip */}
        {hovPt && (() => {
          const x = toX(hovPt.date);
          const pct = x / W;
          return (
            <div
              className="absolute top-0 pointer-events-none"
              style={{ left: `${(x / W) * 100}%`, transform: `translateX(${pct > 0.75 ? "-100%" : pct < 0.25 ? "0%" : "-50%"})` }}
            >
              <div className="bg-[var(--foreground)] text-[var(--background)] text-[10px] px-2.5 py-1.5 leading-tight">
                <p className="font-medium">{formatPrice(hovPt.price)}</p>
                <p className="opacity-70 mt-0.5">{fmt(hovPt.date)}</p>
                {hovPt.retailerName && <p className="opacity-60">{hovPt.retailerName}</p>}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
