import { NextResponse } from "next/server";
import { isMonobankConfigured } from "@/lib/server/monobank";
import { syncAllBankSubscriptions } from "@/lib/server/mono-subscriptions";
import { reconcilePendingInvoices } from "@/lib/server/invoice-payments";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hourly reconciliation with monobank (BILLING.md → "Renewal cron on Coolify").
 *
 * monobank's notifications get lost, so every live bank subscription is synced
 * here: unseen charges recorded, cancellations picked up, unpaid payment pages
 * older than two days invalidated, and plans whose cancelled subscription has
 * run out returned to free. Invoices still pending after a lost webhook are
 * checked too. Charges nothing itself, so running it often is safe — unlike
 * /api/billing/cron/renew, which charges saved cards and must stay daily.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`, same as the renewal cron.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isMonobankConfigured) {
    return NextResponse.json({ error: "MONOBANK_TOKEN not configured." }, { status: 503 });
  }

  const bank = await syncAllBankSubscriptions();
  const invoices = await reconcilePendingInvoices();
  return NextResponse.json({
    ok: bank.errors.length === 0,
    subscriptions: {
      synced: bank.synced.length,
      granted: bank.synced.reduce((sum, o) => sum + o.granted, 0),
      errors: bank.errors,
      lapsed: bank.lapsed,
    },
    invoices,
  });
}
