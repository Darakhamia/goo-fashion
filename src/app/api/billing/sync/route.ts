import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isMonobankConfigured } from "@/lib/server/monobank";
import { syncUserBankSubscriptions } from "@/lib/server/mono-subscriptions";

/**
 * The customer is back from monobank's payment page. Ask the bank about their
 * subscription now instead of waiting for its knock, which can be late or
 * lost. Only the caller's own subscriptions, and each at most every 15 s.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in." }, { status: 401 });
  }
  if (!isMonobankConfigured) {
    return NextResponse.json({ ok: true, synced: 0 });
  }

  try {
    const outcomes = await syncUserBankSubscriptions(userId);
    return NextResponse.json({
      ok: true,
      synced: outcomes.length,
      granted: outcomes.reduce((sum, o) => sum + o.granted, 0),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
