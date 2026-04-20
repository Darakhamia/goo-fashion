"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface StatsPayload {
  generatedAt: string;
  summary: {
    products: { total: number; thisMonth: number; growthPct: number };
    outfits:  { total: number; thisMonth: number; growthPct: number; aiGenerated: number };
    users:    { total: number; thisMonth: number; growthPct: number; activeWeek: number };
    brands:   { total: number };
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
      isAdmin: boolean;
    }[];
  };
  health: {
    supabase: { ok: boolean; detail: string };
    clerk:    { ok: boolean; detail: string };
    openai:   { ok: boolean; detail: string };
    replicate:{ ok: boolean; detail: string };
  };
}

function fmtDelta(pct: number): { label: string; positive: boolean } {
  if (pct === 0) return { label: "Flat vs last month", positive: true };
  const sign = pct > 0 ? "+" : "";
  return { label: `${sign}${pct}% vs last month`, positive: pct >= 0 };
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

  const statCards = data ? [
    {
      label: "Products",
      value: data.summary.products.total.toLocaleString(),
      delta: fmtDelta(data.summary.products.growthPct),
      sub: `+${data.summary.products.thisMonth} this month`,
    },
    {
      label: "Outfits",
      value: data.summary.outfits.total.toLocaleString(),
      delta: fmtDelta(data.summary.outfits.growthPct),
      sub: `${data.summary.outfits.aiGenerated} AI-generated`,
    },
    {
      label: "Users",
      value: data.summary.users.total.toLocaleString(),
      delta: fmtDelta(data.summary.users.growthPct),
      sub: `${data.summary.users.activeWeek} active this week`,
    },
    {
      label: "Brands",
      value: data.summary.brands.total.toLocaleString(),
      delta: { label: "Catalog coverage", positive: true },
      sub: `${data.summary.products.total > 0 ? Math.round(data.summary.products.total / Math.max(data.summary.brands.total, 1)) : 0} avg products/brand`,
    },
  ] : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Dashboard</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1 tracking-wide">
            {data ? `Last updated ${fmtRelative(data.generatedAt)}` : "Loading live data…"}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] px-3 py-2 transition-colors disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 border border-red-500/40 bg-red-500/5 text-red-600 text-xs px-4 py-3">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {(loading && !data ? Array.from({ length: 4 }) : statCards).map((card, i) => {
          const c = card as typeof statCards[number] | undefined;
          return (
            <div
              key={c?.label ?? i}
              className="border border-[var(--border)] p-6"
              style={{ background: "var(--background)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">
                  {c?.label ?? "—"}
                </span>
              </div>
              <p className="font-display text-3xl font-light text-[var(--foreground)] mb-2">
                {c?.value ?? "—"}
              </p>
              <p className={`text-[10px] tracking-wide ${c?.delta.positive ? "text-emerald-600" : "text-red-500"}`}>
                {c?.delta.label ?? "\u00A0"}
              </p>
              <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide mt-0.5">
                {c?.sub ?? "\u00A0"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Service health */}
      <div className="mb-10">
        <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">System Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data && (["supabase", "clerk", "openai", "replicate"] as const).map((k) => {
            const h = data.health[k];
            return (
              <div
                key={k}
                className="border border-[var(--border)] px-4 py-3 flex items-center gap-3"
                style={{ background: "var(--background)" }}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${h.ok ? "bg-emerald-500" : "bg-red-500"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground)] capitalize">{k}</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)] truncate">{h.detail}</p>
                </div>
              </div>
            );
          })}
          {!data && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-[var(--border)] px-4 py-3 h-12 animate-pulse" style={{ background: "var(--background)" }} />
          ))}
        </div>
      </div>

      {/* Recent signups + recent outfits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        {/* Signups */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Recent Signups</h2>
            <Link href="/admin/users" className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
              View all →
            </Link>
          </div>
          <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
            {data?.recent.signups.length === 0 && (
              <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">No signups yet</div>
            )}
            {data?.recent.signups.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0">
                {u.imageUrl ? (
                  <Image src={u.imageUrl} alt="" width={28} height={28} className="rounded-full object-cover w-7 h-7" />
                ) : (
                  <div className="w-7 h-7 flex items-center justify-center text-[9px] font-medium text-[var(--background)] bg-[var(--foreground-muted)]">
                    {initials(u.firstName, u.lastName, u.email)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--foreground)] truncate">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id}
                  </p>
                  <p className="text-[10px] text-[var(--foreground-subtle)] truncate">{u.email}</p>
                </div>
                <span className={`text-[9px] tracking-[0.1em] uppercase px-2 py-1 ${
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
        </section>

        {/* Recent outfits */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Recent Outfits</h2>
            <Link href="/admin/outfits" className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
              View all →
            </Link>
          </div>
          <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
            {data?.recent.outfits.length === 0 && (
              <div className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">No outfits yet</div>
            )}
            {data?.recent.outfits.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0">
                <div className="relative w-10 h-12 bg-[var(--surface)] overflow-hidden flex-shrink-0">
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
        </section>
      </div>

      {/* Recent Products */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">Recent Products</h2>
          <Link href="/admin/products" className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
            View all →
          </Link>
        </div>

        <div className="border border-[var(--border)]" style={{ background: "var(--background)" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal w-14">Image</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">Name</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal hidden md:table-cell">Brand</th>
                <th className="text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal">Added</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent.products.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-xs text-[var(--foreground-subtle)] text-center">No products yet</td></tr>
              )}
              {data?.recent.products.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="relative w-8 h-10 overflow-hidden flex-shrink-0">
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

      {/* Quick actions */}
      <div>
        <h2 className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-4">Quick Actions</h2>
        <div className="flex gap-3 flex-wrap">
          {[
            { href: "/admin/products", label: "Add Product" },
            { href: "/admin/outfits",  label: "Add Outfit" },
            { href: "/admin/users",    label: "Manage Users" },
            { href: "/admin/settings", label: "Settings" },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="inline-flex items-center gap-2 border border-[var(--border)] px-5 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
