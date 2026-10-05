"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Image from "@/components/ui/Image";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { BANNER, btn, BTN_ICON, BTN_ICON_SM, FIELD_LABEL, INPUT } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT } from "@/app/goo-studio/_i18n";
import type { Format, Key, T, Vars } from "@/app/goo-studio/_i18n";
import { DataTable, EmptyState } from "@/components/admin/DataTable";
import type { Column } from "@/components/admin/DataTable";
import { ActiveFilters, FilterChips, FilterMenu, SearchField } from "@/components/admin/FilterBar";
import { BulkBar } from "@/components/admin/BulkBar";
import { RowMenu } from "@/components/admin/Menu";
import type { MenuItem } from "@/components/admin/Menu";
import { Badge } from "@/components/admin/Badge";
import type { BadgeTone } from "@/components/admin/Badge";
import { PageHeader } from "@/components/admin/PageHeader";
import { SidePanel } from "@/components/admin/SidePanel";

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

const PLAN_KEY: Record<string, Key> = {
  free:    "plan.free",
  basic:   "plan.basic",
  pro:     "plan.pro",
  premium: "plan.premium",
};

/** A plan's name; one this screen does not know shows as stored. */
function planName(plan: string, t: T): string {
  const key = PLAN_KEY[plan];
  return key ? t(key) : plan;
}

/**
 * An error to show. The server's own words stay as they came; one of ours is
 * kept as its dictionary key, so it follows a language switch without the
 * loaders running again.
 */
type Failure = string | { key: Key; vars?: Vars };

function sayFailure(f: Failure, t: T): string {
  return typeof f === "string" ? f : t(f.key, f.vars);
}

function initials(first: string | null, last: string | null, email: string | null) {
  const f = first?.[0] ?? "";
  const l = last?.[0]  ?? "";
  if (f || l) return `${f}${l}`.toUpperCase();
  if (email)  return email.slice(0, 2).toUpperCase();
  return "—";
}

/** "3 months", "1 year 2 months" — how long since `iso`. */
function fmtDuration(iso: string, t: T): string {
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
  if (days < 1)  return t("users.duration.lessThanDay");
  if (days < 31) return t("users.duration.days", { count: days });
  const months = Math.floor(days / 30.44);
  if (months < 12) return t("users.duration.months", { count: months });
  const years = t("users.duration.years", { count: Math.floor(months / 12) });
  // Whole years read without "0 months".
  return months % 12 ? `${years} ${t("users.duration.months", { count: months % 12 })}` : years;
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

/** A subscription's state in the billing ledger, as a badge reads it. */
const SUB_STATUS: Record<string, { key: Key; tone: BadgeTone }> = {
  active:   { key: "users.subStatus.active", tone: "ok" },
  pending:  { key: "users.subStatus.pending", tone: "warn" },
  past_due: { key: "users.badge.pastDue", tone: "err" },
  canceled: { key: "users.subStatus.canceled", tone: "neutral" },
};

function subStatusLabel(status: string, t: T): string {
  const known = SUB_STATUS[status];
  return known ? t(known.key) : status.replace("_", " ");
}

/** "Basic · ₴399/mo · Active · Auto-renew on" — for confirms and warnings. */
function describeSubscription(s: UserSubscription, t: T, f: Format): string {
  return [
    planName(s.plan, t),
    t("users.sub.perMonth", { amount: f.money(s.amountUah, "UAH") }),
    subStatusLabel(s.status, t),
    t(s.autoRenew ? "users.sub.autoRenewOn" : "users.sub.autoRenewOff"),
  ].join(" · ");
}

/** "a@b.c, d@e.f and 3 more" — for confirm dialogs. */
function listLabels(rows: UserRow[], t: T, max = 5): string {
  const shown = rows.slice(0, max).map(rowLabel).join(", ");
  return rows.length > max ? t("users.list.more", { list: shown, count: rows.length - max }) : shown;
}

// The admin panel changes the plan in Clerk only; the monobank subscription
// row is untouched, so an active auto-renewing subscription keeps charging and
// its next renewal puts the paid plan back (users.note.renewal). A past_due
// one is not retried (users.note.pastDue).

function deleteSubscriptionWarning(s: UserSubscription | null | undefined, t: T, f: Format): string {
  if (!liveSubscription(s)) return "";
  return t("users.note.deleteSub", { sub: describeSubscription(s, t, f) });
}

/** Sentences of a confirm's body, the empty ones left out. */
function sentences(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

/** A paid period that ended with no renewal after it: the account still has the plan. */
function isOverdue(s: UserSubscription | null | undefined): s is UserSubscription {
  return !!s && s.status === "active" && !!s.currentPeriodEnd && Date.parse(s.currentPeriodEnd) < Date.now();
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
 * The plan in one line: "Free", "Basic · ₴399/mo", "Basic · ₴399/mo ·
 * overdue since Sep 10". A paid plan with no subscription behind it was set by
 * hand and says so.
 */
function PlanCell({ u, t, f }: { u: UserRow; t: T; f: Format }) {
  const s = u.subscription;
  const name = planName(u.plan, t);
  const billed = s && s.status !== "canceled" ? s : null;
  if (!billed) {
    if (u.plan === "free") return <span className="text-[var(--foreground-muted)]">{name}</span>;
    return (
      <span className="inline-flex items-center gap-1.5">
        {name}
        <Badge title={t("users.badge.manualHint")}>{t("users.badge.manual")}</Badge>
      </span>
    );
  }
  // What is billed: a payment still pending can be for a plan Clerk does not show yet.
  const billedName = planName(billed.plan, t);
  const problem =
    billed.status === "past_due"
      ? { text: t("users.sub.pastDue"), tone: "text-[var(--err)]" }
      : billed.status === "pending"
        ? { text: t("users.sub.pending", { date: f.date(billed.startedAt) }), tone: "" }
        : isOverdue(billed)
          ? { text: t("users.sub.overdue", { date: f.date(billed.currentPeriodEnd) }), tone: "text-[var(--warn)]" }
          : null;
  return (
    <span className={problem?.tone}>
      {billedName} · {t("users.sub.perMonth", { amount: f.money(billed.amountUah, "UAH") })}
      {problem && <> · {problem.text}</>}
    </span>
  );
}

/** 32px in the table, 40px on a phone's card. */
function Avatar({ u, size = "md" }: { u: UserRow; size?: "md" | "lg" }) {
  const box = size === "lg" ? "w-10 h-10" : "w-8 h-8";
  if (u.imageUrl) {
    const px = size === "lg" ? 40 : 32;
    return <Image src={u.imageUrl} alt="" width={px} height={px} className={`${box} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} flex-shrink-0 rounded-full inline-flex items-center justify-center ${size === "lg" ? "text-[13px]" : "text-[11px]"} font-semibold text-[var(--foreground)] bg-[var(--fg-overlay-08)]`}
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
  const f = useFormat();
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
  const [error, setError] = useState<Failure | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | typeof PLAN_OPTIONS[number]>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [counts, setCounts] = useState<UserCounts | null>(null);
  const [countsError, setCountsError] = useState<Failure | null>(null);

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
      if (seq === loadSeq.current) setError(e instanceof Error ? e.message : { key: "users.loadFailed" });
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
      setCountsError(e instanceof Error ? e.message : { key: "users.loadFailed" });
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
      ? sentences(
          t("users.confirm.planPaying", { count: paying.length, list: listLabels(paying, t) }),
          t("users.note.planBilling"),
          renewing ? t("users.note.renewal") : "",
        )
      : "";
    const count = rows.length;
    const name = planName(plan, t);
    if (!(await confirm({
      title: t("users.confirm.plan", { plan: name, count }),
      body: warn || undefined,
      confirmLabel: t("users.confirm.planAction", { count }),
    }))) return;
    await runBulk(t("users.bulk.planDone", { plan: name }), rows, patchUser({ plan }));
  };

  const bulkDelete = async () => {
    const rows = safeSelected();
    if (!rows.length) return;
    const paying = rows.filter((u) => liveSubscription(u.subscription));
    const warn = paying.length
      ? t("users.confirm.deletePaying", { count: paying.length, list: listLabels(paying, t) })
      : "";
    const count = rows.length;
    if (!(await confirm({
      title: t("users.confirm.delete", { count }),
      body: sentences(t("users.confirm.deleteBody"), warn),
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
      body: sentences(t("users.note.deleteAccount"), deleteSubscriptionWarning(u.subscription, t, f)),
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
    ...PLAN_OPTIONS.map((p) => ({ value: p, label: planName(p, t), count: counts?.[p] })),
  ];

  const statusOptions = (["active", "banned", "locked"] as const).map((s) => ({ value: s, label: t(STATUS_KEY[s]) }));

  const activeFilters = [
    ...(planFilter !== "all"
      ? [{ key: "plan", label: `${t("users.col.plan")}: ${planName(planFilter, t)}`, onRemove: () => setPlanFilter("all") }]
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
                {(u.isSuperAdmin || u.isAdmin) && <Badge>{t(u.isSuperAdmin ? "users.badge.superAdmin" : "users.badge.team")}</Badge>}
                {statusBadge(u, t)}
              </div>
              <div className="text-[12px] text-[var(--foreground-muted)] truncate" title={u.email ?? undefined}>
                {u.email ?? "—"}
              </div>
            </div>
          </div>
        );
      },
    },
    { key: "plan", header: t("users.col.plan"), cell: (u) => <PlanCell u={u} t={t} f={f} /> },
    {
      key: "joined",
      header: t("users.col.joined"),
      hide: "md",
      cell: (u) => <span className="text-[var(--foreground-muted)]">{f.date(u.createdAt)}</span>,
    },
    {
      key: "active",
      header: t("users.col.lastActive"),
      hide: "md",
      cell: (u) => <span className="text-[var(--foreground-muted)]">{f.when(u.lastActiveAt ?? u.lastSignInAt, t("users.never"))}</span>,
    },
  ];

  const subtitle = [
    counts ? t("users.count", { count: counts.total }) : null,
    counts?.banned ? t("users.bannedCount", { count: counts.banned }) : null,
    counts?.partial ? t("users.countsPartial", { count: counts.scanned }) : null,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title={t("nav.users")}
        subtitle={
          <>
            {subtitle.length ? subtitle.join(" · ") : "—"}
            {countsError ? <span className="text-[var(--err)]"> · {t("users.countsFailed", { error: sayFailure(countsError, t) })}</span> : null}
            {subsError ? <span className="text-[var(--err)]"> · {t("users.subsFailed", { error: subsError })}</span> : null}
          </>
        }
        actions={[{ key: "refresh", label: loading ? t("common.loading") : t("users.refresh"), onClick: refresh, disabled: loading }]}
      />

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
        <div role="alert" className={`${BANNER.err} mb-4`}>
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
        // On a phone: the name, and the state that needs action before the
        // email and the plan.
        card={(u) => {
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
          return {
            thumb: <Avatar u={u} size="lg" />,
            title: name || <span className="text-[var(--foreground-muted)]">{t("users.noName")}</span>,
            badge: statusBadge(u, t),
            meta: `${u.email ?? "—"} · ${planName(u.plan, t)}`,
          };
        }}
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
              <p className="text-[13px] text-[var(--err)] break-words">{sayFailure(error, t)}</p>
              <button onClick={refresh} className={btn("secondary")}>
                {t("common.retry")}
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
                    {t("filter.clearFilters")}
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
            menu: PLAN_OPTIONS.map((p) => ({ label: planName(p, t), onSelect: () => void bulkSetPlan(p) })),
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
  const t = useT();
  const confirm = useConfirm();
  const f = useFormat();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Failure | null>(null);
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
        if (!cancelled) setError(e instanceof Error ? e.message : { key: "users.loadFailed" });
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
      title: t("users.stylist.resetAllTitle"),
      body: t("users.stylist.resetAllBody", { action: t("users.stylist.resetToday") }),
      confirmLabel: t("users.stylist.resetAllAction"),
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
      else setError(t("users.stylist.statsStale"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("users.stylist.resetFailed"));
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
      setError(e instanceof Error ? e.message : t("users.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!detail) return;
    if (!(await confirm({
      title: t("users.confirm.deleteOne", { name: rowLabel(detail) }),
      body: sentences(t("users.note.deleteAccount"), deleteSubscriptionWarning(detail.subscription, t, f)),
      confirmLabel: t("users.confirm.deleteOneAction"),
      tone: "danger",
    }))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      onDeleted(userId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("users.deleteFailed"));
    } finally {
      setSaving(false);
    }
  };

  const displayName = detail ? rowLabel(detail) : t("common.loading");

  const isSuperAdmin = detail?.isSuperAdmin ?? false;

  // The details in the admin's side panel (GS4-5): the header names the user,
  // the buttons sit at the bottom — Delete on its own on the left.
  return (
    <SidePanel
      open
      onClose={onClose}
      title={displayName}
      subtitle={detail?.email ?? undefined}
      footer={
        detail && !loading ? (
          <>
            {!isSuperAdmin && (
              <button onClick={del} disabled={saving} className={`${btn("danger")} mr-auto`}>
                {t("users.confirm.deleteOneAction")}
              </button>
            )}
            <button onClick={onClose} className={btn("ghost")}>
              {t("common.cancel")}
            </button>
            {!isSuperAdmin && (
              <button onClick={save} disabled={!hasChanges || saving} className={btn("primary")}>
                {saving ? t("common.saving") : t("common.save")}
              </button>
            )}
          </>
        ) : undefined
      }
    >
      {loading && (
        <div className="py-10 text-xs text-[var(--foreground-subtle)]">{t("common.loading")}</div>
      )}

      {error && (
        <div role="alert" className={`${BANNER.err} my-4`}>
          {sayFailure(error, t)}
        </div>
      )}

      {detail && !loading && (
        <div className="space-y-6">
          {isSuperAdmin && (
            <div className={`${BANNER.warn} flex items-center gap-3`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[var(--warn)] flex-shrink-0">
                <path d="M8 2L10 6H14L11 9L12 13L8 11L4 13L5 9L2 6H6L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <p>{t("users.panel.protected")}</p>
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
              <p className="text-sm text-[var(--foreground)] truncate">{detail.email ?? t("users.panel.noEmail")}</p>
              <p className="text-[12px] font-mono text-[var(--foreground-subtle)] truncate">{detail.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <MetaItem label={t("users.col.joined")} value={f.date(detail.createdAt)} />
            <MetaItem label={t("users.panel.updated")} value={f.date(detail.updatedAt)} />
            <MetaItem label={t("users.panel.lastSignIn")} value={f.when(detail.lastSignInAt, t("users.never"))} />
            <MetaItem label={t("users.col.lastActive")} value={f.when(detail.lastActiveAt, t("users.never"))} />
            <MetaItem
              label={t("users.panel.twoFactor")}
              value={t(detail.twoFactorEnabled ? "users.panel.twoFactorOn" : "users.panel.twoFactorOff")}
            />
            <MetaItem label={t("users.panel.username")} value={detail.username ?? "—"} />
          </div>

          {/* Subscription (monobank billing ledger) */}
          <div>
            <h3 className={SECTION_TITLE}>{t("users.panel.subscription")}</h3>
            {detail.subscription ? (
              <div className="border border-[var(--border)] rounded-xl divide-y divide-[var(--border)]">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="text-xs text-[var(--foreground)]">
                    {planName(detail.subscription.plan, t)} · {t("users.sub.perMonth", { amount: f.money(detail.subscription.amountUah, "UAH") })}
                  </span>
                  <Badge tone={SUB_STATUS[detail.subscription.status]?.tone ?? "neutral"}>
                    {subStatusLabel(detail.subscription.status, t)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs">
                  <MetaItem label={t("users.panel.subscribedFor")} value={fmtDuration(detail.subscription.startedAt, t)} />
                  <MetaItem label={t("users.panel.since")} value={f.date(detail.subscription.startedAt)} />
                  <MetaItem
                    label={t(detail.subscription.autoRenew ? "users.panel.nextCharge" : "users.panel.accessUntil")}
                    value={f.date(detail.subscription.currentPeriodEnd)}
                  />
                  <MetaItem
                    label={t("users.panel.autoRenew")}
                    value={t(detail.subscription.autoRenew ? "users.panel.on" : "users.panel.off")}
                  />
                  {detail.subscription.maskedPan && (
                    <MetaItem label={t("users.panel.card")} value={detail.subscription.maskedPan.replace(/\*+/, "··")} />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--foreground-subtle)] border border-[var(--border)] rounded-xl px-4 py-3">
                {t("users.panel.noSubscription")}
              </p>
            )}
          </div>

          {/* Activity stats. Small cards of their own: KpiStrip is a page-wide
              strip and would squeeze four columns into the panel. */}
          <div>
            <h3 className={SECTION_TITLE}>{t("users.panel.activity")}</h3>
            {!stats ? (
              <p className="text-xs text-[var(--foreground-subtle)] border border-[var(--border)] rounded-xl px-4 py-3">
                {statsError ? t("users.panel.statsUnavailableWith", { error: statsError }) : t("users.panel.statsUnavailable")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  label={t("users.stats.stylistToday")}
                  value={
                    <>
                      {f.number(stats.stylistMsgToday)}
                      <span className="text-xs text-[var(--foreground-subtle)] ml-1 font-sans">
                        / {stats.stylistLimitDay === null ? "∞" : f.number(stats.stylistLimitDay)}
                      </span>
                    </>
                  }
                  note={
                    stats.stylistRemaining === null
                      ? t("users.stats.unlimited")
                      : t("users.stats.left", { count: stats.stylistRemaining })
                  }
                />
                <StatCard
                  label={t("users.stats.stylistTotal")}
                  value={f.number(stats.stylistMsgTotal)}
                  note={t("users.stats.messages", { count: stats.stylistMsgTotal })}
                />
                <StatCard label={t("users.stats.images")} value={f.number(stats.imagesGenerated)} note={t("users.stats.generated")} />
                <StatCard label={t("users.stats.looks")} value={f.number(stats.looksPublished)} note={t("users.stats.published")} />
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
                  {resetting ? t("common.resetting") : t("users.stylist.resetToday")}
                </button>
                <button
                  onClick={() => resetStylistUsage("all")}
                  disabled={resetting}
                  className={btn("ghost")}
                >
                  {t("users.stylist.resetAll")}
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 className={SECTION_TITLE}>{t("users.panel.profile")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col">
                <span className={FIELD_LABEL}>{t("users.panel.firstName")}</span>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT} />
              </label>
              <label className="flex flex-col">
                <span className={FIELD_LABEL}>{t("users.panel.lastName")}</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT} />
              </label>
            </div>
          </div>

          <div>
            <h3 className={SECTION_TITLE}>{t("users.col.plan")}</h3>
            {/* One plan of a few: the same chips as the plan filter above the list. */}
            <FilterChips
              label={t("users.col.plan")}
              value={plan}
              options={PLAN_OPTIONS.map((p) => ({ value: p, label: planName(p, t) }))}
              onChange={setPlan}
            />
            {liveSubscription(detail.subscription) && (
              <p className={`${BANNER.warn} mt-2`}>
                {sentences(
                  t("users.panel.activeSub", { sub: describeSubscription(detail.subscription, t, f) }),
                  t("users.note.planBilling"),
                  renewsAutomatically(detail.subscription)
                    ? t("users.note.renewal")
                    : detail.subscription.status === "past_due" ? t("users.note.pastDue") : "",
                )}
              </p>
            )}
          </div>

          <div>
            <h3 className={SECTION_TITLE}>{t("users.panel.access")}</h3>
            <div className="space-y-2">
              {detail.adminViaEnv ? (
                // ADMIN_USER_IDS grants access regardless of the metadata flag,
                // so a toggle here would look like it revokes access and not.
                <div className="px-3 py-2.5 border border-[var(--border)] rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-[var(--foreground)]">{t("users.panel.admin")}</p>
                    <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5">{t("users.panel.adminViaEnv")}</p>
                  </div>
                  <Badge tone="ok">{t("users.panel.viaEnv")}</Badge>
                </div>
              ) : currentIsSuperAdmin ? (
                <ToggleRow
                  label={t("users.panel.admin")}
                  description={t("users.panel.adminHint")}
                  checked={isAdmin}
                  onChange={setIsAdmin}
                />
              ) : detail.isAdmin ? (
                <div className="px-3 py-2.5 border border-[var(--border)] rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-[var(--foreground)]">{t("users.panel.admin")}</p>
                    <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5">{t("users.panel.superAdminOnly")}</p>
                  </div>
                  <Badge tone="ok">{t("users.panel.adminOn")}</Badge>
                </div>
              ) : null}
              <ToggleRow
                label={t("users.panel.banned")}
                description={t("users.panel.bannedHint")}
                checked={banned}
                onChange={setBanned}
                danger
              />
            </div>
          </div>

        </div>
      )}
    </SidePanel>
  );
}

/** A block's name inside the side panel. */
const SECTION_TITLE = "text-[13px] font-medium text-[var(--foreground)] mb-3";

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--foreground-muted)] mb-1">{label}</p>
      <p className="text-xs text-[var(--foreground)] truncate">{value}</p>
    </div>
  );
}

/** One activity number in the side panel: the label, the number, a line under it. */
function StatCard({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return (
    <div className="border border-[var(--border)] rounded-xl p-3">
      <p className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] mb-1">{label}</p>
      <p className="font-display text-xl font-light text-[var(--foreground)] tabular-nums">{value}</p>
      <p className="text-[12px] text-[var(--foreground-muted)] mt-0.5">{note}</p>
    </div>
  );
}

/** A labelled on/off row: the switch recipe of DESIGN_SYSTEM §9, rule 10. */
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
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 border border-[var(--border)] rounded-xl hover:border-[var(--border-strong)] transition-colors text-left"
    >
      <div>
        <p className={`text-xs ${danger && checked ? "text-[var(--err)]" : "text-[var(--foreground)]"}`}>{label}</p>
        <p className="text-[12px] text-[var(--foreground-subtle)] mt-0.5">{description}</p>
      </div>
      {/* Off is --border-strong: a --border track vanishes on the panel (GS1-0). */}
      <div aria-hidden="true" className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
        checked ? (danger ? "bg-[var(--err)]" : "bg-[var(--foreground)]") : "bg-[var(--border-strong)]"
      }`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface)] transition-[left] ${
          checked ? "left-[18px]" : "left-0.5"
        }`} />
      </div>
    </button>
  );
}
