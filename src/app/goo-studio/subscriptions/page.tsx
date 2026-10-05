"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFormat, useT, type Key, type T } from "@/app/goo-studio/_i18n";
import { PageHeader } from "@/components/admin/PageHeader";
import { AttentionList, type AttentionRow } from "@/components/admin/AttentionList";
import { KpiStrip, type Kpi } from "@/components/admin/KpiStrip";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { DataTable, EmptyState, type Column } from "@/components/admin/DataTable";
import { CRON_FIX } from "@/lib/billing-cron";

/*
 * Subscriptions (docs/ADMIN_DESIGN.md §6, mockup "Subscriptions", GS4-12):
 * what is wrong with billing first, then the key numbers, the subscribers and
 * the transaction log. Read-only; everything comes from
 * GET /api/admin/subscriptions.
 */

// ── Types (mirror /api/admin/subscriptions) ───────────────────────────────────
interface ByPlan { plan: string; count: number; mrrUah: number }
interface Summary {
  mrrUah: number;
  activeSubscriptions: number;
  pastDue: number;
  canceled: number;
  pending: number;
  autoRenewOff: number;
  activeWithoutCard: number;
  overdue: number;
  failedCharges: number;
  lastCronRunAt: string | null;
  hoursSinceCronRun: number | null;
  earnedTotalUah: number;
  earnedThisMonthUah: number;
  paymentsTotal: number;
  byPlan: ByPlan[];
  eventsAvailable: boolean;
  eventsError: string | null;
  /** Display-only UAH per USD, from the server env (BILLING_USD_UAH_RATE). */
  usdUahRate: number;
}
interface SubItem {
  userId: string;
  email: string;
  plan: string;
  status: string;
  amountUah: number;
  autoRenew: boolean;
  maskedPan: string | null;
  hasCardToken: boolean;
  failedCharges: number;
  overdue: boolean;
  currentPeriodEnd: string | null;
}
interface TxItem {
  id: number;
  email: string;
  eventType: string;
  kind: string | null;
  plan: string | null;
  amountUah: number | null;
  status: string | null;
  detail: string | null;
  createdAt: string;
}
interface Payload { summary: Summary; subscriptions: SubItem[]; transactions: TxItem[] }

// ── Words for stored values ───────────────────────────────────────────────────
// Hryvnia amounts and dates go through useFormat (GS4-6): "₴1,224", "Oct 5, 2026".

const PLAN: Record<string, Key> = { free: "plan.free", basic: "plan.basic", pro: "plan.pro", premium: "plan.premium" };

/**
 * A subscription's state as the table shows it. "overdue" is not a stored
 * status: an active subscription whose paid period ended without a renewal.
 * Active is the usual state and gets no badge (ADMIN_DESIGN 5.4).
 */
const STATUS: Record<string, { label: Key; tone: BadgeTone }> = {
  active: { label: "subs.status.active", tone: "ok" },
  overdue: { label: "subs.status.overdue", tone: "warn" },
  past_due: { label: "subs.status.past_due", tone: "warn" },
  canceled: { label: "subs.status.canceled", tone: "err" },
  pending: { label: "subs.status.pending", tone: "neutral" },
};

const EVENT: Record<string, { label: Key; tone: BadgeTone }> = {
  payment_success: { label: "subs.event.payment_success", tone: "ok" },
  payment_failed: { label: "subs.event.payment_failed", tone: "err" },
  checkout_started: { label: "subs.event.checkout_started", tone: "neutral" },
  canceled: { label: "subs.event.canceled", tone: "warn" },
  // Money moved but the subscription row did not — must not read as routine.
  ledger_error: { label: "subs.event.ledger_error", tone: "err" },
  card_token_missing: { label: "subs.event.card_token_missing", tone: "warn" },
  card_token_recovered: { label: "subs.event.card_token_recovered", tone: "ok" },
  renewal_skipped: { label: "subs.event.renewal_skipped", tone: "warn" },
  cron_run: { label: "subs.event.cron_run", tone: "neutral" },
  cron_misconfigured: { label: "subs.event.cron_misconfigured", tone: "err" },
};

/** A stored key the dictionary does not know, as a label: "past_due" → "Past due". */
function sentence(raw: string): string {
  const s = raw.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function planLabel(plan: string, t: T): string {
  return PLAN[plan] ? t(PLAN[plan]) : sentence(plan);
}

function stateOf(s: SubItem): string {
  return s.overdue ? "overdue" : s.status;
}

function StatusBadge({ state, t }: { state: string; t: T }) {
  const known = STATUS[state];
  return <Badge tone={known?.tone ?? "neutral"}>{known ? t(known.label) : sentence(state)}</Badge>;
}

function EventBadge({ type, t }: { type: string; t: T }) {
  const known = EVENT[type];
  return <Badge tone={known?.tone ?? "neutral"}>{known ? t(known.label) : sentence(type)}</Badge>;
}

/** A section title with a muted count beside it. */
function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h2 className="text-[15px] leading-[22px] font-medium text-[var(--foreground)]">{title}</h2>
      {note && <span className="text-[12px] text-[var(--foreground-muted)]">{note}</span>}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function SubscriptionsPage() {
  const t = useT();
  const f = useFormat();
  const uah = (n: number) => f.money(n, "UAH");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  // The server's message; "" when it gave none, worded on screen in the admin's language.
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/subscriptions");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "");
        if (active) setData(body as Payload);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const summary = data?.summary;
  const rate = summary?.usdUahRate ?? 0;
  const approxUsd = (n: number) => (rate > 0 ? `≈ ${f.money(Math.round(n / rate))}` : null);

  const header = (
    <PageHeader
      title={t("nav.subscriptions")}
      subtitle={summary ? t("subs.subtitle", { rate: uah(rate) }) : loading ? t("common.loading") : t("subs.loadFailed")}
    />
  );

  if (!loading && !data) {
    return (
      <div>
        {header}
        <div role="alert" className="rounded-xl border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-3 text-[13px] text-[var(--err)] break-words">
          {error || t("subs.loadFailed")}
        </div>
      </div>
    );
  }

  // ── Needs attention: only billing's own items, in place of the old banners ──
  const rows: AttentionRow[] = [];
  if (summary) {
    // Cron heartbeat and payment totals come from billing_events; when it can't
    // be read, "never ran" would be a guess, not a fact.
    const eventsReadable = summary.eventsAvailable && !summary.eventsError;
    // The renewal cron is where the money comes from: while it is not running,
    // nobody is charged and nothing else on the site says so. It should run daily.
    if (eventsReadable && (summary.hoursSinceCronRun === null || summary.hoursSinceCronRun >= 36)) {
      rows.push({
        key: "cron",
        tone: "err",
        title: t("attn.cron.title"),
        text: summary.lastCronRunAt ? t("attn.cron.stale", { when: f.when(summary.lastCronRunAt) }) : t("attn.cron.never"),
        fix: CRON_FIX,
      });
    }
    if (summary.eventsError) {
      rows.push({
        key: "eventsError",
        tone: "err",
        title: t("subs.attn.eventsError.title"),
        text: t("subs.attn.eventsError.text", { error: summary.eventsError }),
      });
    }
    if (!summary.eventsAvailable) {
      rows.push({
        key: "noEvents",
        tone: "warn",
        title: t("subs.attn.noEvents.title"),
        text: t("subs.attn.noEvents.text"),
        fix: ["supabase-migration-billing-events.sql"],
      });
    }
    if (summary.overdue > 0) {
      rows.push({ key: "overdue", tone: "warn", title: t("attn.overdue.title", { count: summary.overdue }), text: t("attn.overdue.text") });
    }
    if (summary.activeWithoutCard > 0) {
      rows.push({
        key: "noCard",
        tone: "warn",
        title: t("attn.noCard.title", { count: summary.activeWithoutCard }),
        text: t("subs.attn.noCard.text"),
      });
    }
    if (summary.failedCharges > 0) {
      rows.push({
        key: "failedCharges",
        tone: "warn",
        title: t("attn.failedCharges.title", { count: summary.failedCharges }),
        text: t("attn.failedCharges.text"),
      });
    }
  }

  // ── Key numbers ───────────────────────────────────────────────────────────
  const notes = (...parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" · ") || undefined;
  const num = (n: number | undefined) => (n === undefined ? "—" : f.number(n));
  const money = (n: number | undefined) => (n === undefined ? "—" : uah(n));
  const overdueSince = (data?.subscriptions ?? [])
    .filter((s) => s.overdue && s.currentPeriodEnd)
    .map((s) => s.currentPeriodEnd as string)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const kpis: Kpi[] = [
    { key: "mrr", label: t("subs.kpi.mrr"), value: money(summary?.mrrUah), note: summary && notes(approxUsd(summary.mrrUah)) },
    {
      key: "active",
      label: t("subs.kpi.active"),
      value: num(summary?.activeSubscriptions),
      note:
        summary &&
        notes(
          summary.byPlan.map((p) => `${f.number(p.count)} ${planLabel(p.plan, t)}`).join(" · "),
          summary.autoRenewOff > 0 && t("subs.note.wontRenew", { count: summary.autoRenewOff })
        ),
      // MRR per plan, where the "By plan" card used to show it.
      noteTitle: summary?.byPlan.map((p) => `${planLabel(p.plan, t)}: ${t("subs.perMonth", { amount: uah(p.mrrUah) })}`).join(", "),
    },
    {
      key: "overdue",
      label: t("subs.kpi.overdue"),
      value: num(summary?.overdue),
      note: summary?.overdue && overdueSince ? t("subs.note.since", { date: f.date(overdueSince) }) : undefined,
    },
    { key: "pending", label: t("subs.kpi.pending"), value: num(summary?.pending), note: summary && t("subs.note.pending") },
    { key: "pastDue", label: t("subs.kpi.pastDue"), value: num(summary?.pastDue), note: summary && t("subs.note.canceled", { count: summary.canceled }) },
    {
      key: "earned",
      label: t("subs.kpi.earned"),
      value: money(summary?.earnedTotalUah),
      note: summary && notes(approxUsd(summary.earnedTotalUah), t("subs.note.thisMonth", { amount: uah(summary.earnedThisMonthUah) })),
      noteTitle: summary && t("subs.note.payments", { count: summary.paymentsTotal }),
    },
  ];

  // ── Subscribers ───────────────────────────────────────────────────────────
  const price = (s: SubItem) => t("subs.perMonth", { amount: uah(s.amountUah) });

  /** When the paid period ends, and what happens then, in words; null before the first payment of a non-pending row. */
  const renewalText = (s: SubItem): string | null => {
    if (s.overdue) return t("subs.next.overdue", { date: f.date(s.currentPeriodEnd) });
    if (!s.currentPeriodEnd) return s.status === "pending" ? t("subs.next.firstPayment") : null;
    return s.autoRenew ? t("subs.next.renews", { date: f.date(s.currentPeriodEnd) }) : t("subs.next.ends", { date: f.date(s.currentPeriodEnd) });
  };

  const renewalCell = (s: SubItem): ReactNode => {
    let when: ReactNode;
    if (s.overdue) {
      when = (
        <span className="text-[var(--warn)]" title={t("subs.next.overdueHint")}>
          {t("subs.next.overdue", { date: f.date(s.currentPeriodEnd) })}
        </span>
      );
    } else if (!s.currentPeriodEnd) {
      when = <span className="text-[var(--foreground-muted)]">{s.status === "pending" ? t("subs.next.firstPayment") : "—"}</span>;
    } else if (s.autoRenew) {
      when = f.date(s.currentPeriodEnd);
    } else {
      when = <span className="text-[var(--foreground-muted)]">{t("subs.next.ends", { date: f.date(s.currentPeriodEnd) })}</span>;
    }
    return (
      <>
        {when}
        {s.failedCharges > 0 && (
          <span className="ml-2 text-[12px] text-[var(--warn)]" title={t("subs.failedHint")}>
            {t("subs.failed", { count: s.failedCharges })}
          </span>
        )}
      </>
    );
  };

  const subColumns: Column<SubItem>[] = [
    {
      key: "customer",
      header: t("subs.col.customer"),
      grow: true,
      cell: (s) => (
        <span className="block truncate" title={s.email}>
          {s.email}
        </span>
      ),
    },
    { key: "plan", header: t("subs.col.plan"), cell: (s) => planLabel(s.plan, t) },
    {
      key: "status",
      header: t("subs.col.status"),
      cell: (s) =>
        stateOf(s) === "active" ? (
          <span className="text-[var(--foreground-muted)]">{t("subs.status.active")}</span>
        ) : (
          <StatusBadge state={stateOf(s)} t={t} />
        ),
    },
    { key: "price", header: t("subs.col.price"), align: "right", cell: price },
    {
      key: "card",
      header: t("subs.col.card"),
      hide: "lg",
      // The token, not the masked number, is what renewal needs — report on
      // that so a display-only gap doesn't read as broken. Only a subscription
      // still being billed is missing something without one.
      cell: (s) =>
        s.hasCardToken ? (
          <span className="text-[var(--foreground-muted)]">{s.maskedPan ? `•• ${s.maskedPan.slice(-4)}` : t("subs.card.saved")}</span>
        ) : s.status === "active" || s.status === "past_due" ? (
          <span className="text-[var(--warn)]">{t("subs.card.none")}</span>
        ) : (
          <span className="text-[var(--foreground-muted)]">—</span>
        ),
    },
    { key: "renewal", header: t("subs.col.next"), cell: renewalCell },
  ];

  // ── Transaction log ───────────────────────────────────────────────────────
  const txColumns: Column<TxItem>[] = [
    {
      key: "when",
      header: t("subs.col.when"),
      cell: (x) => <span className="text-[var(--foreground-muted)] tabular-nums">{f.dateTime(x.createdAt)}</span>,
    },
    { key: "customer", header: t("subs.col.customer"), cell: (x) => x.email },
    {
      key: "event",
      header: t("subs.col.event"),
      cell: (x) => (
        <span className="inline-flex items-center gap-1.5">
          <EventBadge type={x.eventType} t={t} />
          {x.kind === "renewal" && <span className="text-[12px] text-[var(--foreground-muted)]">{t("subs.kind.renewal")}</span>}
        </span>
      ),
    },
    {
      key: "plan",
      header: t("subs.col.plan"),
      hide: "lg",
      cell: (x) => <span className="text-[var(--foreground-muted)]">{x.plan ? planLabel(x.plan, t) : "—"}</span>,
    },
    { key: "amount", header: t("subs.col.amount"), align: "right", cell: (x) => (x.amountUah != null ? uah(x.amountUah) : "—") },
    {
      key: "detail",
      header: t("subs.col.detail"),
      grow: true,
      cell: (x) => (
        <span className="block truncate text-[var(--foreground-muted)]" title={x.detail ?? ""}>
          {x.detail ?? x.status ?? "—"}
        </span>
      ),
    },
  ];

  const subscriptions = data?.subscriptions ?? [];
  const transactions = data?.transactions ?? [];

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {header}

      <AttentionList rows={rows} loading={!data} />

      <KpiStrip label={t("subs.kpis")} items={kpis} />

      <section className="flex flex-col gap-3">
        <SectionTitle title={t("subs.subscribers")} note={data ? t("subs.subscribers.count", { count: subscriptions.length }) : undefined} />
        <DataTable
          label={t("subs.subscribers")}
          rows={subscriptions}
          rowKey={(s) => s.userId}
          columns={subColumns}
          loading={!data}
          // On a phone: who, the state when it is not the usual one, and what is
          // charged next.
          card={(s) => ({
            title: s.email,
            badge: stateOf(s) === "active" ? undefined : <StatusBadge state={stateOf(s)} t={t} />,
            meta: notes(planLabel(s.plan, t), price(s), renewalText(s)),
          })}
          empty={<EmptyState text={t("subs.empty.subscribers")} />}
        />
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle title={t("subs.log")} note={data ? t("subs.log.count", { count: transactions.length }) : undefined} />
        <DataTable
          label={t("subs.log")}
          rows={transactions}
          rowKey={(x) => String(x.id)}
          columns={txColumns}
          loading={!data}
          card={(x) => ({
            title: x.email,
            badge: <EventBadge type={x.eventType} t={t} />,
            meta: notes(f.dateTime(x.createdAt), x.amountUah != null && uah(x.amountUah), x.detail),
          })}
          empty={<EmptyState text={t("subs.empty.log")} />}
        />
      </section>
    </div>
  );
}
