"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import Image from "@/components/ui/Image";
import { PageHeader } from "@/components/admin/PageHeader";
import { AttentionList, type AttentionRow } from "@/components/admin/AttentionList";
import { KpiStrip, type Kpi } from "@/components/admin/KpiStrip";
import { Badge } from "@/components/admin/Badge";
import { BANNER, btn } from "./_ui/recipes";
import { useFormat, useT, type Key, type T } from "./_i18n";

/*
 * The dashboard (docs/ADMIN_DESIGN.md §6, mockup "Dashboard", GS4-12):
 * what needs a person first, then the key numbers, the services, and what
 * happened lately — new customers and the catalogue's changes.
 * Everything comes from GET /api/admin/stats.
 */

type ServiceKey = "supabase" | "clerk" | "openai" | "replicate" | "resend" | "monobank" | "cron";
type Service = { key: ServiceKey; state: "ok" | "err" | "off"; code: string; ms?: number; at?: string; message?: string };

type AttentionKey = "cron" | "migrations" | "overdue" | "noCard" | "failedCharges" | "embeddings" | "aiCheck" | "pendingLooks";
type AttentionItem = { key: AttentionKey; tone: "err" | "warn"; count?: number; at?: string; href: string; fix?: string[] };

type Count = number | null;

interface StatsPayload {
  generatedAt: string;
  paymentsOff: boolean;
  kpis: {
    products: { total: Count; thisMonth: Count; pct: number | null };
    outfits: { total: Count; ai: Count; pending: Count };
    customers: { total: Count; team: Count; partial: boolean; thisMonth: Count; pct: number | null };
    paying: { total: Count; mrrUah: Count };
    brands: { total: Count; products: Count };
  };
  attention: AttentionItem[];
  services: Service[];
  recent: {
    customers: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      imageUrl: string;
      createdAt: number;
      plan: string;
    }[] | null;
    /** The super admin only; everyone else gets the newest outfits. */
    activity: { id: number; action: string; name: string | null; count: number | null; who: string | null; at: string }[] | null;
    outfits: { id: string; name: string; image_url: string | null; created_at: string }[] | null;
  };
}

type Format = ReturnType<typeof useFormat>;

/** The way to the section that fixes it, by item. */
const ATTENTION_ACTION: Record<AttentionKey, Key> = {
  cron: "attn.open.subscriptions",
  migrations: "attn.open.settings",
  overdue: "attn.open.subscriptions",
  noCard: "attn.open.subscriptions",
  failedCharges: "attn.open.subscriptions",
  embeddings: "attn.open.settings",
  aiCheck: "attn.review",
  pendingLooks: "attn.review",
};

function attentionRow(item: AttentionItem, t: T, f: Format): AttentionRow {
  const vars = { count: item.count ?? 0 };
  const title = item.key === "cron" ? t("attn.cron.title") : t(`attn.${item.key}.title` as Key, vars);
  const text =
    item.key === "cron"
      ? item.at
        ? t("attn.cron.stale", { when: f.when(item.at) })
        : t("attn.cron.never")
      : t(`attn.${item.key}.text` as Key, vars);
  return { key: item.key, tone: item.tone, title, text, action: { label: t(ATTENTION_ACTION[item.key]), href: item.href }, fix: item.fix };
}

/** The state of a service in a few words: "182 ms", "Key rejected", "Ran 3h ago". */
function serviceState(s: Service, t: T, f: Format): string {
  switch (s.code) {
    case "answered":
      return s.ms !== undefined ? t("svc.answered", { ms: s.ms }) : t("svc.answered", { ms: "—" });
    case "send_only":
      return t("svc.sendOnly");
    case "no_key":
      return t("svc.noKey");
    case "rejected":
      return t("svc.rejected");
    case "timeout":
      return t("svc.timeout");
    case "ran":
      return t("svc.ran", { when: f.when(s.at) });
    case "stale":
      return t("svc.stale", { when: f.when(s.at) });
    case "never_ran":
      return t("svc.neverRan");
    case "no_secret":
      return t("svc.noSecret");
    case "off":
      return t("svc.off");
    default:
      return t("svc.error");
  }
}

function ServiceChip({ s, t, f }: { s: Service; t: T; f: Format }) {
  const dot = s.state === "ok" ? "bg-[var(--ok)]" : s.state === "err" ? "bg-[var(--err)]" : "bg-[var(--foreground-subtle)]";
  return (
    <li
      title={s.state === "off" ? t("svc.offHint") : s.message}
      className={`inline-flex items-center gap-2 h-8 px-3 rounded-full border bg-[var(--surface)] text-[13px] ${
        s.state === "err" ? "border-[var(--err-line)]" : "border-[var(--border)]"
      }`}
    >
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="font-medium text-[var(--foreground)]">{t(`svc.name.${s.key}` as Key)}</span>
      <span className={s.state === "err" ? "text-[var(--err)]" : "text-[var(--foreground-muted)]"}>{serviceState(s, t, f)}</span>
    </li>
  );
}

function initials(first: string | null, last: string | null, email: string | null): string {
  const a = first?.[0] ?? "";
  const b = last?.[0] ?? "";
  if (a || b) return `${a}${b}`.toUpperCase();
  return email ? email.slice(0, 2).toUpperCase() : "—";
}

/** A panel with a title, a link to the section, and rows. */
function Panel({ title, link, children }: { title: string; link: { label: string; href: string }; children: ReactNode }) {
  return (
    <section className="flex-[1_1_380px] min-w-0 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
      <div className="flex items-center gap-3 px-4 md:px-5 py-3.5 border-b border-[var(--border)]">
        <h2 className="flex-1 text-[15px] leading-[22px] font-medium text-[var(--foreground)]">{title}</h2>
        <Link
          href={link.href}
          className="inline-flex items-center min-h-10 md:min-h-0 text-[13px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          {link.label}
        </Link>
      </div>
      {children}
    </section>
  );
}

const ROW = "flex items-center gap-3 min-h-[52px] px-4 md:px-5 py-2";

export default function AdminDashboardPage() {
  const t = useT();
  const f = useFormat();
  const [data, setData] = useState<StatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresh asks the services again; an ordinary visit takes their last minute's answer.
  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stats${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as StatsPayload;
      // A body without the dashboard's shape (a proxy's page, an old server) is an error, not a blank page.
      if (!body?.kpis || !body.recent) throw new Error(t("dash.loadFailed"));
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("dash.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const header = (
    <PageHeader
      title={t("nav.dashboard")}
      subtitle={data ? t("dash.updated", { when: f.when(data.generatedAt) }) : loading ? t("common.loading") : t("dash.loadFailed")}
      actions={[
        { key: "refresh", label: loading ? t("dash.refreshing") : t("dash.refresh"), onClick: () => void load(true), disabled: loading },
      ]}
    />
  );

  // The first load failed: the error and a retry, not skeletons that look like an endless load.
  if (error && !data) {
    return (
      <div>
        {header}
        <div role="alert" className={`${BANNER.err} flex flex-wrap items-center justify-between gap-4`}>
          <span className="min-w-0 break-words">{error}</span>
          <button onClick={() => void load(true)} className={`shrink-0 ${btn("secondary")}`}>
            {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  const k = data?.kpis;
  const num = (n: Count | undefined) => (n === null || n === undefined ? "—" : f.number(n));
  const notes = (...parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" · ") || undefined;
  const growth = (g: { thisMonth: Count; pct: number | null } | undefined) =>
    notes(
      g?.thisMonth !== null && g?.thisMonth !== undefined && t("dash.note.thisMonth", { count: g.thisMonth }),
      g?.pct !== null && g?.pct !== undefined && t("dash.note.pct", { pct: `${g.pct > 0 ? "+" : ""}${g.pct}%` })
    );
  const kpis: Kpi[] = [
    { key: "products", label: t("dash.kpi.products"), value: num(k?.products.total), note: growth(k?.products), noteTitle: t("dash.note.pctHint") },
    {
      key: "outfits",
      label: t("dash.kpi.outfits"),
      value: num(k?.outfits.total),
      note: notes(
        !!k?.outfits.ai && t("dash.note.ai", { count: k.outfits.ai }),
        !!k?.outfits.pending && t("dash.note.pending", { count: k.outfits.pending })
      ),
    },
    {
      key: "customers",
      label: t("dash.kpi.customers"),
      value: num(k?.customers.total),
      note: notes(growth(k?.customers), k?.customers.total !== null && k?.customers.total !== undefined && t("dash.note.teamExcluded")),
      noteTitle: t("dash.note.pctHint"),
    },
    {
      key: "paying",
      label: t("dash.kpi.paying"),
      value: num(k?.paying.total),
      note: notes(
        k?.paying.mrrUah !== null && k?.paying.mrrUah !== undefined && t("dash.note.mrr", { amount: f.money(k.paying.mrrUah, "UAH") }),
        data?.paymentsOff && t("dash.note.paymentsOff")
      ),
    },
    {
      key: "brands",
      label: t("dash.kpi.brands"),
      value: num(k?.brands.total),
      note:
        k?.brands.total && k.brands.products !== null
          ? t("dash.note.perBrand", { count: Math.round(k.brands.products / k.brands.total) })
          : undefined,
    },
  ];

  const rows = (data?.attention ?? []).map((a) => attentionRow(a, t, f));
  const activity = data?.recent.activity ?? null;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {header}

      {error && (
        <div role="alert" className={`${BANNER.err} -mt-2`}>
          {error}
        </div>
      )}

      <AttentionList rows={rows} loading={!data} />

      <KpiStrip label={t("dash.kpis")} items={kpis} />

      <section className="flex flex-col gap-3">
        <h2 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">{t("svc.title")}</h2>
        {data ? (
          <ul className="flex flex-wrap gap-2">
            {data.services.map((s) => (
              <ServiceChip key={s.key} s={s} t={t} f={f} />
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[var(--foreground-muted)]">{t("common.loading")}</p>
        )}
      </section>

      <div className="flex flex-wrap gap-6">
        <Panel title={t("dash.newCustomers")} link={{ label: t("dash.viewAll"), href: "/goo-studio/users" }}>
          {!data ? (
            <p className={`${ROW} text-[13px] text-[var(--foreground-muted)]`}>{t("common.loading")}</p>
          ) : !data.recent.customers?.length ? (
            <p className={`${ROW} text-[13px] text-[var(--foreground-muted)]`}>{data.recent.customers ? t("dash.noCustomers") : "—"}</p>
          ) : (
            <ul>
              {data.recent.customers.map((u, i) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
                const paid = u.plan !== "free";
                return (
                  <li key={u.id} className={`${ROW} ${i ? "border-t border-[var(--border)]" : ""}`}>
                    {u.imageUrl ? (
                      <Image src={u.imageUrl} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <span aria-hidden="true" className="w-8 h-8 flex-shrink-0 rounded-full inline-flex items-center justify-center text-[11px] font-semibold text-[var(--foreground)] bg-[var(--fg-overlay-08)]">
                        {initials(u.firstName, u.lastName, u.email)}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] leading-[18px] font-medium text-[var(--foreground)] truncate">{name || u.email || u.id}</div>
                      {name && <div className="text-[12px] leading-4 text-[var(--foreground-muted)] truncate">{u.email}</div>}
                    </div>
                    <Badge tone={paid ? "inverse" : "neutral"}>{t(`plan.${u.plan}` as Key)}</Badge>
                    <span className="w-16 text-right text-[12px] text-[var(--foreground-muted)] tabular-nums whitespace-nowrap">{f.when(u.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {activity ? (
          <Panel title={t("dash.activity")} link={{ label: t("dash.openActivity"), href: "/goo-studio/activity" }}>
            {activity.length === 0 ? (
              <p className={`${ROW} text-[13px] text-[var(--foreground-muted)]`}>{t("dash.noActivity")}</p>
            ) : (
              <ul>
                {activity.map((e, i) => (
                  <li key={e.id} className={`${ROW} ${i ? "border-t border-[var(--border)]" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] leading-[18px] font-medium text-[var(--foreground)] truncate">
                        {t(`act.${e.action}` as Key)}
                        {e.name && <span className="font-normal text-[var(--foreground-muted)]"> · {e.name}</span>}
                      </div>
                      <div className="text-[12px] leading-4 text-[var(--foreground-muted)] truncate">
                        {notes(e.count !== null && f.number(e.count), e.who)}
                      </div>
                    </div>
                    <span className="w-16 text-right text-[12px] text-[var(--foreground-muted)] tabular-nums whitespace-nowrap">{f.when(e.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : (
          <Panel title={t("dash.newOutfits")} link={{ label: t("dash.viewAll"), href: "/goo-studio/outfits" }}>
            {!data ? (
              <p className={`${ROW} text-[13px] text-[var(--foreground-muted)]`}>{t("common.loading")}</p>
            ) : !data.recent.outfits?.length ? (
              <p className={`${ROW} text-[13px] text-[var(--foreground-muted)]`}>{data.recent.outfits ? t("dash.noOutfits") : "—"}</p>
            ) : (
              <ul>
                {data.recent.outfits.map((o, i) => (
                  <li key={o.id} className={`${ROW} ${i ? "border-t border-[var(--border)]" : ""}`}>
                    <span className="relative w-8 h-10 flex-shrink-0 overflow-hidden rounded-md bg-[var(--background)]">
                      {o.image_url && <Image src={o.image_url} alt="" fill className="object-cover" sizes="32px" />}
                    </span>
                    <div className="flex-1 min-w-0 text-[13px] leading-[18px] font-medium text-[var(--foreground)] truncate">{o.name}</div>
                    <span className="w-16 text-right text-[12px] text-[var(--foreground-muted)] tabular-nums whitespace-nowrap">{f.when(o.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
