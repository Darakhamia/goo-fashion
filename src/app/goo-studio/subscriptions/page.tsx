"use client";

import { useEffect, useState } from "react";
import { USD_UAH_RATE } from "@/lib/plans";

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
  earnedTotalUah: number;
  earnedThisMonthUah: number;
  paymentsTotal: number;
  byPlan: ByPlan[];
  eventsAvailable: boolean;
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
  currentPeriodEnd: string | null;
  startedAt: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;
const approxUsd = (n: number) => `≈ $${Math.round(n / USD_UAH_RATE).toLocaleString()}`;
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_STYLE: Record<string, string> = {
  active: "text-emerald-600 border-emerald-500/30 bg-emerald-500/10",
  past_due: "text-amber-600 border-amber-500/30 bg-amber-500/10",
  canceled: "text-red-500 border-red-500/30 bg-red-500/10",
  pending: "text-[var(--foreground-muted)] border-[var(--border)] bg-[var(--surface)]",
};
const EVENT_STYLE: Record<string, string> = {
  payment_success: "text-emerald-600 border-emerald-500/30 bg-emerald-500/10",
  payment_failed: "text-red-500 border-red-500/30 bg-red-500/10",
  checkout_started: "text-[var(--foreground-muted)] border-[var(--border)] bg-[var(--surface)]",
  canceled: "text-amber-600 border-amber-500/30 bg-amber-500/10",
  ledger_error: "text-red-500 border-red-500/30 bg-red-500/10",
  card_token_missing: "text-amber-600 border-amber-500/30 bg-amber-500/10",
  card_token_recovered: "text-emerald-600 border-emerald-500/30 bg-emerald-500/10",
};
const EVENT_LABEL: Record<string, string> = {
  payment_success: "Payment",
  payment_failed: "Failed",
  checkout_started: "Checkout",
  canceled: "Canceled",
  // Money moved but the subscription row did not — must not read as routine.
  ledger_error: "Ledger error",
  card_token_missing: "No card",
  card_token_recovered: "Card found",
};

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? "text-[var(--foreground-muted)] border-[var(--border)] bg-[var(--surface)]";
  return (
    <span className={`text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 border rounded-md leading-none ${cls}`}>
      {EVENT_LABEL[value] ?? value.replace(/_/g, " ")}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-5" style={{ background: "var(--background)" }}>
      <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">{label}</p>
      <p className="font-display text-3xl font-light text-[var(--foreground)] mb-1">{value}</p>
      {sub && <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function SubscriptionsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/subscriptions");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load");
        if (active) setData(body as Payload);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return <div className="text-sm text-[var(--foreground-muted)]">Loading subscriptions…</div>;
  }
  if (error || !data) {
    return <div className="text-sm text-red-500">{error ?? "No data"}</div>;
  }

  const { summary, subscriptions, transactions } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Subscriptions & Revenue</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          monobank billing — real charges in UAH, $ shown approximately (rate {USD_UAH_RATE}).
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total earned" value={uah(summary.earnedTotalUah)} sub={approxUsd(summary.earnedTotalUah)} />
        <StatCard label="Earned this month" value={uah(summary.earnedThisMonthUah)} sub={`${summary.paymentsTotal} payments total`} />
        <StatCard label="MRR" value={uah(summary.mrrUah)} sub={approxUsd(summary.mrrUah)} />
        <StatCard label="Active subscribers" value={summary.activeSubscriptions.toLocaleString()} sub={summary.autoRenewOff > 0 ? `${summary.autoRenewOff} won't renew` : "all auto-renew"} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Past due" value={summary.pastDue.toLocaleString()} />
        <StatCard label="Canceled" value={summary.canceled.toLocaleString()} />
        <StatCard label="Pending checkout" value={summary.pending.toLocaleString()} />
        <StatCard
          label="By plan"
          value={summary.byPlan.length ? summary.byPlan.map((p) => `${p.count} ${p.plan}`).join(" · ") : "—"}
        />
      </div>

      {summary.activeWithoutCard > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-500">
          {summary.activeWithoutCard} active {summary.activeWithoutCard === 1 ? "subscription has" : "subscriptions have"} no
          saved card. The renewal sweep skips these, so they will never be charged again — they are
          paid plans running for free. The daily cron retries the card lookup; if the number does not
          fall, the card was never tokenized and the customer has to re-subscribe.
        </div>
      )}

      {!summary.eventsAvailable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600">
          The <code>billing_events</code> table isn&apos;t set up yet — run
          <code className="mx-1">supabase-migration-billing-events.sql</code>. Revenue totals and the
          transaction log will populate once it exists and payments flow through.
        </div>
      )}

      {/* Subscribers table */}
      <section>
        <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">
          Subscribers ({subscriptions.length})
        </p>
        <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: "var(--background)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--foreground-subtle)] border-b border-[var(--border)]">
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Customer</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Plan</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Status</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Price</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Card</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Next renewal</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--foreground-subtle)]">No subscribers yet.</td></tr>
                ) : subscriptions.map((s) => (
                  <tr key={s.userId} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)]">
                    <td className="px-4 py-3 text-[var(--foreground)]">{s.email}</td>
                    <td className="px-4 py-3 capitalize text-[var(--foreground)]">{s.plan}</td>
                    <td className="px-4 py-3"><Badge value={s.status} map={STATUS_STYLE} /></td>
                    <td className="px-4 py-3 text-[var(--foreground)]">{uah(s.amountUah)}/mo</td>
                    <td className="px-4 py-3 text-[var(--foreground-muted)]">
                      {/* The token, not the masked number, is what renewal needs —
                          report on that so a display-only gap doesn't read as broken. */}
                      {s.hasCardToken
                        ? s.maskedPan ? `•• ${s.maskedPan.slice(-4)}` : "saved"
                        : <span className="text-red-500">no card</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--foreground-muted)]">
                      {s.autoRenew ? fmtDate(s.currentPeriodEnd) : <span className="text-[var(--foreground-subtle)]">ends {fmtDate(s.currentPeriodEnd)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Transactions log */}
      <section>
        <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">
          Transaction log ({transactions.length})
        </p>
        <div className="rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: "var(--background)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--foreground-subtle)] border-b border-[var(--border)]">
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">When</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Customer</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Event</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Plan</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Amount</th>
                  <th className="px-4 py-3 font-medium tracking-wide uppercase text-[10px]">Detail</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--foreground-subtle)]">No transactions logged yet.</td></tr>
                ) : transactions.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)]">
                    <td className="px-4 py-3 text-[var(--foreground-muted)] whitespace-nowrap">{fmtDateTime(t.createdAt)}</td>
                    <td className="px-4 py-3 text-[var(--foreground)]">{t.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Badge value={t.eventType} map={EVENT_STYLE} />
                        {t.kind === "renewal" && <span className="text-[9px] text-[var(--foreground-subtle)] uppercase tracking-wide">renewal</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-[var(--foreground-muted)]">{t.plan ?? "—"}</td>
                    <td className="px-4 py-3 text-[var(--foreground)]">{t.amountUah != null ? uah(t.amountUah) : "—"}</td>
                    <td className="px-4 py-3 text-[var(--foreground-subtle)] max-w-[240px] truncate" title={t.detail ?? ""}>{t.detail ?? t.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
