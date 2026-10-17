import { supabase } from "@/lib/supabase";

/*
 * The state of paid subscriptions, shared by Subscriptions and the dashboard's
 * "Needs attention" (GS1-2): one reading of the table, one set of rules for
 * what counts as overdue, cardless or failing.
 */

export interface SubRow {
  user_id: string;
  plan: string;
  status: string;
  amount: number;
  auto_renew: boolean;
  masked_pan: string | null;
  /** Never leaves the server — only the boolean derived from it is returned. */
  card_token: string | null;
  failed_charges: number;
  current_period_end: string | null;
  /** Set when monobank charges the plan by itself (migration 028); such a row has no card of ours. */
  mono_subscription_id?: string | null;
  /** '1d' for the goo-studio test subscription (migration 029); absent or '1m' for a real plan. */
  billing_interval?: string;
}

/** Supabase returns at most this many rows per request, so totals page through. */
export const PAGE = 1_000;

const SUB_COLUMNS =
  "user_id,plan,status,amount,auto_renew,masked_pan,card_token,failed_charges,current_period_end";
/**
 * Newest schema first: migration 029 adds billing_interval, 028
 * mono_subscription_id. A column that is not there yet drops the read to the
 * next list.
 */
const SUB_COLUMN_SETS = [
  `${SUB_COLUMNS},mono_subscription_id,billing_interval`,
  `${SUB_COLUMNS},mono_subscription_id`,
  SUB_COLUMNS,
];

/**
 * Every subscription, a page at a time. A single `.limit(n)` read stops at
 * PostgREST's row ceiling without saying so, and MRR and every count on the
 * page would quietly come out low. `user_id` (unique) breaks `created_at` ties,
 * so no row lands on two pages or none. A checkout that inserts a row while the
 * pages are read pushes the rest down by one, so a row seen twice is kept once.
 */
export async function readAllSubscriptions(): Promise<{ data: SubRow[]; error: { message: string } | null }> {
  const data: SubRow[] = [];
  if (!supabase) return { data, error: { message: "Database not configured" } };
  const db = supabase;
  const readPage = (columns: string, from: number) =>
    db
      .from("subscriptions")
      .select(columns)
      .order("created_at", { ascending: false })
      .order("user_id", { ascending: true })
      .range(from, from + PAGE - 1);
  const seen = new Set<string>();
  let set = 0;
  for (let from = 0; ; from += PAGE) {
    let q = await readPage(SUB_COLUMN_SETS[set], from);
    while (q.error && (q.error.code === "42703" || q.error.code === "PGRST204") && set < SUB_COLUMN_SETS.length - 1) {
      set++;
      q = await readPage(SUB_COLUMN_SETS[set], from);
    }
    if (q.error) return { data, error: q.error };
    const rows = (q.data ?? []) as unknown as SubRow[];
    for (const row of rows) {
      if (seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      data.push(row);
    }
    if (rows.length < PAGE) return { data, error: null };
  }
}

/** The goo-studio test subscription: 10 UAH a day, the admin's own money, not revenue. */
export function isTestSubscription(s: Pick<SubRow, "billing_interval">): boolean {
  return s.billing_interval === "1d";
}

/** Active, and the paid period has ended without a renewal. */
export function isOverdue(s: Pick<SubRow, "status" | "current_period_end">, now = Date.now()): boolean {
  return s.status === "active" && !!s.current_period_end && new Date(s.current_period_end).getTime() < now;
}

/** The counts that say whether billing works. Amounts stay in kopiykas. */
export function summarizeBilling(subs: SubRow[], now = Date.now()) {
  const active = subs.filter((s) => s.status === "active");
  return {
    active: active.length,
    // Monthly money only: a test subscription's daily 10 UAH is not revenue.
    mrrMinor: active.filter((s) => !isTestSubscription(s)).reduce((sum, s) => sum + s.amount, 0),
    pastDue: subs.filter((s) => s.status === "past_due").length,
    canceled: subs.filter((s) => s.status === "canceled").length,
    pending: subs.filter((s) => s.status === "pending").length,
    autoRenewOff: active.filter((s) => !s.auto_renew).length,
    // Active, auto-renew on, but no saved card: the renewal sweep filters these
    // out, so each one is a customer who paid once and is now using the plan
    // for free. Should be zero. A plan on a monobank subscription is charged by
    // the bank and has no card of ours, so it is not one of them.
    activeWithoutCard: active.filter((s) => s.auto_renew && !s.card_token && !s.mono_subscription_id).length,
    // Active, paid period already ended, still not renewed. The cron should
    // clear these within a day, so a standing number means it is not working.
    overdue: active.filter((s) => isOverdue(s, now)).length,
    // Only subscriptions still being billed. A canceled one keeps its failure
    // count forever (three failures is what cancels it), which would pin this
    // red after the first dunning downgrade.
    failedCharges: subs
      .filter((s) => s.status === "active" || s.status === "past_due")
      .reduce((sum, s) => sum + (s.failed_charges ?? 0), 0),
  };
}
