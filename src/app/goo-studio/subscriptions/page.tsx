"use client";

import { useEffect, useState } from "react";

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

// ── Helpers ───────────────────────────────────────────────────────────────────
const uah = (n: number) => `${n.toLocaleString("uk-UA")} ₴`;
const approxUsd = (n: number, rate: number) => `≈ $${Math.round(n / rate).toLocaleString()}`;
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Admin status recipe (DESIGN_SYSTEM.md §9): bg-X-400/15 text-X-500 border-X-400/30.
const OK = "text-emerald-500 border-emerald-400/30 bg-emerald-400/15";
const WARN = "text-amber-500 border-amber-400/30 bg-amber-400/15";
const BAD = "text-red-500 border-red-400/30 bg-red-400/15";
const NEUTRAL = "text-[var(--foreground-muted)] border-[var(--border)] bg-[var(--surface)]";

const STATUS_STYLE: Record<string, string> = {
  active: OK,
  past_due: WARN,
  canceled: BAD,
  pending: NEUTRAL,
};
const EVENT_STYLE: Record<string, string> = {
  payment_success: OK,
  payment_failed: BAD,
  checkout_started: NEUTRAL,
  canceled: WARN,
  ledger_error: BAD,
  card_token_missing: WARN,
  card_token_recovered: OK,
  renewal_skipped: WARN,
  cron_run: NEUTRAL,
  cron_misconfigured: BAD,
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
  renewal_skipped: "Skipped",
  cron_run: "Cron ran",
  cron_misconfigured: "Cron broken",
};

/** Table header cell — admin recipe (DESIGN_SYSTEM.md §9). */
const TH = "text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal";

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? NEUTRAL;
  return (
    <span className={`text-[9px] tracking-[0.12em] uppercase px-2 py-0.5 border rounded-full leading-none ${cls}`}>
      {EVENT_LABEL[value] ?? value.replace(/_/g, " ")}
    </span>
  );
}

/** Like StatCard, but the number carries a verdict: green is fine, red is not. */
function HealthCard({ label, value, bad, note }: { label: string; value: string; bad: boolean; note: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 min-w-0 ${bad ? "border-red-400/30 bg-red-400/15" : "border-[var(--border)]"}`}
      style={bad ? undefined : { background: "var(--background)" }}>
      <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-1.5">{label}</p>
      <p className={`font-display text-2xl md:text-3xl font-light break-words ${bad ? "text-red-500" : "text-emerald-500"}`}>{value}</p>
      <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">{note}</p>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4 md:p-5 min-w-0" style={{ background: "var(--background)" }}>
      <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">{label}</p>
      <p className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)] mb-1 break-words">{value}</p>
      {sub && <p className="text-[10px] text-[var(--foreground-subtle)] tracking-wide mt-0.5">{sub}</p>}
    </div>
  );
}

/** Active subscribers and MRR per plan. */
function ByPlanCard({ rows }: { rows: ByPlan[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4 md:p-5 min-w-0" style={{ background: "var(--background)" }}>
      <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">By plan</p>
      {rows.length === 0 ? (
        <p className="font-display text-3xl font-light text-[var(--foreground)]">—</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((p) => (
            <li key={p.plan} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
              <span className="capitalize text-[var(--foreground)]">{p.count} {p.plan}</span>
              <span className="text-[var(--foreground-muted)]">{uah(p.mrrUah)}/mo</span>
            </li>
          ))}
        </ul>
      )}
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
  const rate = summary.usdUahRate;
  // Cron heartbeat and payment totals come from billing_events; when it can't
  // be read, "never ran" would be a guess, not a fact.
  const eventsReadable = summary.eventsAvailable && !summary.eventsError;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Subscriptions & Revenue</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          monobank billing — real charges in UAH, $ shown approximately (rate {rate}).
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total earned" value={uah(summary.earnedTotalUah)} sub={approxUsd(summary.earnedTotalUah, rate)} />
        <StatCard label="Earned this month" value={uah(summary.earnedThisMonthUah)} sub={`${summary.paymentsTotal} payments total`} />
        <StatCard label="MRR" value={uah(summary.mrrUah)} sub={approxUsd(summary.mrrUah, rate)} />
        <StatCard label="Active subscribers" value={summary.activeSubscriptions.toLocaleString()} sub={summary.autoRenewOff > 0 ? `${summary.autoRenewOff} won't renew` : "all auto-renew"} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Past due" value={summary.pastDue.toLocaleString()} />
        <StatCard label="Canceled" value={summary.canceled.toLocaleString()} />
        <StatCard label="Pending checkout" value={summary.pending.toLocaleString()} />
        <ByPlanCard rows={summary.byPlan} />
      </div>

      {/* Billing health — the answer to "is billing working?" without opening SQL. */}
      <section>
        <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-3">
          Billing health
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HealthCard
            label="Renewal cron"
            value={!eventsReadable ? "unknown" : summary.hoursSinceCronRun === null ? "never ran" : summary.hoursSinceCronRun < 1 ? "just now" : `${summary.hoursSinceCronRun}h ago`}
            bad={!eventsReadable || summary.hoursSinceCronRun === null || summary.hoursSinceCronRun >= 36}
            note={!summary.eventsAvailable ? "billing_events table missing" : !eventsReadable ? "billing_events unreadable" : summary.lastCronRunAt ? fmtDateTime(summary.lastCronRunAt) : "no heartbeat recorded"}
          />
          <HealthCard
            label="Active without card"
            value={summary.activeWithoutCard.toLocaleString()}
            bad={summary.activeWithoutCard > 0}
            note="never come up for renewal"
          />
          <HealthCard
            label="Overdue"
            value={summary.overdue.toLocaleString()}
            bad={summary.overdue > 0}
            note="paid period ended, not renewed"
          />
          <HealthCard
            label="Failed charges"
            value={summary.failedCharges.toLocaleString()}
            bad={summary.failedCharges > 0}
            note="consecutive, active & past-due only"
          />
        </div>
      </section>

      {summary.activeWithoutCard > 0 && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/15 px-4 py-3 text-xs text-red-500">
          {summary.activeWithoutCard} active {summary.activeWithoutCard === 1 ? "subscription has" : "subscriptions have"} no
          saved card. The renewal sweep skips these, so they will never be charged again — they are
          paid plans running for free. The daily cron retries the card lookup; if the number does not
          fall, the card was never tokenized and the customer has to re-subscribe.
        </div>
      )}

      {eventsReadable && summary.hoursSinceCronRun !== null && summary.hoursSinceCronRun >= 36 && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/15 px-4 py-3 text-xs text-red-500">
          The renewal cron last ran {summary.hoursSinceCronRun} hours ago; it is scheduled daily.
          Nothing is being charged in the meantime. Check the Vercel cron logs and that
          <code className="mx-1">CRON_SECRET</code> is set in Production.
        </div>
      )}

      {eventsReadable && summary.hoursSinceCronRun === null && summary.activeSubscriptions > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-3 text-xs text-amber-500">
          No renewal-cron heartbeat has ever been recorded. Either the schedule has never fired, or
          <code className="mx-1">CRON_SECRET</code> is unset and every call is rejected with 401.
        </div>
      )}

      {summary.eventsError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/15 px-4 py-3 text-xs text-red-500">
          Could not read <code>billing_events</code>: {summary.eventsError}. Revenue totals, the cron
          heartbeat and the transaction log below are incomplete.
        </div>
      )}

      {!summary.eventsAvailable && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-3 text-xs text-amber-500">
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
                <tr className="border-b border-[var(--border)]" style={{ background: "var(--surface)" }}>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Plan</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Price</th>
                  <th className={TH}>Card</th>
                  <th className={TH}>Next renewal</th>
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
                      {s.overdue ? (
                        <span className="text-red-500" title="Paid period ended and the renewal has not gone through">
                          overdue — {fmtDate(s.currentPeriodEnd)}
                        </span>
                      ) : s.autoRenew ? (
                        fmtDate(s.currentPeriodEnd)
                      ) : (
                        <span className="text-[var(--foreground-subtle)]">ends {fmtDate(s.currentPeriodEnd)}</span>
                      )}
                      {s.failedCharges > 0 && (
                        <span className="ml-2 text-[10px] text-amber-500" title="Consecutive failed charges; three downgrades to free">
                          {s.failedCharges} failed
                        </span>
                      )}
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
                <tr className="border-b border-[var(--border)]" style={{ background: "var(--surface)" }}>
                  <th className={TH}>When</th>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Event</th>
                  <th className={TH}>Plan</th>
                  <th className={TH}>Amount</th>
                  <th className={TH}>Detail</th>
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
