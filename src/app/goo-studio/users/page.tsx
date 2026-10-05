"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "@/components/ui/Image";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { btn, BTN_ICON, BTN_ICON_SM } from "@/app/goo-studio/_ui/recipes";
import { useT } from "@/app/goo-studio/_i18n";
import type { Key, T } from "@/app/goo-studio/_i18n";
import { DataTable, EmptyState } from "@/components/admin/DataTable";
import type { Column } from "@/components/admin/DataTable";
import { ActiveFilters, FilterChips, FilterMenu, SearchField } from "@/components/admin/FilterBar";
import { BulkBar } from "@/components/admin/BulkBar";
import { RowMenu } from "@/components/admin/Menu";
import type { MenuItem } from "@/components/admin/Menu";
import { Badge } from "@/components/admin/Badge";

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

const PLAN_OPTIONS = ["free", "basic", "pro", "premium"] as const;
type StatusFilter = "all" | "active" | "banned" | "locked";

const STATUS_KEY: Record<Exclude<StatusFilter, "all">, Key> = {
  active: "users.status.active",
  banned: "users.status.banned",
  locked: "users.status.locked",
};

const PLAN_LABEL: Record<string, string> = {
  free:    "Free",
  basic:   "Basic",
  pro:     "Pro",
  premium: "Premium",
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

/**
 * A subscription the billing ledger still treats as live: active, or past_due
 * after a failed renewal. Only an active one is ever charged again — the
 * renewal cron picks up `active` rows only and never retries a past_due one.
 */
function liveSubscription(s: UserSubscription | null | undefined): s is UserSubscription {
  return !!s && (s.status === "active" || s.status === "past_due");
}

/** Whether the renewal cron will charge this subscription again. */
function renewsAutomatically(s: UserSubscription | null | undefined): boolean {
  return !!s && s.status === "active" && s.autoRenew;
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
// row is untouched, so an active auto-renewing subscription keeps charging and
// its next renewal puts the paid plan back. A past_due one is not retried.
const PLAN_BILLING_NOTE = "Only the plan in Clerk changes — billing does not.";
const RENEWAL_NOTE = "Charges continue, and the next renewal restores the paid plan.";
const PAST_DUE_NOTE = "Its last renewal failed and is not retried, so nothing puts the paid plan back on its own.";

function deleteSubscriptionWarning(s: UserSubscription | null | undefined): string {
  if (!liveSubscription(s)) return "";
  return ` This user has an active subscription (${describeSubscription(s)}). ` +
    "Auto-renew is turned off before the account is deleted, so the saved card is not charged again.";
}

const SUB_STATUS_LABEL: Record<string, string> = {
  active:   "Active",
  pending:  "Pending",
  past_due: "Past due",
  canceled: "Canceled",
};

const subStatusBadge: Record<string, string> = {
  active:   "text-[var(--ok)]",
  pending:  "text-[var(--warn)]",
  past_due: "text-[var(--err)]",
  canceled: "text-[var(--foreground-subtle)]",
};

const inputCls =
  "bg-transparent border border-[var(--border)] rounded-lg focus:border-[var(--foreground)] outline-none px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] transition-colors";

/** A paid period that ended with no renewal after it: the account still has the plan. */
function isOverdue(s: UserSubscription | null | undefined): s is UserSubscription {
  return !!s && s.status === "active" && !!s.currentPeriodEnd && Date.parse(s.currentPeriodEnd) < Date.now();
}

/** "Sep 10" this year, "Sep 10, 2025" before it. */
function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/** The state worth a badge (ADMIN_DESIGN 5.4): none for an active account in good standing. */
function statusBadge(u: UserRow, t: T) {
  if (u.banned) return <Badge tone="err">{t("users.badge.banned")}</Badge>;
  if (u.locked) return <Badge tone="warn">{t("users.badge.locked")}</Badge>;
  if (u.subscription?.status === "past_due") return <Badge tone="err">{t("users.badge.pastDue")}</Badge>;
  if (isOverdue(u.subscription)) return <Badge tone="warn">{t("users.badge.overdue")}</Badge>;
  return null;
}

/**
 * The plan in one line: "Free", "Basic · 399 ₴/mo", "Basic · 399 ₴/mo ·
 * overdue since Sep 10". A paid plan with no subscription behind it was set by
 * hand and says so.
 */
function PlanCell({ u, t }: { u: UserRow; t: T }) {
  const s = u.subscription;
  const name = PLAN_LABEL[u.plan] ?? u.plan;
  const billed = s && s.status !== "canceled" ? s : null;
  if (!billed) {
    if (u.plan === "free") return <span className="text-[var(--foreground-muted)]">{name}</span>;
    return (
      <span className="inline-flex items-center gap-1.5">
        {name}
        {/* From md: on a phone the column keeps to the plan's name. */}
        <span className="hidden md:contents">
          <Badge title={t("users.badge.manualHint")}>{t("users.badge.manual")}</Badge>
        </span>
      </span>
    );
  }
  // What is billed: a payment still pending can be for a plan Clerk does not show yet.
  const billedName = PLAN_LABEL[billed.plan] ?? billed.plan;
  const problem =
    billed.status === "past_due"
      ? { text: t("users.sub.pastDue"), tone: "text-[var(--err)]" }
      : billed.status === "pending"
        ? { text: t("users.sub.pending", { date: fmtShortDate(billed.startedAt) }), tone: "" }
        : isOverdue(billed)
          ? { text: t("users.sub.overdue", { date: fmtShortDate(billed.currentPeriodEnd!) }), tone: "text-[var(--warn)]" }
          : null;
  // On a phone the column keeps to the plan's name, and the badge under the
  // user's name carries the problem.
  return (
    <span className={problem?.tone}>
      {billedName}
      <span className="hidden md:inline">
        {" "}
        · {t("users.sub.perMonth", { amount: billed.amountUah })}
        {problem && <> · {problem.text}</>}
      </span>
    </span>
  );
}

function Avatar({ u }: { u: UserRow }) {
  if (u.imageUrl) {
    return <Image src={u.imageUrl} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <span
      aria-hidden="true"
      className="w-8 h-8 flex-shrink-0 rounded-full inline-flex items-center justify-center text-[11px] font-semibold text-[var(--foreground)] bg-[var(--fg-overlay-08)]"
    >
      {initials(u.firstName, u.lastName, u.email)}
    </span>
  );
}

const PENCIL = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M11 2.5L13.5 5 6 12.5l-3 .5.5-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export default function AdminUsersPage() {
  const t = useT();
  const confirm = useConfirm();
  const toast = useToast();
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
  /** Failures of the last bulk run, one line per user; the users stay selected. */
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

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

  const selectableOnPage = users.filter((u) => !u.isSuperAdmin);
  const allOnPageSelected = selectableOnPage.length > 0 && selectableOnPage.every((u) => selected.has(u.id));
  const someOnPageSelected = selectableOnPage.some((u) => selected.has(u.id));

  const toggleSelect = (id: string) => {
    const u = users.find((x) => x.id === id);
    if (!u) return;
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
    setBulkErrors([]);
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
      const vars = { action, ok: rows.length - failed.size, total: rows.length };
      if (errors.length) {
        toast.err(t("users.bulk.failed", vars));
        setBulkErrors(errors);
      } else {
        toast.ok(t("users.bulk.done", vars));
      }
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
    const count = rows.length;
    if (!(await confirm({
      title: t(ban ? "users.confirm.ban" : "users.confirm.unban", { count }),
      confirmLabel: t(ban ? "users.confirm.banAction" : "users.confirm.unbanAction", { count }),
      tone: ban ? "danger" : undefined,
    }))) return;
    await runBulk(t(ban ? "users.bulk.ban" : "users.bulk.unban"), rows, patchUser({ banned: ban }));
  };

  const bulkSetPlan = async (plan: typeof PLAN_OPTIONS[number]) => {
    const rows = safeSelected();
    if (!rows.length) return;
    const paying = rows.filter((u) => liveSubscription(u.subscription));
    const renewing = paying.some((u) => renewsAutomatically(u.subscription));
    const warn = paying.length
      ? `${paying.length} of them ${paying.length === 1 ? "has" : "have"} an active subscription (${listLabels(paying)}). ` +
        `${PLAN_BILLING_NOTE}${renewing ? ` ${RENEWAL_NOTE}` : ""}`
      : "";
    const count = rows.length;
    const planName = PLAN_LABEL[plan];
    if (!(await confirm({
      title: t("users.confirm.plan", { plan: planName, count }),
      body: warn || undefined,
      confirmLabel: t("users.confirm.planAction", { count }),
    }))) return;
    await runBulk(t("users.bulk.planDone", { plan: planName }), rows, patchUser({ plan }));
  };

  const bulkDelete = async () => {
    const rows = safeSelected();
    if (!rows.length) return;
    const paying = rows.filter((u) => liveSubscription(u.subscription));
    const warn = paying.length
      ? ` ${paying.length} of them ${paying.length === 1 ? "has" : "have"} an active subscription (${listLabels(paying)}). ` +
        "Auto-renew is turned off before each account is deleted, so saved cards are not charged again."
      : "";
    const count = rows.length;
    if (!(await confirm({
      title: t("users.confirm.delete", { count }),
      body: `${t("users.confirm.deleteBody")}${warn}`,
      confirmLabel: t("users.confirm.deleteAction", { count }),
      tone: "danger",
    }))) return;
    await runBulk(t("users.bulk.deleteDone"), rows, (id) => fetch(`/api/admin/users/${id}`, { method: "DELETE" }));
  };

  const banOne = async (u: UserRow, ban: boolean) => {
    if (!(await confirm({
      title: t(ban ? "users.confirm.banOne" : "users.confirm.unbanOne", { name: rowLabel(u) }),
      confirmLabel: t(ban ? "users.row.ban" : "users.row.unban"),
      tone: ban ? "danger" : undefined,
    }))) return;
    const res = await patchUser({ banned: ban })(u.id);
    if (!res.ok) {
      toast.err((await res.json().catch(() => ({}))).error || t("users.saveFailed"));
      return;
    }
    toast.ok(t(ban ? "users.banned" : "users.unbanned", { name: rowLabel(u) }));
    refresh();
  };

  const handleDelete = async (u: UserRow) => {
    if (!(await confirm({
      title: t("users.confirm.deleteOne", { name: rowLabel(u) }),
      body: `This permanently removes the Clerk account.${deleteSubscriptionWarning(u.subscription)}`,
      confirmLabel: t("users.confirm.deleteOneAction"),
      tone: "danger",
    }))) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.err((await res.json().catch(() => ({}))).error || t("users.deleteFailed"));
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

  // ── Filters ───────────────────────────────────────────────────────────────

  const planChips = [
    { value: "all", label: t("filter.all"), count: counts?.total },
    ...PLAN_OPTIONS.map((p) => ({ value: p, label: PLAN_LABEL[p], count: counts?.[p] })),
  ];

  const statusOptions = (["active", "banned", "locked"] as const).map((s) => ({ value: s, label: t(STATUS_KEY[s]) }));

  const activeFilters = [
    ...(planFilter !== "all"
      ? [{ key: "plan", label: `${t("users.col.plan")}: ${PLAN_LABEL[planFilter]}`, onRemove: () => setPlanFilter("all") }]
      : []),
    ...(statusFilter !== "all"
      ? [{ key: "status", label: `${t("users.f.status")}: ${t(STATUS_KEY[statusFilter])}`, onRemove: () => setStatusFilter("all") }]
      : []),
  ];
  const filtered = search !== "" || activeFilters.length > 0;

  // ── Table ─────────────────────────────────────────────────────────────────

  const rowItems = (u: UserRow): MenuItem[] => [
    // Also an icon beside the menu, and the row's own click; on a phone the
    // icon gives its room to the name.
    { label: t("users.row.openShort"), onSelect: () => setSelectedId(u.id) },
    { label: t(u.banned ? "users.row.unban" : "users.row.ban"), onSelect: () => void banOne(u, !u.banned) },
    { kind: "separator" },
    { label: t("users.row.delete"), onSelect: () => void handleDelete(u), tone: "danger" },
  ];

  const columns: Column<UserRow>[] = [
    {
      key: "user",
      header: t("users.col.user"),
      grow: true,
      cell: (u) => {
        const named = !!(u.firstName || u.lastName);
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar u={u} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`font-medium truncate ${named ? "" : "text-[var(--foreground-muted)]"}`} title={named ? name : undefined}>
                  {named ? name : t("users.noName")}
                </span>
                {/* Badges by the name from md; on a phone the name needs the
                    room, and the state that needs action moves under it. */}
                <span className="hidden md:contents">
                  {(u.isSuperAdmin || u.isAdmin) && <Badge>{t(u.isSuperAdmin ? "users.badge.superAdmin" : "users.badge.team")}</Badge>}
                  {statusBadge(u, t)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 text-[12px] text-[var(--foreground-muted)]">
                <span className="md:hidden contents">{statusBadge(u, t)}</span>
                <span className="truncate" title={u.email ?? undefined}>
                  {u.email ?? "—"}
                </span>
              </div>
            </div>
          </div>
        );
      },
    },
    { key: "plan", header: t("users.col.plan"), cell: (u) => <PlanCell u={u} t={t} /> },
    {
      key: "joined",
      header: t("users.col.joined"),
      hide: "md",
      cell: (u) => <span className="text-[var(--foreground-muted)]">{fmtDate(u.createdAt)}</span>,
    },
    {
      key: "active",
      header: t("users.col.lastActive"),
      hide: "md",
      cell: (u) => <span className="text-[var(--foreground-muted)]">{fmtRelative(u.lastActiveAt ?? u.lastSignInAt)}</span>,
    },
  ];

  const subtitle = [
    counts ? t("users.count", { count: counts.total }) : null,
    counts?.banned ? t("users.bannedCount", { count: counts.banned }) : null,
    counts?.partial ? t("users.countsPartial", { count: counts.scanned }) : null,
  ].filter(Boolean);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">{t("nav.users")}</h1>
          <p className="text-[13px] text-[var(--foreground-muted)] mt-1">
            {subtitle.length ? subtitle.join(" · ") : "—"}
            {countsError ? <span className="text-[var(--err)]"> · {t("users.countsFailed", { error: countsError })}</span> : null}
            {subsError ? <span className="text-[var(--err)]"> · {t("users.subsFailed", { error: subsError })}</span> : null}
          </p>
        </div>
        <button onClick={refresh} disabled={loading} className={btn("secondary")}>
          {loading ? t("common.loading") : t("users.refresh")}
        </button>
      </div>

      {/* Search, the plans as chips with their counts (they were six cards),
          and the state. Counted on the server across all users. */}
      <div className="mb-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={search} onChange={setSearch} placeholder={t("users.search.placeholder")} label={t("users.search.label")} />
          <FilterChips
            label={t("users.col.plan")}
            value={planFilter}
            options={planChips}
            onChange={(v) => setPlanFilter(v as typeof planFilter)}
          />
          <FilterMenu
            label={t("users.f.status")}
            value={statusFilter === "all" ? "" : statusFilter}
            options={statusOptions}
            onChange={(v) => setStatusFilter((v || "all") as StatusFilter)}
            allLabel={t("users.status.any")}
          />
        </div>
        {filtered && (
          <ActiveFilters
            filters={activeFilters}
            onClearAll={() => {
              setPlanFilter("all");
              setStatusFilter("all");
            }}
            count={loading ? null : t("users.found", { count: total })}
          />
        )}
      </div>

      {/* The failures of the last bulk run, by user; those users stay selected. */}
      {bulkErrors.length > 0 && (
        <div role="alert" className="mb-4 rounded-xl border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-3 text-[13px] text-[var(--err)]">
          <div className="flex items-start justify-between gap-3">
            <ul className="space-y-0.5 min-w-0 break-words">
              {bulkErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
            <button onClick={() => setBulkErrors([])} className={`${BTN_ICON} flex-shrink-0`} aria-label={t("common.dismiss")}>
              ×
            </button>
          </div>
        </div>
      )}

      <DataTable
        label={t("nav.users")}
        rows={users}
        rowKey={(u) => u.id}
        columns={columns}
        loading={loading && users.length === 0}
        pageSize={PAGE_SIZE}
        // Only one page comes from the server at a time; a scan that was cut
        // short says so even on one page, so the caveat is never hidden.
        paging={{ page, total, onPage: setPage, note: listPartial ? t("users.listPartial") : undefined }}
        onRowClick={(u) => setSelectedId(u.id)}
        selection={{
          selected: new Set(selected.keys()),
          onToggle: (id) => toggleSelect(id),
          onToggleAll: toggleSelectAll,
          allSelected: allOnPageSelected,
          someSelected: someOnPageSelected,
          rowLabel,
          canSelect: (u) => !u.isSuperAdmin,
        }}
        actions={(u) => (
          <>
            <button
              onClick={() => setSelectedId(u.id)}
              // A super admin has no menu, so the button stays on a phone too.
              className={u.isSuperAdmin ? BTN_ICON_SM : `${BTN_ICON_SM} max-md:hidden`}
              aria-label={t("users.row.open", { name: rowLabel(u) })}
              title={t("users.row.open", { name: rowLabel(u) })}
            >
              {PENCIL}
            </button>
            {!u.isSuperAdmin && <RowMenu size="sm" label={t("menu.moreFor", { name: rowLabel(u) })} items={rowItems(u)} />}
          </>
        )}
        empty={
          error ? (
            <div role="alert" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
              <p className="text-[13px] text-[var(--err)] break-words">{error}</p>
              <button onClick={refresh} className={btn("secondary")}>
                {t("products.retry")}
              </button>
            </div>
          ) : (
            <EmptyState
              text={t(filtered ? "users.empty.filtered" : "users.empty.none")}
              action={
                activeFilters.length > 0 ? (
                  <button
                    onClick={() => {
                      setPlanFilter("all");
                      setStatusFilter("all");
                    }}
                    className={btn("secondary")}
                  >
                    {t("products.clearFilters")}
                  </button>
                ) : undefined
              }
            />
          )
        }
      />

      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Map())}
        actions={[
          { key: "ban", label: t("users.bulk.ban"), onClick: () => void bulkBan(true), disabled: bulkLoading },
          { key: "unban", label: t("users.bulk.unban"), onClick: () => void bulkBan(false), disabled: bulkLoading },
          {
            key: "plan",
            label: t("users.bulk.plan"),
            disabled: bulkLoading,
            menu: PLAN_OPTIONS.map((p) => ({ label: PLAN_LABEL[p], onSelect: () => void bulkSetPlan(p) })),
          },
          { key: "delete", label: t("users.bulk.delete"), onClick: () => void bulkDelete(), disabled: bulkLoading, tone: "danger" },
        ]}
      />

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
  const confirm = useConfirm();
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
    if (scope === "all" && !(await confirm({
      title: "Delete this user's entire AI Stylist message history?",
      body: "It also disappears from the AI-usage chart in Analytics and cannot be undone. " +
        "To lift today's limit, \"Reset today's limit\" is enough.",
      confirmLabel: "Delete message history",
      tone: "danger",
    }))) return;
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
    if (!(await confirm({
      title: `Delete ${rowLabel(detail)}?`,
      body: `This permanently removes the Clerk account.${deleteSubscriptionWarning(detail.subscription)}`,
      confirmLabel: "Delete user",
      tone: "danger",
    }))) return;
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
        style={{ background: "var(--surface)" }}
      >
        <div className="px-4 md:px-6 py-4 md:py-5 border-b border-[var(--border)] flex items-center justify-between gap-3 sticky top-0 z-10" style={{ background: "var(--surface)" }}>
          <div className="min-w-0">
            <p className="text-[12px] text-[var(--foreground-muted)]">User detail</p>
            <h2 id="user-drawer-title" className="font-display text-lg font-light text-[var(--foreground)] truncate max-w-[280px]">{displayName}</h2>
          </div>
          <button
            onClick={onClose}
            className={`${BTN_ICON} shrink-0`}
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
          <div className="mx-6 my-4 rounded-xl border border-[var(--err-line)] bg-[var(--err-bg)] text-[var(--err)] text-xs px-3 py-2">{error}</div>
        )}

        {detail && !loading && (
          <div className="px-4 md:px-6 py-5 space-y-6">
            {isSuperAdmin && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-[var(--warn)] flex-shrink-0">
                  <path d="M8 2L10 6H14L11 9L12 13L8 11L4 13L5 9L2 6H6L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
                <p className="text-[12px] text-[var(--warn)]">
                  Super admin — this account is protected and cannot be modified.
                </p>
              </div>
            )}
            <div className="flex items-center gap-4">
              {detail.imageUrl ? (
                <Image src={detail.imageUrl} alt="" width={56} height={56} className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 flex items-center justify-center text-sm font-medium text-[var(--surface)] bg-[var(--foreground-muted)] rounded-full">
                  {initials(detail.firstName, detail.lastName, detail.email)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm text-[var(--foreground)] truncate">{detail.email ?? "No email"}</p>
                <p className="text-[12px] font-mono text-[var(--foreground-subtle)] truncate">{detail.id}</p>
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
              <p className="text-[13px] font-medium text-[var(--foreground)] mb-3">Subscription</p>
              {detail.subscription ? (
                <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-[var(--foreground)]"><span className="capitalize">{detail.subscription.plan}</span> · {detail.subscription.amountUah} ₴/mo</span>
                    <span className={`text-[11px] font-medium ${subStatusBadge[detail.subscription.status] ?? "text-[var(--foreground-muted)]"}`}>
                      {SUB_STATUS_LABEL[detail.subscription.status] ?? detail.subscription.status.replace("_", " ")}
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
              <p className="text-[13px] font-medium text-[var(--foreground)] mb-3">Activity</p>
              {!stats ? (
                <p className="text-xs text-[var(--foreground-subtle)] border border-[var(--border)] rounded-xl px-4 py-3">
                  Stats unavailable{statsError ? ` — ${statsError}` : ""}.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {/* AI Stylist today */}
                  <div className="border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] mb-1">Stylist today</p>
                    <p className="font-display text-xl font-light text-[var(--foreground)]">
                      {stats.stylistMsgToday}
                      <span className="text-xs text-[var(--foreground-subtle)] ml-1 font-sans">
                        / {stats.stylistLimitDay === null ? "∞" : stats.stylistLimitDay}
                      </span>
                    </p>
                    <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">
                      {stats.stylistRemaining === null
                        ? "Unlimited"
                        : `${stats.stylistRemaining} left`}
                    </p>
                  </div>

                  {/* AI Stylist all-time */}
                  <div className="border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] mb-1">Stylist total</p>
                    <p className="font-display text-xl font-light text-[var(--foreground)]">{stats.stylistMsgTotal}</p>
                    <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">messages sent</p>
                  </div>

                  {/* Images generated */}
                  <div className="border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] mb-1">AI images</p>
                    <p className="font-display text-xl font-light text-[var(--foreground)]">{stats.imagesGenerated}</p>
                    <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">generated</p>
                  </div>

                  {/* Looks published */}
                  <div className="border border-[var(--border)] rounded-xl p-3">
                    <p className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] mb-1">Looks</p>
                    <p className="font-display text-xl font-light text-[var(--foreground)]">{stats.looksPublished}</p>
                    <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">published</p>
                  </div>
                </div>
              )}

              {/* Reset stylist limit */}
              {stats && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button
                    onClick={() => resetStylistUsage("today")}
                    disabled={resetting || stats.stylistMsgToday === 0}
                    className={btn("secondary")}
                  >
                    {resetting ? "Resetting…" : "Reset today's limit"}
                  </button>
                  <button
                    onClick={() => resetStylistUsage("all")}
                    disabled={resetting}
                    className={btn("ghost")}
                  >
                    Reset all-time
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="text-[13px] font-medium text-[var(--foreground)] mb-3">Profile</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-[var(--foreground-muted)]">First name</span>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-[var(--foreground-muted)]">Last name</span>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
                </label>
              </div>
            </div>

            <div>
              <p className="text-[13px] font-medium text-[var(--foreground)] mb-3">Plan</p>
              <div className="flex flex-wrap gap-1.5">
                {PLAN_OPTIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlan(p)}
                    className={`text-[13px] font-medium px-3 py-2 border rounded-lg transition-colors capitalize ${
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
                <p className="mt-2 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] text-[var(--warn)] text-[12px] px-3 py-2">
                  Active subscription ({describeSubscription(detail.subscription)}). {PLAN_BILLING_NOTE}
                  {renewsAutomatically(detail.subscription)
                    ? ` ${RENEWAL_NOTE}`
                    : detail.subscription.status === "past_due" ? ` ${PAST_DUE_NOTE}` : ""}
                </p>
              )}
            </div>

            <div>
              <p className="text-[13px] font-medium text-[var(--foreground)] mb-3">Access</p>
              <div className="space-y-2">
                {detail.adminViaEnv ? (
                  // ADMIN_USER_IDS grants access regardless of the metadata flag,
                  // so a toggle here would look like it revokes access and not.
                  <div className="px-3 py-2.5 border border-[var(--border)] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[var(--foreground)]">Admin</p>
                      <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5">Granted via env (ADMIN_USER_IDS). Remove the id there to revoke.</p>
                    </div>
                    <span className="text-[11px] font-medium text-[var(--ok)] bg-[var(--ok-bg)] border border-[var(--ok-line)] rounded-full px-2 py-1">Via env</span>
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
                      <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5">Only super admin can change this.</p>
                    </div>
                    <span className="text-[11px] font-medium text-[var(--ok)] bg-[var(--ok-bg)] border border-[var(--ok-line)] rounded-full px-2 py-1">Enabled</span>
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
                  className={btn("danger")}
                >
                  Delete user
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={onClose}
                  className={btn("ghost")}
                >
                  Cancel
                </button>
                {!isSuperAdmin && (
                  <button
                    onClick={save}
                    disabled={!hasChanges || saving}
                    className={btn("primary")}
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
      <p className="text-[12px] text-[var(--foreground-muted)] mb-1">{label}</p>
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
        <p className={`text-xs ${danger && checked ? "text-[var(--err)]" : "text-[var(--foreground)]"}`}>{label}</p>
        <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5">{description}</p>
      </div>
      <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
        checked ? (danger ? "bg-[var(--err)]" : "bg-[var(--foreground)]") : "bg-[var(--border)]"
      }`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface)] transition-[left] ${
          checked ? "left-[18px]" : "left-0.5"
        }`} />
      </div>
    </button>
  );
}
