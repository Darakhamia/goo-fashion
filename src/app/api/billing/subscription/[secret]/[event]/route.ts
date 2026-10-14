import { NextResponse } from "next/server";
import { findByHookSecret, syncMonoSubscription } from "@/lib/server/mono-subscriptions";

/**
 * monobank's knock for a bank-side subscription: `charge` after every charge,
 * `status` when the subscription's state changes.
 *
 * The URL carries the subscriber's secret (only its hash is stored), because
 * monobank's create call has no field for our own id. The body is not read:
 * monobank documents neither its fields nor a signature, so it proves nothing.
 * The knock only says "ask now" — the sync asks the bank with our own token.
 */
export const dynamic = "force-dynamic";

const SECRET = /^[0-9a-f]{48}$/;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ secret: string; event: string }> }
) {
  const { secret, event } = await params;
  if (!SECRET.test(secret) || (event !== "charge" && event !== "status")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const row = await findByHookSecret(secret);
    if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const outcome = await syncMonoSubscription(row);
    return NextResponse.json({ ok: true, status: outcome.status });
  } catch (err) {
    // 5xx makes monobank knock again; the hourly sync is the backstop.
    console.error(`[billing] monobank ${event} knock failed: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}
