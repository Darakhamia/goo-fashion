"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "@/components/ui/Image";

const PAGE_SIZE = 25;

interface UserSubscription {
  plan: string;
  status: string;
  amountUah: number;
  autoRenew: boolean;
  maskedPan: string | null;
  startedAt: string;
  currentPeriodEnd: string | null;
}

interface UserRow {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string;
  createdAt: number;
  lastSignInAt: number | null;
  lastActiveAt: number | null;
  banned: boolean;
  locked: boolean;
  plan: string;
  isAdmin: boolean;
  /** Admin through the ADMIN_USER_IDS env var — not revocable from here. */
  adminViaEnv: boolean;
  isSuperAdmin: boolean;
  subscription?: UserSubscription | null;
}

interface UserDetail extends UserRow {
  username: string | null;
  updatedAt: number;
  twoFactorEnabled: boolean;
  subscription: UserSubscription | null;
}

/** Tallies from /api/admin/users/counts — across all users, not the loaded page. */
interface UserCounts {
  total: number;
  premium: number;
  pro: number;
  basic: number;
  free: number;
  banned: number;
  /** True when Clerk holds more users than the server scanned. */
  partial: boolean;
  scanned: number;
}

interface BulkResult {
  action: string;
  ok: number;
  total: number;
  errors: string[];
}

const PLAN_OPTIONS = ["free", "basic", "pro", "premium"] as const;
const STATUS_OPTIONS = ["all", "active", "banned", "locked"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const planBadge: Record<string, string> = {
  free:    "rounded-full border border-[var(--border)] text-[var(--foreground-muted)]",
  basic:   "rounded-full border border-[var(--border-strong)] text-[var(--foreground)]",
  pro:     "rounded-full bg-amber-400/15 text-amber-500 border border-amber-400/30",
  premium: "rounded-full bg-[var(--foreground)] text-[var(--background)]",
};

function initials(first: string | null, last: string | null, email: string | null) {
  const f = first?.[0] ?? "";
  const l = last?.[0]  ?? "";
  if (f || l) return `${f}${l}`.toUpperCase();
  if (email)  return email.slice(0, 2).toUpperCase();
  return "—";
}

function fmtDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtRelative(ts: number | null | undefined) {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  const mins  = Math.round(diff / 60_000);
  const hours = Math.round(diff / 3_600_000);
  const days  = Math.round(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return fmtDate(ts);
}

/** "3 mo", "12 d" — how long since `iso`. */
function fmtDuration(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
  if (days < 1)  return "today";
  if (days < 31) return `${days} d`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  return `${years} y ${months % 12} mo`;
}

function rowLabel(u: Pick<UserRow, "firstName" | "lastName" | "email" | "id">): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;
}

/** A subscription the billing ledger still treats as live (it can be charged). */
function liveSubscription(s: UserSubscription | null | undefined): s is UserSubscription {
  return !!s && (s.status === "active" || s.status === "past_due");
}

function describeSubscription(s: UserSubscription): string {
  return `${s.plan}, ${s.amountUah} ₴/mo, ${s.status.replace("_", " ")}, auto-renew ${s.autoRenew ? "on" : "off"}`;
}

/** "a@b.c, d@e.f and 3 more" — for confirm dialogs. */
function listLabels(rows: UserRow[], max = 5): string {
  const shown = rows.slice(0, max).map(rowLabel).join(", ");
  return rows.length > max ? `${shown} and ${rows.length - max} more` : shown;
}

// The admin panel changes the plan in Clerk only; the monobank subscription
// row is untouched, so a renewal keeps charging and puts the paid plan back.
const PLAN_BILLING_NOTE = "Only the plan in Clerk changes — billing does not.";
const RENEWAL_NOTE = "Charges continue, and the next renewal restores the paid plan.";

function deleteSubscriptionWarning(s: UserSubscription | null | undefined): string {
  if (!liveSubscription(s)) return "";
  return `\n\nThis user has an active subscription (${describeSubscription(s)}). ` +
    "Auto-renew is turned off before the account is deleted, so the saved card is not charged again.";
}

const subStatusBadge: Record<string, string> = {
  active:   "text-emerald-500",
  pending:  "text-amber-500",
  past_due: "text-red-500",
  canceled: "text-[var(--foreground-subtle)]",
};

const inputCls =
  "bg-transparent border border-[var(--border)] rounded-lg focus:border-[var(--foreground)] outline-none px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";

const filterBtnCls = (active: boolean) =>
  `text-[9px] tracking-[0.14em] uppercase px-3 py-2.5 border rounded-full transition-colors duration-200 capitalize ${
    active
      ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
      : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
  }`;

export default function AdminUsersPage() {
  const [currentIsSuperAdmin, setCurrentIsSuperAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.isSuperAdmin) setCurrentIsSuperAdmin(true); })
      .catch(() => {});
  }, []);

  const [users, setUsers] = useState<UserRow[]>([]);
  /** Users matching the current search/filters — drives pagination. */
  const [total, setTotal] = useState(0);
  const [listPartial, setListPartial] = useState(false);
  const [subsError, setSubsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | typeof PLAN_OPTIONS[number]>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [counts, setCounts] = useState<UserCounts | null>(null);
  const [countsError, setCountsError] = useState<string | null>(null);

  // Bulk state. Selected rows are kept whole so a selection survives paging
  // (only the current page is loaded) and confirms can see subscriptions.
  const [selected, setSelected] = useState<Map<string, UserRow>>(new Map());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPlan, setBulkPlan] = useState<typeof PLAN_OPTIONS[number]>("free");
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);

  // Ignores responses that arrive after a newer request was sent.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search)                 qs.set("q", search);
      if (planFilter !== "all")   qs.set("plan", planFilter);
      if (statusFilter !== "all") qs.set("status", statusFilter);
      qs.set("limit", String(PAGE_SIZE));
      qs.set("offset", String(page * PAGE_SIZE));
      const res = await fetch(`/api/admin/users?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const body = await res.json();
      if (seq !== loadSeq.current) return;
      setUsers(body.users);
      setTotal(body.totalCount);
      setListPartial(body.partial === true);
      setSubsError(body.subscriptionsError ?? null);
      // The last page emptied (e.g. after a delete) — step back to the new last page.
      if (body.users.length === 0 && page > 0) {
        setPage(Math.max(0, Math.ceil(body.totalCount / PAGE_SIZE) - 1));
      }
    } catch (e) {
      if (seq === loadSeq.current) setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [search, planFilter, statusFilter, page]);

  const loadCounts = useCallback(async () => {
    setCountsError(null);
    try {
      const res = await fetch("/api/admin/users/counts", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setCounts(body as UserCounts);
    } catch (e) {
      setCountsError(e instanceof Error ? e.message : "Failed to load counts");
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const refresh = () => { load(); loadCounts(); };

  // Reset page when filters change
  useEffect(() => { setPage(0); setSelected(new Map()); }, [search, planFilter, statusFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const selectableOnPage = users.filter((u) => !u.isSuperAdmin);
  const allOnPageSelected = selectableOnPage.length > 0 && selectableOnPage.every((u) => selected.has(u.id));
  const someOnPageSelected = selectableOnPage.some((u) => selected.has(u.id));

  const toggleSelect = (u: UserRow) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(u.id)) next.delete(u.id); else next.set(u.id, u);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Map(prev);
        selectableOnPage.forEach((u) => next.delete(u.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Map(prev);
        selectableOnPage.forEach((u) => next.set(u.id, u));
        return next;
      });
    }
  };

  const safeSelected = () => [...selected.values()].filter((u) => !u.isSuperAdmin);

  /**
   * One request per user. Reports "N of M" with the failures, keeps the
   * failed users selected for a retry, and always releases the buttons.
   */
  const runBulk = async (action: string, rows: UserRow[], request: (id: string) => Promise<Response>) => {
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const results = await Promise.allSettled(
        rows.map(async (u) => {
          const res = await request(u.id);
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        })
      );
      const failed = new Set<string>();
      const errors: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          failed.add(rows[i].id);
          errors.push(`${rowLabel(rows[i])}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
        }
      });
      setBulkResult({ action, ok: rows.length - failed.size, total: rows.length, errors });
      setSelected((prev) => new Map([...prev].filter(([id]) => failed.has(id))));
    } finally {
      setBulkLoading(false);
      refresh();
    }
  };

  const patchUser = (body: Record<string, unknown>) => (id: string) =>
    fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const bulkBan = async (ban: boolean) => {
    const rows = safeSelected();
    if (!rows.length) return;
    if (!confirm(`${ban ? "Ban" : "Unban"} ${rows.length} user(s)?`)) return;
    await runBulk(ban ? "Ban" : "Unban", rows, patchUser({ banned: ban }));
  };

  const bulkSetPlan = async () => {
    const rows = safeSelected();
    if (!rows.length) return;
    const paying = rows.filter((u) => liveSubscription(u.subscription));
    const renewing = paying.some((u) => u.subscription?.autoRenew);
    const warn = paying.length
      ? `\n\n${paying.length} of them ${paying.length === 1 ? "has" : "have"} an active subscription (${listLabels(paying)}). ` +
        `${PLAN_BILLING_NOTE}${renewing ? ` ${RENEWAL_NOTE}` : ""}`
      : "";
    if (!confirm(`Set plan to "${bulkPlan}" for ${rows.length} user(s)?${warn}`)) return;
    await runBulk(`Plan → ${bulkPlan}`, rows, patchUser({ plan: bulkPlan }));
  };

  const bulkDelete = async () => {
    const rows = safeSelected();
    if (!rows.length) return;
    const paying = rows.filter((u) => liveSubscription(u.subscription));
    const warn = paying.length
      ? `\n\n${paying.length} of them ${paying.length === 1 ? "has" : "have"} an active subscription (${listLabels(paying)}). ` +
        "Auto-renew is turned off before each account is deleted, so saved cards are not charged again."
      : "";
    if (!confirm(`Permanently delete ${rows.length} user(s)? This cannot be undone.${warn}`)) return;
    await runBulk("Delete", rows, (id) => fetch(`/api/admin/users/${id}`, { method: "DELETE" }));
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Delete ${rowLabel(u)}? This permanently removes the Clerk account.${deleteSubscriptionWarning(u.subscription)}`)) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error || "Failed to delete");
      return;
    }
    setSelected((prev) => { const next = new Map(prev); next.delete(u.id); return next; });
    if (selectedId === u.id) setSelectedId(null);
    refresh();
  };

  const handleUpdated = (updated: UserRow) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    loadCounts();
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Users</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {counts ? counts.total.toLocaleString() : "—"} registered
            {error ? <span className="text-red-500"> · {error}</span> : null}
            {countsError ? <span className="text-red-500"> · counts unavailable: {countsError}</span> : null}
            {subsError ? <span className="text-red-500"> · subscription data unavailable: {subsError}</span> : null}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] rounded-lg hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] px-3 py-2 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Stats — 6 cards in a 3-col / 6-col grid. Counted server-side across
          all users; if Clerk holds more than the server scans, say so. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Total",   value: counts?.total,   note: "registered" },
          { label: "Premium", value: counts?.premium, note: "subscribers" },
          { label: "Pro",     value: counts?.pro,     note: "subscribers" },
          { label: "Basic",   value: counts?.basic,   note: "subscribers" },
          { label: "Free",    value: counts?.free,    note: "accounts" },
          { label: "Banned",  value: counts?.banned,  note: "suspended" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-5">
            <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-2">{s.label}</p>
            <p className="font-display text-3xl font-light text-[var(--foreground)]">{s.value === undefined ? "—" : s.value.toLocaleString()}</p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">
              {counts?.partial && s.label !== "Total" ? `of newest ${counts.scanned.toLocaleString()}` : s.note}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls + " w-full pr-10 md:pr-8"}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-0 md:right-3 top-1/2 -translate-y-1/2 w-10 h-10 md:w-auto md:h-auto flex items-center justify-center text-[var(--foreground-subtle)]"
                aria-label="Clear search"
              >×</button>
            )}
          </div>
        </div>
        {/* Plan filter */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mr-1">Plan</span>
          {(["all", ...PLAN_OPTIONS] as const).map((p) => (
            <button key={p} onClick={() => setPlanFilter(p)} className={filterBtnCls(planFilter === p)}>
              {p}
            </button>
          ))}
        </div>
        {/* Status filter */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mr-1">Status</span>
          {STATUS_OPTIONS.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={filterBtnCls(statusFilter === s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 border border-[var(--border)] rounded-xl bg-[var(--surface)] px-4 py-3 mb-4">
          <span className="text-xs text-[var(--foreground-muted)]">
            {selected.size} selected
          </span>
          <div className="h-3 w-px bg-[var(--border)]" />
          <button
            onClick={() => bulkBan(true)}
            disabled={bulkLoading}
            className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] rounded-lg px-3 py-2 hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
          >
            Ban
          </button>
          <button
            onClick={() => bulkBan(false)}
            disabled={bulkLoading}
            className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] rounded-lg px-3 py-2 hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
          >
            Unban
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">Plan</span>
            <select
              value={bulkPlan}
              onChange={(e) => setBulkPlan(e.target.value as typeof PLAN_OPTIONS[number])}
              className="text-[9px] tracking-[0.1em] uppercase bg-transparent border border-[var(--border)] rounded-lg px-2 py-2 text-[var(--foreground)] outline-none"
            >
              {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              onClick={bulkSetPlan}
              disabled={bulkLoading}
              className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] rounded-lg px-3 py-2 hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
            >
              Apply
            </button>
          </div>
          <div className="h-3 w-px bg-[var(--border)]" />
          <button
            onClick={bulkDelete}
            disabled={bulkLoading}
            className="text-[9px] tracking-[0.14em] uppercase border border-red-500/40 rounded-lg px-3 py-2 text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-40"
          >
            Delete
          </button>
          <button
            onClick={() => setSelected(new Map())}
            className="ml-auto text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Bulk outcome — "N of M", with each failure; failed users stay selected */}
      {bulkResult && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 mb-4 text-xs ${
            bulkResult.errors.length
              ? "bg-red-400/15 text-red-500 border-red-400/30"
              : "bg-emerald-400/15 text-emerald-500 border-emerald-400/30"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <p>
              {bulkResult.action}: {bulkResult.ok} of {bulkResult.total} succeeded
              {bulkResult.errors.length ? " — the failed users are still selected." : "."}
            </p>
            <button
              onClick={() => setBulkResult(null)}
              className="text-[9px] tracking-[0.14em] uppercase opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
          {bulkResult.errors.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {bulkResult.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]" style={{ background: "var(--surface)" }}>
                {/* Checkbox select-all */}
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    ref={(el) => { if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected; }}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer"
                  />
                </th>
                {/* Below md only who, plan and status fit; the rest is one
                    tap away in the drawer the row opens. */}
                {([
                  ["User", ""],
                  ["Email", " hidden md:table-cell"],
                  ["Plan", ""],
                  ["Subscription", " hidden md:table-cell"],
                  ["Joined", " hidden md:table-cell"],
                  ["Last active", " hidden md:table-cell"],
                  ["Status", ""],
                  ["", ""],
                ] as const).map(([h, cls]) => (
                  <th key={h} className={`text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal${cls}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const label = rowLabel(u);
                const isSuper = u.isSuperAdmin;
                return (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedId(u.id)}
                    className={`border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors last:border-0 cursor-pointer ${selected.has(u.id) ? "bg-[var(--surface)]" : ""}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {!isSuper && (
                        <input
                          type="checkbox"
                          checked={selected.has(u.id)}
                          onChange={() => toggleSelect(u)}
                          className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.imageUrl ? (
                          <Image src={u.imageUrl} alt="" width={28} height={28} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-medium text-[var(--background)] bg-[var(--foreground-muted)] shrink-0">
                            {initials(u.firstName, u.lastName, u.email)}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-[var(--foreground)] truncate">{label}</span>
                          {u.email && label !== u.email && (
                            <span className="md:hidden text-[10px] text-[var(--foreground-subtle)] truncate">{u.email}</span>
                          )}
                          {isSuper ? (
                            <span className="text-[9px] tracking-[0.1em] uppercase text-amber-500">Super Admin</span>
                          ) : u.isAdmin ? (
                            <span className="text-[9px] tracking-[0.1em] uppercase text-emerald-500">Admin</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] truncate max-w-[240px] hidden md:table-cell">{u.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] tracking-[0.1em] uppercase px-2 py-1 ${planBadge[u.plan] ?? planBadge.free}`}>
                        {u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {u.subscription ? (
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-[10px] tracking-[0.06em] uppercase ${subStatusBadge[u.subscription.status] ?? "text-[var(--foreground-muted)]"}`}>
                            {u.subscription.status.replace("_", " ")} · {u.subscription.amountUah} ₴/mo
                          </span>
                          <span className="text-[10px] text-[var(--foreground-subtle)]">
                            {fmtDuration(u.subscription.startedAt)}
                            {u.subscription.currentPeriodEnd && u.subscription.status === "active"
                              ? ` · ${u.subscription.autoRenew ? "renews" : "ends"} ${fmtDate(Date.parse(u.subscription.currentPeriodEnd))}`
                              : ""}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--foreground-subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] hidden md:table-cell">{fmtDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] hidden md:table-cell">{fmtRelative(u.lastActiveAt ?? u.lastSignInAt)}</td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <span className="text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded-full bg-red-400/15 text-red-500 border border-red-400/30">Banned</span>
                      ) : u.locked ? (
                        <span className="text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded-full bg-amber-400/15 text-amber-500 border border-amber-400/30">Locked</span>
                      ) : (
                        <span className="text-[9px] tracking-[0.1em] uppercase px-2 py-1 rounded-full text-[var(--foreground-muted)] border border-[var(--border)]">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSuper ? (
                        <div className="flex justify-end">
                          <span className="text-[9px] tracking-[0.12em] uppercase text-amber-500 bg-amber-400/15 border border-amber-400/30 rounded-full px-2 py-1">Protected</span>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedId(u.id); }}
                            className="flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                            title="Edit"
                            aria-label="Edit user"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(u); }}
                            className="flex items-center justify-center text-[var(--foreground-muted)] hover:text-red-500 transition-colors"
                            title="Delete"
                            aria-label="Delete user"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                              <path d="M3 4H13M6 4V2H10V4M5 4L5.5 13H10.5L11 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && users.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">No users found</div>
        )}
        {loading && users.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">Loading…</div>
        )}
      </div>

      {/* Pagination — also shown for a single page when the filter scan was
          capped, so the "newest users only" caveat is never hidden. */}
      {(totalPages > 1 || listPartial) && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <span className="text-[10px] text-[var(--foreground-muted)]">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
            {listPartial ? " · filter covers the newest users only" : ""}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] rounded-lg px-4 py-2 text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] rounded-lg px-4 py-2 text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {selectedId && (
        <UserDrawer
          userId={selectedId}
          currentIsSuperAdmin={currentIsSuperAdmin}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
          onDeleted={(id) => {
            setSelected((prev) => { const next = new Map(prev); next.delete(id); return next; });
            setSelectedId(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function UserDrawer({
  userId,
  currentIsSuperAdmin,
  onClose,
  onUpdated,
  onDeleted,
}: {
  userId: string;
  currentIsSuperAdmin: boolean;
  onClose: () => void;
  onUpdated: (u: UserRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [plan, setPlan]           = useState<string>("free");
  const [isAdmin, setIsAdmin]     = useState(false);
  const [banned, setBanned]       = useState(false);

  interface UserStats {
    stylistMsgToday:  number;
    stylistMsgTotal:  number;
    stylistLimitDay:  number | null;
    stylistRemaining: number | null;
    imagesGenerated:  number;
    looksPublished:   number;
  }
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Escape closes the drawer, like the other modal layers.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [detailRes, statsRes] = await Promise.all([
          fetch(`/api/admin/users/${userId}`,        { cache: "no-store" }),
          fetch(`/api/admin/users/${userId}/stats`,  { cache: "no-store" }),
        ]);
        if (!detailRes.ok) throw new Error((await detailRes.json().catch(() => ({}))).error || `HTTP ${detailRes.status}`);
        const body = await detailRes.json() as UserDetail;
        if (cancelled) return;
        setDetail(body);
        setFirstName(body.firstName ?? "");
        setLastName(body.lastName ?? "");
        setPlan(body.plan);
        setIsAdmin(body.isAdmin);
        setBanned(body.banned);
        if (statsRes.ok) {
          setStats(await statsRes.json() as UserStats);
        } else {
          setStatsError((await statsRes.json().catch(() => ({}))).error || `HTTP ${statsRes.status}`);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const [resetting, setResetting] = useState(false);

  const resetStylistUsage = async (scope: "today" | "all") => {
    if (resetting) return;
    if (scope === "all" && !confirm(
      "Delete this user's entire AI Stylist message history? It also disappears from the AI-usage chart in Analytics and cannot be undone.\n\n" +
      "To lift today's limit, \"Reset today's limit\" is enough."
    )) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/stylist-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      // Refresh stats so the counter reflects the reset
      const statsRes = await fetch(`/api/admin/users/${userId}/stats`, { cache: "no-store" });
      if (statsRes.ok) setStats(await statsRes.json() as UserStats);
      else setError("Usage was reset, but the stats could not be refreshed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset usage");
    } finally {
      setResetting(false);
    }
  };

  const hasChanges =
    detail !== null && (
      firstName !== (detail.firstName ?? "") ||
      lastName  !== (detail.lastName ?? "")  ||
      plan      !== detail.plan              ||
      (currentIsSuperAdmin && !detail.adminViaEnv && isAdmin !== detail.isAdmin) ||
      banned    !== detail.banned
    );

  const save = async () => {
    if (!detail) return;
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = {};
      if (firstName !== (detail.firstName ?? "")) patch.firstName = firstName;
      if (lastName  !== (detail.lastName ?? ""))  patch.lastName  = lastName;
      if (plan      !== detail.plan)                             patch.plan    = plan;
      if (currentIsSuperAdmin && !detail.adminViaEnv && isAdmin !== detail.isAdmin) patch.isAdmin = isAdmin;
      if (banned    !== detail.banned)            patch.banned    = banned;
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const updated = await res.json() as UserRow;
      onUpdated(updated);
      setDetail({ ...detail, ...updated });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!detail) return;
    if (!confirm(`Delete ${rowLabel(detail)}? This permanently removes the Clerk account.${deleteSubscriptionWarning(detail.subscription)}`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      onDeleted(userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const displayName = detail ? rowLabel(detail) : "Loading…";

  const isSuperAdmin = detail?.isSuperAdmin ?? false;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-drawer-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md h-full overflow-y-auto overscroll-contain border-l border-[var(--border)] pb-[env(safe-area-inset-bottom)]"
        style={{ background: "var(--background)" }}
      >
        <div className="px-4 md:px-6 py-4 md:py-5 border-b border-[var(--border)] flex items-center justify-between gap-3 sticky top-0 z-10" style={{ background: "var(--background)" }}>
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">User Detail</p>
            <h2 id="user-drawer-title" className="font-display text-lg font-light text-[var(--foreground)] truncate max-w-[280px]">{displayName}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center shrink-0 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="px-6 py-10 text-xs text-[var(--foreground-subtle)]">Loading…</div>
        )}

        {error && (
          <div className="mx-6 my-4 rounded-xl border border-red-400/30 bg-red-400/15 text-red-500 text-xs px-3 py-2">{error}</div>
        )}

        {detail && !loading && (
          <div className="px-4 md:px-6 py-5 space-y-6">
            {isSuperAdmin && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-amber-500 flex-shrink-0">
                  <path d="M8 2L10 6H14L11 9L12 13L8 11L4 13L5 9L2 6H6L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                <p className="text-[10px] tracking-[0.1em] uppercase text-amber-500">
                  Super admin — this account is protected and cannot be modified.
                </p>
              </div>
            )}
            <div className="flex items-center gap-4">
              {detail.imageUrl ? (
                <Image src={detail.imageUrl} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 flex items-center justify-center text-sm font-medium text-[var(--background)] bg-[var(--foreground-muted)] rounded-full">
                  {initials(detail.firstName, detail.lastName, detail.email)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm text-[var(--foreground)] truncate">{detail.email ?? "No email"}</p>
                <p className="text-[10px] font-mono text-[var(--foreground-subtle)] truncate">{detail.id}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <MetaItem label="Joined"       value={fmtDate(detail.createdAt)} />
              <MetaItem label="Updated"      value={fmtDate(detail.updatedAt)} />
              <MetaItem label="Last sign-in" value={fmtRelative(detail.lastSignInAt)} />
              <MetaItem label="Last active"  value={fmtRelative(detail.lastActiveAt)} />
              <MetaItem label="2FA"          value={detail.twoFactorEnabled ? "Enabled" : "Disabled"} />
              <MetaItem label="Username"     value={detail.username ?? "—"} />
            </div>

            {/* Subscription (monobank billing ledger) */}
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Subscription</p>
              {detail.subscription ? (
                <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-[var(--foreground)] capitalize">{detail.subscription.plan} · {detail.subscription.amountUah} ₴/mo</span>
                    <span className={`text-[9px] tracking-[0.12em] uppercase ${subStatusBadge[detail.subscription.status] ?? "text-[var(--foreground-muted)]"}`}>
                      {detail.subscription.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs">
                    <MetaItem label="Subscribed for" value={fmtDuration(detail.subscription.startedAt)} />
                    <MetaItem label="Since"          value={fmtDate(Date.parse(detail.subscription.startedAt))} />
                    <MetaItem
                      label={detail.subscription.autoRenew ? "Next charge" : "Access until"}
                      value={detail.subscription.currentPeriodEnd ? fmtDate(Date.parse(detail.subscription.currentPeriodEnd)) : "—"}
                    />
                    <MetaItem label="Auto-renew" value={detail.subscription.autoRenew ? "On" : "Off"} />
                    {detail.subscription.maskedPan && (
                      <MetaItem label="Card" value={detail.subscription.maskedPan.replace(/\*+/, "··")} />
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--foreground-subtle)] border border-[var(--border)] rounded-xl px-4 py-3">
                  Never subscribed — plan is set manually or free.
                </p>
              )}
            </div>

            {/* Activity stats */}
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Activity</p>
              {!stats ? (
                <p className="text-xs text-[var(--foreground-subtle)] border border-[var(--border)] rounded-xl px-4 py-3">
                  Stats unavailable{statsError ? ` — ${statsError}` : ""}.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {/* AI Stylist today */}
                  <div className="border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">Stylist today</p>
                    <p className="font-display text-xl font-light text-[var(--foreground)]">
                      {stats.stylistMsgToday}
                      <span className="text-xs text-[var(--foreground-subtle)] ml-1 font-sans">
                        / {stats.stylistLimitDay === null ? "∞" : stats.stylistLimitDay}
                      </span>
                    </p>
                    <p className="text-[9px] text-[var(--foreground-muted)] mt-0.5">
                      {stats.stylistRemaining === null
                        ? "Unlimited"
                        : `${stats.stylistRemaining} left`}
                    </p>
                  </div>

                  {/* AI Stylist all-time */}
                  <div className="border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">Stylist total</p>
                    <p className="font-display text-xl font-light text-[var(--foreground)]">{stats.stylistMsgTotal}</p>
                    <p className="text-[9px] text-[var(--foreground-muted)] mt-0.5">messages sent</p>
                  </div>

                  {/* Images generated */}
                  <div className="border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">AI images</p>
                    <p className="font-display text-xl font-light text-[var(--foreground)]">{stats.imagesGenerated}</p>
                    <p className="text-[9px] text-[var(--foreground-muted)] mt-0.5">generated</p>
                  </div>

                  {/* Looks published */}
                  <div className="border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">Looks</p>
                    <p className="font-display text-xl font-light text-[var(--foreground)]">{stats.looksPublished}</p>
                    <p className="text-[9px] text-[var(--foreground-muted)] mt-0.5">published</p>
                  </div>
                </div>
              )}

              {/* Reset stylist limit */}
              {stats && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button
                    onClick={() => resetStylistUsage("today")}
                    disabled={resetting || stats.stylistMsgToday === 0}
                    className="text-[10px] tracking-[0.1em] uppercase border border-[var(--border)] hover:border-[var(--foreground)] rounded-full px-3 py-1.5 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resetting ? "Resetting…" : "Reset today's limit"}
                  </button>
                  <button
                    onClick={() => resetStylistUsage("all")}
                    disabled={resetting}
                    className="text-[10px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reset all-time
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Profile</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-[var(--foreground-subtle)]">First name</span>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] text-[var(--foreground-subtle)]">Last name</span>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                </label>
              </div>
            </div>

            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Plan</p>
              <div className="flex flex-wrap gap-1.5">
                {PLAN_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`text-[10px] tracking-[0.14em] uppercase px-3 py-2 border rounded-lg transition-colors capitalize ${
                      plan === p
                        ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                        : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {liveSubscription(detail.subscription) && (
                <p className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/15 text-amber-500 text-[10px] px-3 py-2">
                  Active subscription ({describeSubscription(detail.subscription)}). {PLAN_BILLING_NOTE}
                  {detail.subscription.autoRenew ? ` ${RENEWAL_NOTE}` : ""}
                </p>
              )}
            </div>

            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Access</p>
              <div className="space-y-2">
                {detail.adminViaEnv ? (
                  // ADMIN_USER_IDS grants access regardless of the metadata flag,
                  // so a toggle here would look like it revokes access and not.
                  <div className="px-3 py-2.5 border border-[var(--border)] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[var(--foreground)]">Admin</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">Granted via env (ADMIN_USER_IDS). Remove the id there to revoke.</p>
                    </div>
                    <span className="text-[9px] tracking-[0.12em] uppercase text-emerald-500 bg-emerald-400/15 border border-emerald-400/30 rounded-full px-2 py-1">Via env</span>
                  </div>
                ) : currentIsSuperAdmin ? (
                  <ToggleRow
                    label="Admin"
                    description="Grants access to /goo-studio. Only super admin can change this."
                    checked={isAdmin}
                    onChange={setIsAdmin}
                  />
                ) : detail.isAdmin ? (
                  <div className="px-3 py-2.5 border border-[var(--border)] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[var(--foreground)]">Admin</p>
                      <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">Only super admin can change this.</p>
                    </div>
                    <span className="text-[9px] tracking-[0.12em] uppercase text-emerald-500 bg-emerald-400/15 border border-emerald-400/30 rounded-full px-2 py-1">Enabled</span>
                  </div>
                ) : null}
                <ToggleRow label="Banned" description="Prevents the user from signing in." checked={banned} onChange={setBanned} danger />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--border)]">
              {!isSuperAdmin && (
                <button
                  onClick={del}
                  disabled={saving}
                  className="text-[10px] tracking-[0.14em] uppercase text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  Delete user
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={onClose}
                  className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] rounded-lg text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
                {!isSuperAdmin && (
                  <button
                    onClick={save}
                    disabled={!hasChanges || saving}
                    className="text-[10px] tracking-[0.14em] uppercase bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg hover:opacity-80 transition-opacity disabled:opacity-40"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">{label}</p>
      <p className="text-xs text-[var(--foreground)] truncate">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  danger,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between px-3 py-2.5 border border-[var(--border)] rounded-xl hover:border-[var(--border-strong)] transition-colors text-left"
    >
      <div>
        <p className={`text-xs ${danger && checked ? "text-red-500" : "text-[var(--foreground)]"}`}>{label}</p>
        <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{description}</p>
      </div>
      <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
        checked ? (danger ? "bg-red-500" : "bg-[var(--foreground)]") : "bg-[var(--border)]"
      }`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--background)] transition-[left] ${
          checked ? "left-[18px]" : "left-0.5"
        }`} />
      </div>
    </button>
  );
}
