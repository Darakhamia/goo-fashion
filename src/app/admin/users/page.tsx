"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

const SUPER_ADMIN_ID = process.env.NEXT_PUBLIC_SUPER_ADMIN_USER_ID ?? "";
const PAGE_SIZE = 25;

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
  isSuperAdmin?: boolean;
}

interface UserDetail extends UserRow {
  username: string | null;
  emailAddresses: { id: string; email: string; verified: boolean }[];
  updatedAt: number;
  twoFactorEnabled: boolean;
  publicMetadata: Record<string, unknown>;
  isSuperAdmin: boolean;
}

const PLAN_OPTIONS = ["free", "basic", "pro", "premium"] as const;
const STATUS_OPTIONS = ["all", "active", "banned", "locked"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const planBadge: Record<string, string> = {
  free:    "border border-[var(--border)] text-[var(--foreground-muted)]",
  basic:   "border border-[var(--border-strong)] text-[var(--foreground)]",
  pro:     "bg-amber-400/15 text-amber-600 border border-amber-400/30",
  premium: "bg-[var(--foreground)] text-[var(--background)]",
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

const inputCls =
  "bg-transparent border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";

const filterBtnCls = (active: boolean) =>
  `text-[9px] tracking-[0.14em] uppercase px-3 py-2.5 border transition-colors duration-200 capitalize ${
    active
      ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
      : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
  }`;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | typeof PLAN_OPTIONS[number]>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Bulk state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkPlan, setBulkPlan] = useState<typeof PLAN_OPTIONS[number]>("free");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search)               qs.set("q", search);
      if (planFilter !== "all") qs.set("plan", planFilter);
      qs.set("limit", "200");
      const res = await fetch(`/api/admin/users?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const body = await res.json();
      setUsers(body.users);
      setTotal(body.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [search, planFilter]);

  useEffect(() => {
    const id = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(id);
  }, [load]);

  // Reset page when filters change
  useEffect(() => { setPage(0); setSelected(new Set()); }, [search, planFilter, statusFilter]);

  const stats = useMemo(() => ({
    total,
    premium: users.filter((u) => u.plan === "premium").length,
    pro:     users.filter((u) => u.plan === "pro").length,
    basic:   users.filter((u) => u.plan === "basic").length,
    free:    users.filter((u) => u.plan === "free").length,
    banned:  users.filter((u) => u.banned).length,
  }), [users, total]);

  const filteredUsers = useMemo(() => {
    if (statusFilter === "banned")  return users.filter((u) => u.banned);
    if (statusFilter === "locked")  return users.filter((u) => u.locked);
    if (statusFilter === "active")  return users.filter((u) => !u.banned && !u.locked);
    return users;
  }, [users, statusFilter]);

  const totalPages  = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const pagedUsers  = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const allOnPageSelected = pagedUsers.length > 0 && pagedUsers.every((u) => selected.has(u.id));
  const someOnPageSelected = pagedUsers.some((u) => selected.has(u.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pagedUsers.forEach((u) => next.delete(u.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        pagedUsers.forEach((u) => next.add(u.id));
        return next;
      });
    }
  };

  const isSuperAdmin = (u: UserRow) =>
    u.isSuperAdmin ?? (SUPER_ADMIN_ID ? u.id === SUPER_ADMIN_ID : false);

  const safeSelected = () =>
    [...selected].filter((id) => {
      const u = users.find((u) => u.id === id);
      return u && !isSuperAdmin(u);
    });

  const bulkBan = async (ban: boolean) => {
    const ids = safeSelected();
    if (!ids.length) return;
    if (!confirm(`${ban ? "Ban" : "Unban"} ${ids.length} user(s)?`)) return;
    setBulkLoading(true);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ banned: ban }),
        })
      )
    );
    setBulkLoading(false);
    setSelected(new Set());
    load();
  };

  const bulkSetPlan = async () => {
    const ids = safeSelected();
    if (!ids.length) return;
    if (!confirm(`Set plan to "${bulkPlan}" for ${ids.length} user(s)?`)) return;
    setBulkLoading(true);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/admin/users/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: bulkPlan }),
        })
      )
    );
    setBulkLoading(false);
    setSelected(new Set());
    load();
  };

  const bulkDelete = async () => {
    const ids = safeSelected();
    if (!ids.length) return;
    if (!confirm(`Permanently delete ${ids.length} user(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    await Promise.all(ids.map((id) => fetch(`/api/admin/users/${id}`, { method: "DELETE" })));
    setBulkLoading(false);
    setSelected(new Set());
    load();
  };

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Delete ${label}? This permanently removes the Clerk account.`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error || "Failed to delete");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleUpdated = (updated: UserRow) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Users</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {total.toLocaleString()} registered{error ? <span className="text-red-500"> · {error}</span> : null}
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

      {/* Stats — 6 cards in a 3-col / 6-col grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Total",   value: stats.total,   note: "registered" },
          { label: "Premium", value: stats.premium, note: "subscribers" },
          { label: "Pro",     value: stats.pro,     note: "subscribers" },
          { label: "Basic",   value: stats.basic,   note: "subscribers" },
          { label: "Free",    value: stats.free,    note: "accounts" },
          { label: "Banned",  value: stats.banned,  note: "suspended" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--background)] border border-[var(--border)] p-5">
            <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-2">{s.label}</p>
            <p className="font-display text-3xl font-light text-[var(--foreground)]">{s.value}</p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">{s.note}</p>
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
              className={inputCls + " w-full pr-8"}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--foreground-subtle)]"
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
        <div className="flex flex-wrap items-center gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-3 mb-4">
          <span className="text-xs text-[var(--foreground-muted)]">
            {selected.size} selected
          </span>
          <div className="h-3 w-px bg-[var(--border)]" />
          <button
            onClick={() => bulkBan(true)}
            disabled={bulkLoading}
            className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] px-3 py-2 hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
          >
            Ban
          </button>
          <button
            onClick={() => bulkBan(false)}
            disabled={bulkLoading}
            className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] px-3 py-2 hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
          >
            Unban
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">Plan</span>
            <select
              value={bulkPlan}
              onChange={(e) => setBulkPlan(e.target.value as typeof PLAN_OPTIONS[number])}
              className="text-[9px] tracking-[0.1em] uppercase bg-transparent border border-[var(--border)] px-2 py-2 text-[var(--foreground)] outline-none"
            >
              {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              onClick={bulkSetPlan}
              disabled={bulkLoading}
              className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] px-3 py-2 hover:border-[var(--border-strong)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
            >
              Apply
            </button>
          </div>
          <div className="h-3 w-px bg-[var(--border)]" />
          <button
            onClick={bulkDelete}
            disabled={bulkLoading}
            className="text-[9px] tracking-[0.14em] uppercase border border-red-500/40 px-3 py-2 text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-40"
          >
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
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
              {["User", "Email", "Plan", "Joined", "Last active", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedUsers.map((u) => {
              const label = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;
              const isSuper = isSuperAdmin(u);
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
                        onChange={() => toggleSelect(u.id)}
                        className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.imageUrl ? (
                        <Image src={u.imageUrl} alt="" width={28} height={28} className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 flex items-center justify-center text-[9px] font-medium text-[var(--background)] bg-[var(--foreground-muted)] shrink-0">
                          {initials(u.firstName, u.lastName, u.email)}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-[var(--foreground)] truncate">{label}</span>
                        {isSuper ? (
                          <span className="text-[9px] tracking-[0.1em] uppercase text-amber-500">Super Admin</span>
                        ) : u.isAdmin ? (
                          <span className="text-[9px] tracking-[0.1em] uppercase text-emerald-600">Admin</span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)] truncate max-w-[240px]">{u.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[9px] tracking-[0.1em] uppercase px-2 py-1 ${planBadge[u.plan] ?? planBadge.free}`}>
                      {u.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--foreground-muted)]">{fmtRelative(u.lastActiveAt ?? u.lastSignInAt)}</td>
                  <td className="px-4 py-3">
                    {u.banned ? (
                      <span className="text-[9px] tracking-[0.1em] uppercase px-2 py-1 bg-red-500/15 text-red-600 border border-red-500/30">Banned</span>
                    ) : u.locked ? (
                      <span className="text-[9px] tracking-[0.1em] uppercase px-2 py-1 bg-amber-500/15 text-amber-600 border border-amber-500/30">Locked</span>
                    ) : (
                      <span className="text-[9px] tracking-[0.1em] uppercase px-2 py-1 text-[var(--foreground-muted)] border border-[var(--border)]">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isSuper ? (
                      <div className="flex justify-end">
                        <span className="text-[8px] tracking-[0.12em] uppercase text-amber-500 border border-amber-400/30 px-2 py-1">Protected</span>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedId(u.id); }}
                          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                          title="Edit"
                          aria-label="Edit user"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                            <path d="M11 2L14 5L5 14H2V11L11 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(u.id, label); }}
                          className="text-[var(--foreground-muted)] hover:text-red-500 transition-colors"
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
        {!loading && filteredUsers.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">No users found</div>
        )}
        {loading && users.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">Loading…</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[10px] text-[var(--foreground-muted)]">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] px-4 py-2 text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="text-[9px] tracking-[0.14em] uppercase border border-[var(--border)] px-4 py-2 text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {selectedId && (
        <UserDrawer
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={handleUpdated}
          onDeleted={(id) => {
            setUsers((prev) => prev.filter((u) => u.id !== id));
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

function UserDrawer({
  userId,
  onClose,
  onUpdated,
  onDeleted,
}: {
  userId: string;
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
        const body = await res.json() as UserDetail;
        if (cancelled) return;
        setDetail(body);
        setFirstName(body.firstName ?? "");
        setLastName(body.lastName ?? "");
        setPlan(body.plan);
        setIsAdmin(body.isAdmin);
        setBanned(body.banned);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const hasChanges =
    detail !== null && (
      firstName !== (detail.firstName ?? "") ||
      lastName  !== (detail.lastName ?? "")  ||
      plan      !== detail.plan              ||
      isAdmin   !== detail.isAdmin           ||
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
      if (plan      !== detail.plan)              patch.plan      = plan;
      if (isAdmin   !== detail.isAdmin)           patch.isAdmin   = isAdmin;
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
    const label = [detail.firstName, detail.lastName].filter(Boolean).join(" ") || detail.email || detail.id;
    if (!confirm(`Delete ${label}? This permanently removes the Clerk account.`)) return;
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

  const displayName = detail
    ? ([detail.firstName, detail.lastName].filter(Boolean).join(" ") || detail.email || detail.id)
    : "Loading…";

  const isSuperAdmin = detail
    ? (detail.isSuperAdmin ?? (SUPER_ADMIN_ID ? detail.id === SUPER_ADMIN_ID : false))
    : false;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md h-full overflow-y-auto border-l border-[var(--border)]"
        style={{ background: "var(--background)" }}
      >
        <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between sticky top-0 z-10" style={{ background: "var(--background)" }}>
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)]">User Detail</p>
            <h2 className="font-display text-lg font-light text-[var(--foreground)] truncate max-w-[280px]">{displayName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
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
          <div className="mx-6 my-4 border border-red-500/40 bg-red-500/5 text-red-600 text-xs px-3 py-2">{error}</div>
        )}

        {detail && !loading && (
          <div className="px-6 py-5 space-y-6">
            {isSuperAdmin && (
              <div className="flex items-center gap-3 border border-amber-400/30 bg-amber-400/8 px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-amber-500 flex-shrink-0">
                  <path d="M8 2L10 6H14L11 9L12 13L8 11L4 13L5 9L2 6H6L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                <p className="text-[10px] tracking-[0.1em] uppercase text-amber-600">
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

            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Profile</p>
              <div className="grid grid-cols-2 gap-3">
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
              <div className="flex gap-1.5">
                {PLAN_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`text-[10px] tracking-[0.14em] uppercase px-3 py-2 border transition-colors capitalize ${
                      plan === p
                        ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                        : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Access</p>
              <div className="space-y-2">
                <ToggleRow label="Admin"  description="Grants access to /admin surfaces." checked={isAdmin} onChange={setIsAdmin} />
                <ToggleRow label="Banned" description="Prevents the user from signing in." checked={banned} onChange={setBanned} danger />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
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
                  className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
                {!isSuperAdmin && (
                  <button
                    onClick={save}
                    disabled={!hasChanges || saving}
                    className="text-[10px] tracking-[0.14em] uppercase bg-[var(--foreground)] text-[var(--background)] px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
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
      className="w-full flex items-center justify-between px-3 py-2.5 border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors text-left"
    >
      <div>
        <p className={`text-xs ${danger && checked ? "text-red-500" : "text-[var(--foreground)]"}`}>{label}</p>
        <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{description}</p>
      </div>
      <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
        checked ? (danger ? "bg-red-500" : "bg-[var(--foreground)]") : "bg-[var(--border)]"
      }`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--background)] transition-all ${
          checked ? "left-[18px]" : "left-0.5"
        }`} />
      </div>
    </button>
  );
}
