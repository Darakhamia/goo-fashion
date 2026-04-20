"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

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
}

interface UserDetail extends UserRow {
  username: string | null;
  emailAddresses: { id: string; email: string; verified: boolean }[];
  updatedAt: number;
  twoFactorEnabled: boolean;
  publicMetadata: Record<string, unknown>;
}

const PLAN_OPTIONS = ["free", "plus", "ultra"] as const;

const planBadge: Record<string, string> = {
  free:  "border border-[var(--border)] text-[var(--foreground-muted)]",
  plus:  "bg-amber-400/15 text-amber-600 border border-amber-400/30",
  ultra: "bg-[var(--foreground)] text-[var(--background)]",
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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | typeof PLAN_OPTIONS[number]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (search)                qs.set("q", search);
      if (planFilter !== "all")  qs.set("plan", planFilter);
      qs.set("limit", "100");
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

  // Debounce search — 300ms
  useEffect(() => {
    const id = setTimeout(() => { load(); }, 300);
    return () => clearTimeout(id);
  }, [load]);

  const stats = useMemo(() => ({
    total,
    ultra:  users.filter((u) => u.plan === "ultra").length,
    plus:   users.filter((u) => u.plan === "plus").length,
    free:   users.filter((u) => u.plan === "free").length,
    banned: users.filter((u) => u.banned).length,
  }), [users, total]);

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
            {total.toLocaleString()} registered {error ? <span className="text-red-500"> · {error}</span> : null}
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total",  value: stats.total,  note: "registered" },
          { label: "Ultra",  value: stats.ultra,  note: "subscribers" },
          { label: "Plus",   value: stats.plus,   note: "subscribers" },
          { label: "Free",   value: stats.free,   note: "accounts" },
          { label: "Banned", value: stats.banned, note: "suspended" },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--background)] border border-[var(--border)] p-5">
            <p className="text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] mb-2">{s.label}</p>
            <p className="font-display text-3xl font-light text-[var(--foreground)]">{s.value}</p>
            <p className="text-[10px] text-[var(--foreground-muted)] mt-1">{s.note}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
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
        <div className="flex gap-1.5">
          {(["all", ...PLAN_OPTIONS] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`text-[9px] tracking-[0.14em] uppercase px-3 py-2.5 border transition-colors duration-200 capitalize ${
                planFilter === p
                  ? "border-[var(--foreground)] text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                  : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              {["User", "Email", "Plan", "Joined", "Last active", "Status", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[9px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)] font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const label = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || u.id;
              return (
                <tr
                  key={u.id}
                  onClick={() => setSelectedId(u.id)}
                  className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors last:border-0 cursor-pointer"
                >
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
                        {u.isAdmin && (
                          <span className="text-[9px] tracking-[0.1em] uppercase text-emerald-600">Admin</span>
                        )}
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">No users found</div>
        )}
        {loading && users.length === 0 && (
          <div className="py-16 text-center text-xs text-[var(--foreground-subtle)]">Loading…</div>
        )}
      </div>

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

  // Draft edits
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
            {/* Identity */}
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

            {/* Read-only metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <MetaItem label="Joined"       value={fmtDate(detail.createdAt)} />
              <MetaItem label="Updated"      value={fmtDate(detail.updatedAt)} />
              <MetaItem label="Last sign-in" value={fmtRelative(detail.lastSignInAt)} />
              <MetaItem label="Last active"  value={fmtRelative(detail.lastActiveAt)} />
              <MetaItem label="2FA"          value={detail.twoFactorEnabled ? "Enabled" : "Disabled"} />
              <MetaItem label="Username"     value={detail.username ?? "—"} />
            </div>

            {/* Editable name */}
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

            {/* Plan */}
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

            {/* Flags */}
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">Access</p>
              <div className="space-y-2">
                <ToggleRow label="Admin"  description="Grants access to /admin surfaces." checked={isAdmin} onChange={setIsAdmin} />
                <ToggleRow label="Banned" description="Prevents the user from signing in." checked={banned} onChange={setBanned} danger />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
              <button
                onClick={del}
                disabled={saving}
                className="text-[10px] tracking-[0.14em] uppercase text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                Delete user
              </button>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="text-[10px] tracking-[0.14em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] px-4 py-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={!hasChanges || saving}
                  className="text-[10px] tracking-[0.14em] uppercase bg-[var(--foreground)] text-[var(--background)] px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
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
