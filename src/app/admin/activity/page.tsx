"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/context/auth-context";

interface AuditEntry {
  id: number;
  admin_id: string;
  admin_email: string | null;
  action: string;
  target_id: string | null;
  target_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  "user.name_updated":     "Updated name",
  "user.plan_changed":     "Changed plan",
  "user.admin_granted":    "Granted admin",
  "user.admin_revoked":    "Revoked admin",
  "user.banned":           "Banned user",
  "user.unbanned":         "Unbanned user",
  "user.deleted":          "Deleted user",
  "settings.api_key_updated": "Updated API key",
  "settings.api_key_deleted": "Deleted API key",
};

const ACTION_COLORS: Record<string, string> = {
  "user.banned":           "bg-red-500/15 text-red-600 border-red-500/30",
  "user.deleted":          "bg-red-500/15 text-red-600 border-red-500/30",
  "user.admin_granted":    "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  "user.admin_revoked":    "bg-amber-500/15 text-amber-600 border-amber-500/30",
  "user.plan_changed":     "bg-blue-500/15 text-blue-600 border-blue-500/30",
  "settings.api_key_updated": "bg-purple-500/15 text-purple-600 border-purple-500/30",
  "settings.api_key_deleted": "bg-red-500/15 text-red-600 border-red-500/30",
};

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.round(diff / 60_000);
  const hours = Math.round(diff / 3_600_000);
  const days  = Math.round(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function MetaDetail({ metadata, action }: { metadata: Record<string, unknown>; action: string }) {
  if (action === "user.plan_changed") {
    return (
      <span className="text-[10px] text-[var(--foreground-subtle)]">
        {String(metadata.from ?? "?")} → {String(metadata.to ?? "?")}
      </span>
    );
  }
  if (action === "user.deleted" && metadata.target_email) {
    return <span className="text-[10px] text-[var(--foreground-subtle)]">{String(metadata.target_email)}</span>;
  }
  if (action === "user.name_updated") {
    const parts = [metadata.firstName, metadata.lastName].filter(Boolean);
    if (parts.length) {
      return <span className="text-[10px] text-[var(--foreground-subtle)]">{parts.join(" ")}</span>;
    }
  }
  return null;
}

export default function AdminActivityPage() {
  const { user } = useAuth();
  const superAdminId = process.env.NEXT_PUBLIC_SUPER_ADMIN_USER_ID ?? "";

  const [entries, setEntries]     = useState<AuditEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [adminFilter, setAdminFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "100" });
      if (adminFilter) qs.set("admin_id", adminFilter);
      const res = await fetch(`/api/admin/audit?${qs}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = await res.json() as { entries: AuditEntry[]; total: number };
      setEntries(body.entries);
      setTotal(body.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [adminFilter]);

  useEffect(() => { load(); }, [load]);

  // Group by admin for the filter selector
  const adminIds = Array.from(new Set(entries.map((e) => e.admin_id)));

  // Access guard — non-super admins get a locked view
  if (user && superAdminId && user.id !== superAdminId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-[var(--foreground-muted)]">
          <rect x="5" y="11" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-[var(--foreground-muted)]">Access restricted to super admin only.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Admin Activity</h1>
            <span className="text-[9px] tracking-[0.16em] uppercase px-2 py-1 border bg-amber-400/10 text-amber-600 border-amber-400/30">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-[var(--foreground-muted)]">
            {total} recorded actions across all admins
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] px-3 py-2 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button
          onClick={() => setAdminFilter("")}
          className={`text-[9px] tracking-[0.14em] uppercase px-3 py-2 border transition-colors ${
            !adminFilter
              ? "border-[var(--foreground)] text-[var(--foreground)]"
              : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
          }`}
        >
          All admins
        </button>
        {adminIds.map((aid) => {
          const email = entries.find((e) => e.admin_id === aid)?.admin_email;
          return (
            <button
              key={aid}
              onClick={() => setAdminFilter(aid)}
              className={`text-[9px] tracking-[0.14em] uppercase px-3 py-2 border transition-colors truncate max-w-[200px] ${
                adminFilter === aid
                  ? "border-[var(--foreground)] text-[var(--foreground)]"
                  : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
              }`}
              title={aid}
            >
              {email ?? aid.slice(0, 16) + "…"}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-6 border border-red-500/40 bg-red-500/5 text-red-600 text-xs px-4 py-3">
          {error}
        </div>
      )}

      {/* Timeline */}
      <div className="border border-[var(--border)]">
        {loading && entries.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">Loading…</div>
        )}
        {!loading && entries.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">
            No activity recorded yet. Actions by admins will appear here.
          </div>
        )}

        {entries.map((entry, i) => {
          const label = ACTION_LABELS[entry.action] ?? entry.action;
          const colorCls = ACTION_COLORS[entry.action] ?? "border-[var(--border)] text-[var(--foreground-muted)]";
          const isLast = i === entries.length - 1;

          return (
            <div
              key={entry.id}
              className={`flex items-start gap-4 px-6 py-4 hover:bg-[var(--surface)] transition-colors ${!isLast ? "border-b border-[var(--border)]" : ""}`}
            >
              {/* Icon column */}
              <div className="flex-shrink-0 mt-0.5">
                <ActionIcon action={entry.action} />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 border ${colorCls}`}>
                    {label}
                  </span>
                  {entry.target_type && (
                    <span className="text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] border border-[var(--border)] px-1.5 py-0.5">
                      {entry.target_type}
                    </span>
                  )}
                  <MetaDetail metadata={entry.metadata} action={entry.action} />
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-[var(--foreground)]">
                    {entry.admin_email ?? entry.admin_id}
                  </span>
                  {entry.target_id && (
                    <>
                      <span className="text-[var(--border-strong)]">·</span>
                      <span className="text-[10px] font-mono text-[var(--foreground-subtle)] truncate max-w-[180px]">
                        {entry.target_id}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <div className="flex-shrink-0 text-right">
                <p className="text-xs text-[var(--foreground-muted)]" title={fmtFull(entry.created_at)}>
                  {fmtRelative(entry.created_at)}
                </p>
                <p className="text-[9px] text-[var(--foreground-subtle)] mt-0.5">
                  {new Date(entry.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionIcon({ action }: { action: string }) {
  const cls = "text-[var(--foreground-subtle)]";
  if (action === "user.banned" || action === "user.deleted") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M3.5 3.5L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (action === "user.admin_granted") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
        <path d="M8 2L10 6H14L11 9L12 13L8 11L4 13L5 9L2 6H6L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    );
  }
  if (action === "user.plan_changed") {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
        <path d="M3 8H13M10 5L13 8L10 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (action.startsWith("settings.")) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={cls}>
      <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
