import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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
  current_period_end: string | null;
  created_at: string;
}

interface EventRow {
  id: number;
  user_id: string;
  event_type: string;
  kind: string | null;
  plan: string | null;
  invoice_id: string | null;
  amount: number | null;
  ccy: number | null;
  status: string | null;
  detail: string | null;
  created_at: string;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const [subsQ, eventsQ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("user_id,plan,status,amount,auto_renew,masked_pan,current_period_end,created_at")
      .order("created_at", { ascending: false })
      .limit(5_000),
    // billing_events may not exist yet if the migration hasn't been run.
    supabase
      .from("billing_events")
      .select("id,user_id,event_type,kind,plan,invoice_id,amount,ccy,status,detail,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const subs = (subsQ.error ? [] : (subsQ.data ?? [])) as SubRow[];
  const events = (eventsQ.error ? [] : (eventsQ.data ?? [])) as EventRow[];

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

  const successPayments = events.filter((e) => e.event_type === "payment_success");
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const earnedTotal = successPayments.reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const earnedThisMonth = successPayments
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
    // "Earned" reflects logged successful payments — only complete once the
    // billing_events migration has run and payments have flowed through it.
    earnedTotalUah: toUah(earnedTotal),
    earnedThisMonthUah: toUah(earnedThisMonth),
    paymentsTotal: successPayments.length,
    byPlan: Array.from(byPlan.entries()).map(([plan, v]) => ({
      plan,
      count: v.count,
      mrrUah: toUah(v.mrr),
    })),
    eventsAvailable: !eventsQ.error,
  };

  const subscriptions = subs.map((s) => ({
    userId: s.user_id,
    email: emailById.get(s.user_id) ?? s.user_id,
    plan: s.plan,
    status: s.status,
    amountUah: toUah(s.amount),
    autoRenew: s.auto_renew,
    maskedPan: s.masked_pan,
    currentPeriodEnd: s.current_period_end,
    startedAt: s.created_at,
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
