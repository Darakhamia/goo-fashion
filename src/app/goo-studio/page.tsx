"use client";

import { useEffect, useState } from "react";
import Image from "@/components/ui/Image";
import Link from "next/link";
import { motion } from "framer-motion";

type HealthItem = { ok: boolean; detail: string };

// Metrics are null when their query failed: the card shows "—" and no growth
// pill instead of a zero that looks real.
interface StatsPayload {
  generatedAt: string;
  summary: {
    products: { total: number | null; thisMonth: number | null; growthPct: number | null };
    outfits:  { total: number | null; growthPct: number | null; aiGenerated: number | null };
    users:    { total: number | null; growthPct: number | null; activeWeek: number | null };
    brands:   { total: number | null };
  };
  recent: {
    products: { id: string; name: string; brand?: string; image_url?: string; created_at: string }[];
    outfits:  { id: string; name: string; image_url?: string; created_at: string }[];
    signups:  {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      imageUrl: string;
      createdAt: number;
      plan: string;
    }[];
  };
  health: {
    supabase:  HealthItem;
    clerk:     HealthItem;
    openai:    HealthItem;
    replicate: HealthItem;
    monobank:  HealthItem;
    resend:    HealthItem;
  };
}

const HEALTH_LABELS: Record<keyof StatsPayload["health"], string> = {
  supabase:  "Supabase",
  clerk:     "Clerk",
  openai:    "OpenAI",
  replicate: "Replicate",
  monobank:  "Monobank",
  resend:    "Resend",
};

function fmtDelta(pct: number | null): { label: string; positive: boolean } | null {
  if (pct === null) return null;
  if (pct === 0) return { label: "Flat vs last month", positive: true };
  const sign = pct > 0 ? "+" : "";
  return { label: `${sign}${pct}% vs last month`, positive: pct >= 0 };
}

function fmtCount(n: number | null): string {
  return n === null ? "—" : n.toLocaleString();
}

function fmtRelative(ts: number | string): string {
  const t = typeof ts === "number" ? ts : Date.parse(ts);
  const diff = Date.now() - t;
  const mins  = Math.round(diff / 60_000);
  const hours = Math.round(diff / 3_600_000);
  const days  = Math.round(diff / 86_400_000);
  if (mins  < 1)   return "just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(t).toLocaleDateString();
}

function initials(first: string | null, last: string | null, email: string | null): string {
  const f = first?.[0] ?? "";
  const l = last?.[0]  ?? "";
  if (f || l) return `${f}${l}`.toUpperCase();
  if (email)  return email.slice(0, 2).toUpperCase();
  return "—";
}

const STAT_ACCENTS = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500"];

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statCards = data ? (() => {
    const { products, outfits, users, brands } = data.summary;
    return [
      {
        label: "Products",
        value: fmtCount(products.total),
        delta: fmtDelta(products.growthPct),
        sub: products.thisMonth === null ? "—" : `+${products.thisMonth} this month`,
      },
      {
        label: "Outfits",
        value: fmtCount(outfits.total),
        delta: fmtDelta(outfits.growthPct),
        sub: `${fmtCount(outfits.aiGenerated)} AI-generated`,
      },
      {
        label: "Users",
        value: fmtCount(users.total),
        delta: fmtDelta(users.growthPct),
        sub: `${fmtCount(users.activeWeek)} active this week`,
      },
      {
        label: "Brands",
        value: fmtCount(brands.total),
        delta: null,
        sub: products.total !== null && brands.total
          ? `${Math.round(products.total / brands.total)} avg products/brand`
          : "—",
      },
    ];
  })() : [];

  // First load failed: show the error with a retry instead of skeletons that
  // look like an endless load.
  if (error && !data) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Dashboard</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">Live data could not be loaded.</p>
        </div>
        <div className="border border-red-400/30 bg-red-400/15 text-red-500 text-xs px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-4">
          <span className="min-w-0 break-words">{error}</span>
          <button
            onClick={load}
            className="shrink-0 text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] px-3 py-2 transition-colors rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Dashboard</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
            {data ? `Last updated ${fmtRelative(data.generatedAt)}` : "Loading live data…"}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] px-3 py-2 transition-colors disabled:opacity-50 rounded-lg"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 border border-red-400/30 bg-red-400/15 text-red-500 text-xs px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {(loading && !data ? Array.from({ length: 4 }) : statCards).map((card, i) => {
          const c = card as typeof statCards[number] | undefined;
          return (
            <motion.div
              key={c?.label ?? i}
              variants={fadeUp}
              className="rounded-2xl border border-[var(--border)] p-4 md:p-6 min-w-0 relative overflow-hidden hover:border-[var(--foreground-muted)] hover:shadow-md transition-colors duration-200"
              style={{ background: "var(--background)" }}
            >
              {/* Color accent strip */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${STAT_ACCENTS[i]}`} />
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
                  {c?.label ?? "—"}
                </span>
              </div>
              <p className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)] mb-3 break-words">
                {c?.value ?? "—"}
              </p>
              {/* Delta pill */}
              <div className="mb-1">
                {!c ? (
                  <span className="inline-block h-5 w-24 rounded-full bg-[var(--border)] animate-pulse" />
                ) : c.delta ? (
                  <span
                    title="Month to date vs the same days of last month"
                    className={`inline-flex items-center text-[9px] tracking-[0.1em] uppercase font-medium px-2 py-1 rounded-full ${
                      c.delta.positive
                        ? "bg-emerald-500/12 text-emerald-600 border border-emerald-500/20"
                        : "bg-red-500/12 text-red-500 border border-red-500/20"
                    }`}
                  >
                    {c.delta.label}
                  </span>
                ) : null}
              </div>
              <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide mt-1">
                {c?.sub ?? " "}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Service health */}
      <div className="mb-10">
        <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">System Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {data && (Object.keys(HEALTH_LABELS) as (keyof StatsPayload["health"])[]).map((k) => {
            const h = data.health[k];
            return (
              <div
                key={k}
                className="rounded-xl border border-[var(--border)] px-4 py-3 flex items-center gap-3 hover:border-[var(--border-strong)] transition-colors"
                style={{ background: "var(--background)" }}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    h.ok ? "bg-emerald-500" : "bg-red-500 animate-pulse"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground)]">{HEALTH_LABELS[k]}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)] truncate">{h.detail}</p>
                </div>
              </div>
            );
          })}
          {!data && Object.keys(HEALTH_LABELS).map((k) => (
            <div key={k} className="rounded-xl border border-[var(--border)] px-4 py-3 h-14 animate-pulse" style={{ background: "var(--background)" }} />
          ))}
        </div>
      </div>

      {/* Recent signups + recent outfits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Signups */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Recent Signups</h2>
            <Link href="/goo-studio/users" className="inline-flex items-center min-h-10 md:min-h-0 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: "var(--background)" }}>
            {data?.recent.signups.length === 0 && (
              <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">No signups yet</div>
            )}
            <div className="divide-y divide-[var(--border)]">
              {data?.recent.signups.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface)] transition-colors">
                  {u.imageUrl ? (
                    <Image src={u.imageUrl} alt="" width={28} height={28} className="rounded-full object-cover w-7 h-7 flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-medium text-[var(--background)] bg-[var(--foreground-muted)] flex-shrink-0">
                      {initials(u.firstName, u.lastName, u.email)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--foreground)] truncate">
                      {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id}
                    </p>
                    <p className="text-[10px] text-[var(--foreground-subtle)] truncate">{u.email}</p>
                  </div>
                  <span className={`text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded-md ${
                    u.plan === "premium" ? "bg-[var(--foreground)] text-[var(--background)]"
                    : u.plan === "pro" ? "bg-amber-400/15 text-amber-600 border border-amber-400/30"
                    : u.plan === "basic" ? "border border-[var(--border-strong)] text-[var(--foreground)]"
                    : "border border-[var(--border)] text-[var(--foreground-muted)]"
                  }`}>
                    {u.plan}
                  </span>
                  <span className="text-[10px] text-[var(--foreground-subtle)] tabular-nums whitespace-nowrap">
                    {fmtRelative(u.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recent outfits */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Recent Outfits</h2>
            <Link href="/goo-studio/outfits" className="inline-flex items-center min-h-10 md:min-h-0 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
              View all →
            </Link>
          </div>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: "var(--background)" }}>
            {data?.recent.outfits.length === 0 && (
              <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">No outfits yet</div>
            )}
            <div className="divide-y divide-[var(--border)]">
              {data?.recent.outfits.map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface)] transition-colors">
                  <div className="relative w-10 h-12 bg-[var(--surface)] overflow-hidden flex-shrink-0 rounded-lg">
                    {o.image_url ? (
                      <Image src={o.image_url} alt="" fill className="object-cover" sizes="40px" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--foreground)] truncate">{o.name}</p>
                    <p className="text-[10px] text-[var(--foreground-subtle)]">{fmtRelative(o.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Recent Products */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Recent Products</h2>
          <Link href="/goo-studio/products" className="inline-flex items-center min-h-10 md:min-h-0 text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
            View all →
          </Link>
        </div>

        <div className="rounded-xl border border-[var(--border)] overflow-x-auto" style={{ background: "var(--background)" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]" style={{ background: "var(--surface)" }}>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal w-14">Image</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">Name</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden md:table-cell">Brand</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data?.recent.products.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">No products yet</td></tr>
              )}
              {data?.recent.products.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="relative w-8 h-10 overflow-hidden flex-shrink-0 rounded-md">
                      {p.image_url ? (
                        <Image src={p.image_url} alt={p.name} fill className="object-cover" sizes="32px" />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--foreground)]">{p.name}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-[var(--foreground-muted)]">{p.brand ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[var(--foreground-muted)]">{fmtRelative(p.created_at)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
