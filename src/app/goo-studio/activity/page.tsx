"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminAction } from "@/lib/server/audit";

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

interface AdminOption {
  id: string;
  email: string | null;
}

const PAGE_SIZE = 50;

// Typed against AdminAction so a new action cannot ship without a label here.
const ACTION_LABELS: Record<AdminAction, string> = {
  "user.name_updated":     "Updated name",
  "user.plan_changed":     "Changed plan",
  "user.admin_granted":    "Granted admin",
  "user.admin_revoked":    "Revoked admin",
  "user.banned":           "Banned user",
  "user.unbanned":         "Unbanned user",
  "user.deleted":          "Deleted user",
  "settings.api_key_updated": "Updated API key",
  "settings.api_key_deleted": "Deleted API key",
  "settings.homepage_showcase_updated": "Updated homepage showcase",
  "settings.homepage_stylist_updated":  "Updated homepage stylist",
  "settings.prompt_updated": "Updated prompt",
  "settings.prompt_reset":   "Reset prompt",
  "parser.config_updated":   "Updated parser config",
  "parser.product_imported": "Imported product",
  "parser.crawl_batch":      "Crawled batch",
  "parser.collect_ingest":   "Collected products",
  "categories.updated":      "Updated categories",
  "products.created":        "Created product",
  "products.updated":        "Edited product",
  "products.deleted":        "Deleted product",
  "products.bulk_deleted":   "Bulk-deleted products",
  "products.recategorized":  "Recategorized products",
  "products.recategorize_undone": "Undid recategorize",
  "products.label_fixed":    "Fixed labels",
  "products.label_dismissed": "Dismissed label suggestion",
  "products.label_restored":  "Restored label suggestion",
  "products.bulk_edited":    "Bulk-edited products",
  "products.bg_color_sampled": "Sampled backgrounds",
  "products.bg_color_undone":  "Undid backgrounds",
  "products.duplicates_merged":    "Merged duplicates",
  "products.duplicates_dismissed": "Dismissed duplicates",
  "outfits.created":         "Created outfit",
  "outfits.updated":         "Edited outfit",
  "outfits.deleted":         "Deleted outfit",
  "looks.approved":          "Approved look",
  "looks.rejected":          "Rejected look",
  "blog.created":            "Created post",
  "blog.updated":            "Edited post",
  "blog.deleted":            "Deleted post",
  "brands.created":          "Added brand",
  "brands.deleted":          "Deleted brand",
  "brands.logo_updated":     "Updated brand logo",
  "brands.logo_removed":     "Removed brand logo",
  "retailer_domain.saved":   "Saved retailer rule",
  "retailer_domain.deleted": "Deleted retailer rule",
  "retailer_domain.applied": "Applied retailer rule",
  "import.csv":              "Imported CSV",
  "stylist_usage.reset":     "Reset stylist limit",
  "email.sent":              "Sent email",
  "waitlist.deleted":        "Deleted from waitlist",
};

type Tone = "danger" | "warn" | "ok";

// Only the three admin statuses (DESIGN_SYSTEM.md §9); everything else is neutral.
const ACTION_TONES: Partial<Record<AdminAction, Tone>> = {
  "user.banned":             "danger",
  "user.deleted":            "danger",
  "settings.api_key_deleted": "danger",
  "products.deleted":        "danger",
  "products.bulk_deleted":   "danger",
  "outfits.deleted":         "danger",
  "blog.deleted":            "danger",
  "brands.deleted":          "danger",
  "retailer_domain.deleted": "danger",
  "waitlist.deleted":        "danger",
  "user.admin_granted":      "ok",
  "looks.approved":          "ok",
  "user.admin_revoked":      "warn",
  "user.plan_changed":       "warn",
  "settings.api_key_updated": "warn",
  "stylist_usage.reset":     "warn",
  "email.sent":              "warn",
};

const TONE_CLASSES: Record<Tone, string> = {
  danger: "bg-red-400/15 text-red-500 border-red-400/30",
  warn:   "bg-amber-400/15 text-amber-500 border-amber-400/30",
  ok:     "bg-emerald-400/15 text-emerald-500 border-emerald-400/30",
};

const GROUP_LABELS: Record<string, string> = {
  user: "Users",
  settings: "Settings",
  parser: "Parser",
  categories: "Categories",
  products: "Products",
  outfits: "Outfits",
  looks: "Looks",
  blog: "Blog",
  brands: "Brands",
  retailer_domain: "Retailers",
  import: "Import",
  stylist_usage: "Stylist",
  email: "Email",
  waitlist: "Waitlist",
};

// Action filter options, grouped by the part of the key before the dot.
const ACTION_GROUPS: [string, AdminAction[]][] = Object.entries(
  (Object.keys(ACTION_LABELS) as AdminAction[]).reduce<Record<string, AdminAction[]>>((acc, a) => {
    const group = a.split(".")[0];
    (acc[group] ??= []).push(a);
    return acc;
  }, {}),
);

function isKnownAction(action: string): action is AdminAction {
  return Object.prototype.hasOwnProperty.call(ACTION_LABELS, action);
}

const pillCls = (active: boolean) =>
  `px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase border rounded-full transition-colors ${
    active
      ? "bg-[var(--foreground)] text-[var(--background)] border-[var(--foreground)]"
      : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
  }`;

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
  // Whatever names the target, if the entry recorded one.
  const name = [metadata.name, metadata.title, metadata.subject, metadata.domain].find(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
  if (name) {
    return <span className="text-[10px] text-[var(--foreground-subtle)] truncate max-w-[240px]">{name}</span>;
  }
  return null;
}

export default function AdminActivityPage() {
  const [access, setAccess]       = useState<"checking" | "granted" | "denied">("checking");
  const [entries, setEntries]     = useState<AuditEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [admins, setAdmins]       = useState<AdminOption[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [adminFilter, setAdminFilter]   = useState("");
  const [actionFilter, setActionFilter] = useState("");
  // Bumped on every request, so a slow answer for an older filter is dropped.
  const requestId = useRef(0);

  // Super-admin status comes from the server (SUPER_ADMIN_USER_ID), the same
  // check the audit API applies, so the page and the API cannot disagree.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((me: { isSuperAdmin?: boolean } | null) => {
        if (!cancelled) setAccess(me?.isSuperAdmin === true ? "granted" : "denied");
      })
      .catch(() => {
        // Could not ask; the audit API still answers 403 to anyone else.
        if (!cancelled) setAccess("granted");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchPage = useCallback(async (offset: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (adminFilter)  qs.set("admin_id", adminFilter);
      if (actionFilter) qs.set("action", actionFilter);
      const res = await fetch(`/api/admin/audit?${qs}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({})) as {
        entries?: AuditEntry[]; total?: number; admins?: AdminOption[]; error?: string;
      };
      if (id !== requestId.current) return;
      if (res.status === 403) {
        setAccess("denied");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const page = body.entries ?? [];
      setEntries((prev) => {
        if (offset === 0) return page;
        // New actions shift the offsets while paging; skip rows already shown.
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...page.filter((e) => !seen.has(e.id))];
      });
      setTotal(body.total ?? 0);
      if (body.admins) setAdmins(body.admins);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [adminFilter, actionFilter]);

  useEffect(() => {
    if (access === "granted") fetchPage(0);
  }, [access, fetchPage]);

  // A new filter starts from an empty list: rows of the old filter must not
  // stay on screen, or be paged past with "Load more", if the new request fails.
  const changeFilter = (admin: string, action: string) => {
    if (admin === adminFilter && action === actionFilter) return;
    requestId.current++;
    setEntries([]);
    setTotal(0);
    setError(null);
    setLoading(true);
    setAdminFilter(admin);
    setActionFilter(action);
  };

  if (access === "checking") {
    return <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Loading…</div>;
  }

  // Access guard — non-super admins get a locked view
  if (access === "denied") {
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

  const filtered = !!(adminFilter || actionFilter);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Admin Activity</h1>
            <span className="text-[9px] tracking-[0.16em] uppercase px-2 py-1 border rounded-full bg-amber-400/15 text-amber-500 border-amber-400/30">
              Super Admin
            </span>
          </div>
          <p className="text-xs text-[var(--foreground-muted)]">
            {total.toLocaleString()} recorded action{total === 1 ? "" : "s"} {filtered ? "matching the filter" : "across all admins"}
          </p>
        </div>
        <button
          onClick={() => fetchPage(0)}
          disabled={loading}
          className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] px-3 py-2 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button onClick={() => changeFilter("", actionFilter)} aria-pressed={!adminFilter} className={pillCls(!adminFilter)}>
          All admins
        </button>
        {admins.map((a) => (
          <button
            key={a.id}
            onClick={() => changeFilter(a.id, actionFilter)}
            aria-pressed={adminFilter === a.id}
            className={`${pillCls(adminFilter === a.id)} truncate max-w-[200px]`}
            title={a.id}
          >
            {a.email ?? a.id.slice(0, 16) + "…"}
          </button>
        ))}
        <span className="w-px h-4 bg-[var(--border)] mx-1" />
        <select
          value={actionFilter}
          onChange={(e) => changeFilter(adminFilter, e.target.value)}
          aria-label="Filter by action"
          className="rounded-full border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-[10px] tracking-[0.1em] uppercase px-2.5 py-1 outline-none focus:border-[var(--foreground)] transition-colors cursor-pointer max-w-[220px]"
        >
          <option value="">All actions</option>
          {ACTION_GROUPS.map(([group, actions]) => (
            <optgroup key={group} label={GROUP_LABELS[group] ?? group}>
              {actions.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-400/30 bg-red-400/15 text-red-500 text-xs px-4 py-3">
          {error}
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--background)]">
        {loading && entries.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">Loading…</div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">
            {filtered
              ? "No actions match this filter."
              : "No activity recorded yet. Actions by admins will appear here."}
          </div>
        )}

        {entries.map((entry, i) => {
          const action = isKnownAction(entry.action) ? entry.action : null;
          const label = action ? ACTION_LABELS[action] : entry.action;
          const tone = action ? ACTION_TONES[action] : undefined;
          const colorCls = tone ? TONE_CLASSES[tone] : "border-[var(--border)] text-[var(--foreground-muted)]";
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
                  <span className={`text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 border rounded-full ${colorCls}`}>
                    {label}
                  </span>
                  {entry.target_type && (
                    <span className="text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] border border-[var(--border)] rounded-full px-1.5 py-0.5">
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

      {entries.length > 0 && entries.length < total && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => fetchPage(entries.length)}
            disabled={loading}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors disabled:opacity-40"
          >
            {loading ? "Loading…" : `Load more · ${entries.length.toLocaleString()} of ${total.toLocaleString()}`}
          </button>
        </div>
      )}
    </div>
  );
}

function ActionIcon({ action }: { action: string }) {
  const cls = "text-[var(--foreground-subtle)]";
  if (action === "user.banned" || action.endsWith(".deleted") || action.endsWith("_deleted")) {
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
