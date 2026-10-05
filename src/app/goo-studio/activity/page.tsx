"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdminAction } from "@/lib/server/audit";
import { BANNER, btn, PANEL } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT, type Format, type Key, type T } from "@/app/goo-studio/_i18n";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/DataTable";
import { ActiveFilters, FilterChips, FilterMenu, type ActiveFilter } from "@/components/admin/FilterBar";

/*
 * Activity, the super admin's log of admin actions (docs/ADMIN_DESIGN.md §6,
 * mockup "Activity", GS4-12): grouped by day, each row "what — over what —
 * who", the time on the right. Filters by admin and by type; pages of 50 from
 * GET /api/admin/audit.
 */

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

/** Up to this many admins the filter is a row of chips; past it, a menu with search. */
const ADMIN_CHIPS_MAX = 4;

type Tone = "err" | "warn" | "ok";

// Typed against AdminAction, so a new action cannot ship without a tone here
// (null for neutral) and a label in the dictionary (act.<action>, see actKey).
// Only the three admin statuses (DESIGN_SYSTEM.md §9).
const ACTION_TONE: Record<AdminAction, Tone | null> = {
  "user.name_updated": null,
  "user.plan_changed": "warn",
  "user.admin_granted": "ok",
  "user.admin_revoked": "warn",
  "user.banned": "err",
  "user.unbanned": null,
  "user.deleted": "err",
  "settings.api_key_updated": "warn",
  "settings.api_key_deleted": "err",
  "settings.homepage_showcase_updated": null,
  "settings.homepage_stylist_updated": null,
  "settings.prompt_updated": null,
  "settings.prompt_reset": null,
  "parser.config_updated": null,
  "parser.product_imported": null,
  "parser.crawl_batch": null,
  "parser.collect_ingest": null,
  "categories.updated": null,
  "products.created": null,
  "products.updated": null,
  "products.deleted": "err",
  "products.bulk_deleted": "err",
  "products.recategorized": null,
  "products.recategorize_undone": null,
  "products.styles_reset": null,
  "products.styles_reset_undone": null,
  "products.label_fixed": null,
  "products.label_dismissed": null,
  "products.label_restored": null,
  "products.bulk_edited": null,
  "products.bg_color_sampled": null,
  "products.bg_color_undone": null,
  "products.duplicates_merged": null,
  "products.duplicates_dismissed": null,
  "products.colour_group_split": null,
  "products.colourways_grouped": null,
  "products.colourways_dismissed": null,
  "catalogue_check.settings_updated": null,
  "catalogue_check.fixed": null,
  "catalogue_check.brands_unified": null,
  "catalogue_check.applied": null,
  "catalogue_check.dismissed": null,
  "catalogue_check.undone": null,
  "outfits.created": null,
  "outfits.updated": null,
  "outfits.deleted": "err",
  "looks.approved": "ok",
  "looks.rejected": null,
  "blog.created": null,
  "blog.updated": null,
  "blog.deleted": "err",
  "brands.created": null,
  "brands.deleted": "err",
  "brands.logo_updated": null,
  "brands.logo_removed": null,
  "retailer_domain.saved": null,
  "retailer_domain.deleted": "err",
  "retailer_domain.applied": null,
  "import.csv": null,
  "stylist_usage.reset": "warn",
  "email.sent": "warn",
  "waitlist.deleted": "err",
};

/** Every action, in the order above (by section): the Type filter's choices. */
const ACTIONS = Object.keys(ACTION_TONE) as AdminAction[];

function isKnownAction(action: string): action is AdminAction {
  return Object.prototype.hasOwnProperty.call(ACTION_TONE, action);
}

/** The action's label in the dictionary; an action without one fails the type check here. */
function actKey(action: AdminAction): Key {
  return `act.${action}`;
}

/** An action the log has but this page does not know (an old one) shows as stored. */
function actionLabel(action: string, t: T): string {
  return isKnownAction(action) ? t(actKey(action)) : action;
}

const PLAN: Record<string, Key> = { free: "plan.free", basic: "plan.basic", pro: "plan.pro", premium: "plan.premium" };

/** What the action was done to, by name, when the entry recorded one: "Free → Premium", a product's name. */
function detailOf(entry: AuditEntry, t: T): string | null {
  const m = entry.metadata ?? {};
  if (entry.action === "user.plan_changed") {
    const plan = (v: unknown) => (typeof v === "string" && PLAN[v] ? t(PLAN[v]) : String(v ?? "?"));
    return `${plan(m.from)} → ${plan(m.to)}`;
  }
  if (entry.action === "user.deleted" && m.target_email) return String(m.target_email);
  if (entry.action === "user.name_updated") {
    const parts = [m.firstName, m.lastName].filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  // Whatever names the target, if the entry recorded one.
  return (
    [m.name, m.title, m.subject, m.domain].find((v): v is string => typeof v === "string" && v.trim() !== "") ?? null
  );
}

// 16px icons by the part of the action before the dot (the mockup's set).
const ICON = {
  users: "M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1.5 13.5C2 11 3.8 10 6 10s4 1 4.5 3.5M11 3a2.3 2.3 0 0 1 0 4.4M12.5 10.3c1.1.5 1.8 1.6 2 3.2",
  sliders: "M3 4.5h6M12 4.5h1M3 11.5h1M7 11.5h6M10.5 3v3M5.5 10v3",
  chat: "M2.5 3.5h11V11H7l-3 2.5V11H2.5z",
  upload: "M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v3h11v-3",
  list: "M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01",
  tag: "M2.5 8.5V3a.5.5 0 0 1 .5-.5h5.5l5 5-6 6zM5.5 5.5h.01",
  spark: "M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2",
  layers: "M8 2l6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3",
  doc: "M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12M6 8h4M6 10.5h4",
  star: "M8 2l1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1L2 6.3l4.2-.5z",
  bag: "M3 5.5h10l-.8 8H3.8zM5.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5",
  mail: "M2.5 4h11v8.5h-11zM2.5 4.5L8 9l5.5-4.5",
  edit: "M11 2.5L13.5 5 6 12.5l-3 .5.5-3z",
  trash: "M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 9h5.8l.6-9",
  ban: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM3.8 3.8l8.4 8.4",
} as const;

const GROUP_ICON: Record<string, keyof typeof ICON> = {
  user: "users",
  settings: "sliders",
  parser: "upload",
  import: "upload",
  categories: "list",
  products: "tag",
  catalogue_check: "spark",
  outfits: "layers",
  looks: "layers",
  blog: "doc",
  brands: "star",
  retailer_domain: "bag",
  email: "mail",
  waitlist: "mail",
  stylist_usage: "chat",
};

function iconFor(action: string): keyof typeof ICON {
  if (action === "user.banned") return "ban";
  if (action.endsWith(".deleted") || action.endsWith("_deleted")) return "trash";
  if (action.startsWith("settings.prompt_")) return "chat";
  return GROUP_ICON[action.split(".")[0]] ?? "edit";
}

// The icon's tile carries the tone: red for what deletes, amber for what
// changes access or money, green for what grants.
const TILE: Record<Tone | "none", string> = {
  err: "bg-[var(--err-bg)] text-[var(--err)]",
  warn: "bg-[var(--warn-bg)] text-[var(--warn)]",
  ok: "bg-[var(--ok-bg)] text-[var(--ok)]",
  none: "bg-[var(--fg-overlay-08)] text-[var(--foreground-muted)]",
};

/** Local midnight of the entry's day, the key it is grouped by. */
function dayOf(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function Entry({ entry, first, t, f }: { entry: AuditEntry; first: boolean; t: T; f: Format }) {
  const tone = isKnownAction(entry.action) ? ACTION_TONE[entry.action] : null;
  const detail = detailOf(entry, t);
  return (
    <li className={`flex items-start gap-3 px-4 md:px-5 py-3 ${first ? "" : "border-t border-[var(--border)]"}`}>
      <span aria-hidden="true" className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg ${TILE[tone ?? "none"]}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={ICON[iconFor(entry.action)]} />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-5 text-[var(--foreground)] break-words">
          <span className="font-medium">{actionLabel(entry.action, t)}</span>
          {detail && (
            <span className="text-[var(--foreground-muted)]" title={entry.target_id ?? undefined}>
              {" · "}
              {detail}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-w-0 text-[12px] leading-[18px] text-[var(--foreground-muted)]">
          <span className="truncate">{entry.admin_email ?? entry.admin_id}</span>
          {/* The target's id only when the entry named nothing: a UUID is not a name. */}
          {!detail && entry.target_id && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono truncate max-w-[180px]">{entry.target_id}</span>
            </>
          )}
        </div>
      </div>
      <time
        dateTime={entry.created_at}
        title={f.dateTime(entry.created_at)}
        className="flex-shrink-0 text-[12px] leading-5 text-[var(--foreground-muted)] tabular-nums whitespace-nowrap"
      >
        {f.when(entry.created_at)}
      </time>
    </li>
  );
}

export default function AdminActivityPage() {
  const t = useT();
  const f = useFormat();
  const [access, setAccess]       = useState<"checking" | "granted" | "denied">("checking");
  const [entries, setEntries]     = useState<AuditEntry[]>([]);
  const [total, setTotal]         = useState(0);
  // The whole log's size, from the last unfiltered answer, for the header.
  const [logTotal, setLogTotal]   = useState<number | null>(null);
  const [admins, setAdmins]       = useState<AdminOption[]>([]);
  const [loading, setLoading]     = useState(false);
  // The server's message; "" when it gave none, worded on screen in the admin's language.
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
      if (!adminFilter && !actionFilter) setLogTotal(body.total ?? 0);
      if (body.admins) setAdmins(body.admins);
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "");
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

  if (access !== "granted") {
    return (
      <div>
        <PageHeader title={t("nav.activity")} subtitle={access === "checking" ? t("common.loading") : undefined} />
        {/* Access guard — non-super admins get a locked view. */}
        {access === "denied" && (
          <div className={PANEL}>
            <EmptyState
              text={t("activity.denied")}
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              }
            />
          </div>
        )}
      </div>
    );
  }

  const filtered = !!(adminFilter || actionFilter);
  const adminOptions = admins.map((a) => ({ value: a.id, label: a.email ?? `${a.id.slice(0, 16)}…` }));
  const adminLabel = adminOptions.find((o) => o.value === adminFilter)?.label ?? adminFilter;
  const activeFilters: ActiveFilter[] = [
    ...(adminFilter
      ? [{ key: "admin", label: `${t("activity.f.admin")}: ${adminLabel}`, onRemove: () => changeFilter("", actionFilter) }]
      : []),
    ...(actionFilter
      ? [{ key: "type", label: `${t("activity.f.type")}: ${actionLabel(actionFilter, t)}`, onRemove: () => changeFilter(adminFilter, "") }]
      : []),
  ];

  const subtitle = [
    logTotal !== null && t("activity.count", { count: logTotal }),
    admins.length > 0 && t("activity.admins", { count: admins.length }),
  ].filter(Boolean).join(" · ");

  // Newest first, as the API sends them: a new group starts where the day changes.
  const days: { day: number; at: string; entries: AuditEntry[] }[] = [];
  for (const e of entries) {
    const day = dayOf(e.created_at);
    const last = days[days.length - 1];
    if (last && last.day === day) last.entries.push(e);
    else days.push({ day, at: e.created_at, entries: [e] });
  }
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  midnight.setDate(midnight.getDate() - 1);
  const yesterday = midnight.getTime();

  return (
    <div>
      <PageHeader
        title={t("nav.activity")}
        subtitle={subtitle || (loading ? t("common.loading") : undefined)}
        actions={[
          { key: "refresh", label: loading ? t("common.loading") : t("activity.refresh"), onClick: () => fetchPage(0), disabled: loading },
        ]}
      />

      {/* Who and what; the dates filter of the mockup needs the API first. */}
      <div className="mb-6 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {admins.length <= ADMIN_CHIPS_MAX ? (
            <FilterChips
              label={t("activity.f.admin")}
              value={adminFilter}
              options={[{ value: "", label: t("activity.allAdmins") }, ...adminOptions]}
              onChange={(v) => changeFilter(v, actionFilter)}
            />
          ) : (
            <FilterMenu
              label={t("activity.f.admin")}
              value={adminFilter}
              options={adminOptions}
              onChange={(v) => changeFilter(v, actionFilter)}
              allLabel={t("activity.allAdmins")}
              searchable
            />
          )}
          <FilterMenu
            label={t("activity.f.type")}
            value={actionFilter}
            options={ACTIONS.map((a) => ({ value: a, label: t(actKey(a)) }))}
            onChange={(v) => changeFilter(adminFilter, v)}
            allLabel={t("activity.allTypes")}
            searchable
          />
        </div>
        {filtered && (
          <ActiveFilters
            filters={activeFilters}
            onClearAll={() => changeFilter("", "")}
            count={loading ? null : t("activity.count", { count: total })}
          />
        )}
      </div>

      {error !== null && (
        <div role="alert" className={`${BANNER.err} mb-6`}>
          {error || t("activity.loadFailed")}
        </div>
      )}

      {entries.length === 0 ? (
        loading ? (
          <div className={`${PANEL} px-4 py-12 text-center text-[13px] text-[var(--foreground-muted)]`}>
            {t("common.loading")}
          </div>
        ) : error === null ? (
          <div className={PANEL}>
            <EmptyState
              text={filtered ? t("activity.empty.filtered") : t("activity.empty.none")}
              action={
                filtered ? (
                  <button type="button" onClick={() => changeFilter("", "")} className={btn("secondary")}>
                    {t("filter.clearFilters")}
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : null
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((d) => (
            <section key={d.day} className="flex flex-col gap-2">
              <h2 className="flex flex-wrap items-baseline gap-x-2 text-[13px] leading-5 font-medium text-[var(--foreground)]">
                {d.day === today ? t("activity.today") : d.day === yesterday ? t("activity.yesterday") : f.date(d.at)}
                {(d.day === today || d.day === yesterday) && (
                  <span className="text-[12px] font-normal text-[var(--foreground-muted)]">{f.date(d.at)}</span>
                )}
              </h2>
              <ul className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
                {d.entries.map((entry, i) => (
                  <Entry key={entry.id} entry={entry} first={i === 0} t={t} f={f} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {entries.length > 0 && entries.length < total && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <button type="button" onClick={() => fetchPage(entries.length)} disabled={loading} className={btn("secondary")}>
            {loading ? t("common.loading") : t("activity.loadMore")}
          </button>
          <span className="text-[12px] text-[var(--foreground-muted)] tabular-nums">
            {t("filter.count", { shown: entries.length, total })}
          </span>
        </div>
      )}
    </div>
  );
}
