import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { USD_UAH_RATE } from "@/lib/plans";

// ──────────────────────────────────────────────────────────────────────────
// Data for /goo-studio/subscriptions: revenue totals, the subscriber list, and
// the billing event log (transaction history). Read-only.
// ──────────────────────────────────────────────────────────────────────────

interface SubRow {
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
}

interface EventRow {
  id: number;
  user_id: string;
  event_type: string;
  kind: string | null;
  plan: string | null;
  amount: number | null;
  status: string | null;
  detail: string | null;
  created_at: string;
}

/** PostgREST codes for "relation does not exist" — the migration hasn't run. */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);
/** Supabase returns at most this many rows per request, so totals page through. */
const PAGE = 1_000;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const [subsQ, eventsQ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("user_id,plan,status,amount,auto_renew,masked_pan,card_token,failed_charges,current_period_end")
      .order("created_at", { ascending: false })
      .limit(5_000),
    // The transaction log: the latest 200 events, minus the daily cron
    // heartbeat, which would otherwise crowd real transactions out.
    // billing_events may not exist yet if the migration hasn't been run.
    supabase
      .from("billing_events")
      .select("id,user_id,event_type,kind,plan,amount,status,detail,created_at")
      .neq("event_type", "cron_run")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // Without the subscriptions table every number on the page would be a
  // confident zero — report the failure instead of "No subscribers yet".
  if (subsQ.error) {
    return NextResponse.json(
      { error: `Could not read subscriptions: ${subsQ.error.message}` },
      { status: 500 }
    );
  }
  const subs = (subsQ.data ?? []) as SubRow[];

  // Only a missing table means "run the migration"; any other failure is an
  // error and is shown as one.
  const eventsMissing = !!eventsQ.error && MISSING_TABLE_CODES.has(eventsQ.error.code);
  let eventsError: string | null =
    eventsQ.error && !eventsMissing ? eventsQ.error.message : null;
  const events = (eventsQ.error ? [] : (eventsQ.data ?? [])) as EventRow[];

  // The heartbeat is excluded from the log above, so it is looked up on its own.
  let lastCronRun: { created_at: string } | null = null;
  // "Total earned" covers every logged payment, not just the ones that happen
  // to fall inside the 200-event log window, so it is read separately and in
  // full, a page at a time.
  const payments: { amount: number | null; created_at: string }[] = [];
  if (!eventsQ.error) {
    const cronQ = await supabase
      .from("billing_events")
      .select("created_at")
      .eq("event_type", "cron_run")
      .order("created_at", { ascending: false })
      .limit(1);
    if (cronQ.error) eventsError = cronQ.error.message;
    lastCronRun = (cronQ.data?.[0] as { created_at: string } | undefined) ?? null;

    for (let from = 0; ; from += PAGE) {
      const payQ = await supabase
        .from("billing_events")
        .select("amount,created_at")
        .eq("event_type", "payment_success")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (payQ.error) {
        eventsError = payQ.error.message;
        break;
      }
      const rows = (payQ.data ?? []) as { amount: number | null; created_at: string }[];
      payments.push(...rows);
      if (rows.length < PAGE) break;
    }
  }

  // ── Resolve emails for everyone referenced (subs + events) ────────────────
  const userIds = Array.from(
    new Set([...subs.map((s) => s.user_id), ...events.map((e) => e.user_id)])
  ).slice(0, 500);
  const emailById = new Map<string, string>();
  if (userIds.length > 0) {
    try {
      const cc = await clerkClient();
      const list = await cc.users.getUserList({ userId: userIds, limit: userIds.length });
      for (const u of list.data) {
        emailById.set(u.id, u.emailAddresses[0]?.emailAddress ?? u.id);
      }
    } catch {
      // Non-fatal — fall back to user ids.
    }
  }

  // ── Revenue + counts ──────────────────────────────────────────────────────
  const activeSubs = subs.filter((s) => s.status === "active");
  const byPlan = new Map<string, { count: number; mrr: number }>();
  for (const s of activeSubs) {
    const row = byPlan.get(s.plan) ?? { count: 0, mrr: 0 };
    row.count++;
    row.mrr += s.amount;
    byPlan.set(s.plan, row);
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const earnedTotal = payments.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const earnedThisMonth = payments
    .filter((e) => new Date(e.created_at) >= monthStart)
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const toUah = (minor: number) => Math.round(minor / 100);

  const summary = {
    mrrUah: toUah(activeSubs.reduce((sum, s) => sum + s.amount, 0)),
    activeSubscriptions: activeSubs.length,
    pastDue: subs.filter((s) => s.status === "past_due").length,
    canceled: subs.filter((s) => s.status === "canceled").length,
    pending: subs.filter((s) => s.status === "pending").length,
    autoRenewOff: activeSubs.filter((s) => !s.auto_renew).length,
    // Active, auto-renew on, but no saved card: the renewal sweep filters these
    // out, so each one is a customer who paid once and is now using the plan
    // for free. Should be zero.
    activeWithoutCard: activeSubs.filter((s) => s.auto_renew && !s.card_token).length,
    // Active, paid period already ended, still not renewed. The cron should
    // clear these within a day, so a standing number means it is not working.
    overdue: activeSubs.filter(
      (s) => s.current_period_end && new Date(s.current_period_end) < new Date(),
    ).length,
    // Only subscriptions still being billed. A canceled one keeps its failure
    // count forever (three failures is what cancels it), which would pin this
    // card red after the first dunning downgrade.
    failedCharges: subs
      .filter((s) => s.status === "active" || s.status === "past_due")
      .reduce((sum, s) => sum + (s.failed_charges ?? 0), 0),
    // The renewal cron's heartbeat. A cron that never fires cannot report
    // itself, so a stale timestamp here is the only sign it stopped.
    lastCronRunAt: lastCronRun?.created_at ?? null,
    hoursSinceCronRun: lastCronRun
      ? Math.floor((Date.now() - new Date(lastCronRun.created_at).getTime()) / 3_600_000)
      : null,
    // "Earned" reflects logged successful payments — only complete once the
    // billing_events migration has run and payments have flowed through it.
    earnedTotalUah: toUah(earnedTotal),
    earnedThisMonthUah: toUah(earnedThisMonth),
    paymentsTotal: payments.length,
    byPlan: Array.from(byPlan.entries()).map(([plan, v]) => ({
      plan,
      count: v.count,
      mrrUah: toUah(v.mrr),
    })),
    eventsAvailable: !eventsMissing,
    /** A billing_events read failed for a reason other than a missing table. */
    eventsError,
    /** Display-only UAH per USD. Read here because the env var never reaches the browser. */
    usdUahRate: USD_UAH_RATE,
  };

  const subscriptions = subs.map((s) => ({
    userId: s.user_id,
    email: emailById.get(s.user_id) ?? s.user_id,
    plan: s.plan,
    status: s.status,
    amountUah: toUah(s.amount),
    autoRenew: s.auto_renew,
    maskedPan: s.masked_pan,
    hasCardToken: !!s.card_token,
    failedCharges: s.failed_charges ?? 0,
    overdue:
      s.status === "active" && !!s.current_period_end && new Date(s.current_period_end) < new Date(),
    currentPeriodEnd: s.current_period_end,
  }));

  const transactions = events.map((e) => ({
    id: e.id,
    email: emailById.get(e.user_id) ?? e.user_id,
    eventType: e.event_type,
    kind: e.kind,
    plan: e.plan,
    amountUah: e.amount != null ? toUah(e.amount) : null,
    status: e.status,
    detail: e.detail,
    createdAt: e.created_at,
  }));

  return NextResponse.json({ summary, subscriptions, transactions });
}
