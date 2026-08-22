import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { MONTHLY_IMAGE_QUOTA, type PlanId } from "@/lib/plans";

/**
 * Monthly usage accounting.
 *
 * The pricing page has always advertised a monthly allowance; nothing counted
 * it. This is that counter. Two rules shape the design:
 *
 * 1. Reserve before spending. The route increments *first* and releases the
 *    slot if the generation fails, rather than incrementing after success. A
 *    check-then-generate order lets a burst of concurrent requests all read the
 *    same count and all pass — which is precisely the "script blows past the
 *    quota" case the quota exists to stop.
 *
 * 2. Fail closed when the ledger is broken, open when it is absent. A
 *    configured-but-erroring database must not become unlimited generation; a
 *    local dev environment with no Supabase at all should still work.
 */

export type UsageKind = "images" | "messages";

/** Calendar month in UTC, e.g. "2026-08" — the bucket key. */
export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** First instant of the next month in UTC: when the allowance comes back. */
export function periodResetsAt(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export interface UsageSnapshot {
  period: string;
  imagesUsed: number;
  messagesUsed: number;
  imageQuota: number;
  imagesRemaining: number;
  /** ISO timestamp when the counters roll over. */
  resetsAt: string;
  /** False when there is no counter to read (Supabase absent). */
  tracked: boolean;
}

function snapshot(
  plan: PlanId,
  imagesUsed: number,
  messagesUsed: number,
  tracked: boolean,
  now = new Date(),
): UsageSnapshot {
  const imageQuota = MONTHLY_IMAGE_QUOTA[plan];
  return {
    period: currentPeriod(now),
    imagesUsed,
    messagesUsed,
    imageQuota,
    imagesRemaining: Math.max(0, imageQuota - imagesUsed),
    resetsAt: periodResetsAt(now).toISOString(),
    tracked,
  };
}

/** Read this month's counters. Never throws — an unreadable ledger reads as zero. */
export async function getUsage(userId: string, plan: PlanId): Promise<UsageSnapshot> {
  if (!isSupabaseConfigured || !supabase) return snapshot(plan, 0, 0, false);

  const { data, error } = await supabase
    .from("usage_monthly")
    .select("images_used,messages_used")
    .eq("user_id", userId)
    .eq("period", currentPeriod())
    .maybeSingle();

  if (error) {
    console.error(`[usage] could not read usage_monthly for ${userId}: ${error.message}`);
    return snapshot(plan, 0, 0, false);
  }
  return snapshot(plan, data?.images_used ?? 0, data?.messages_used ?? 0, true);
}

export interface ReservationDenied {
  ok: false;
  reason: "quota_exceeded" | "ledger_unavailable";
  usage: UsageSnapshot;
  message: string;
}
export interface ReservationGranted {
  ok: true;
  usage: UsageSnapshot;
}

function humanReset(now = new Date()): string {
  return periodResetsAt(now).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Claim one unit of this month's allowance up front.
 *
 * The increment and the limit test are the same operation: the database returns
 * the caller's post-increment position, and anything past the quota is refused
 * and immediately released. Two hundred parallel requests therefore get
 * two hundred distinct positions, and only the ones inside the quota proceed.
 */
export async function reserveUsage(
  userId: string,
  plan: PlanId,
  kind: UsageKind,
  quota: number,
): Promise<ReservationGranted | ReservationDenied> {
  if (!isSupabaseConfigured || !supabase) {
    // No ledger configured at all (local dev). Allowing this keeps the app
    // usable without Supabase; production always has it.
    console.warn("[usage] Supabase is not configured — quota not enforced.");
    return { ok: true, usage: snapshot(plan, 0, 0, false) };
  }

  const period = currentPeriod();
  const column = kind === "images" ? "p_images" : "p_messages";
  const { data, error } = await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_period: period,
    [column]: 1,
  });

  if (error) {
    // Configured but not working. Refusing here costs a generation; allowing it
    // uncaps the bill for as long as the fault lasts.
    console.error(`[usage] increment_usage failed for ${userId}: ${error.message}`);
    return {
      ok: false,
      reason: "ledger_unavailable",
      usage: snapshot(plan, 0, 0, false),
      message: "Usage tracking is temporarily unavailable, so generation is paused. Try again shortly.",
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { images_used?: number; messages_used?: number }
    | null;
  const imagesUsed = row?.images_used ?? 0;
  const messagesUsed = row?.messages_used ?? 0;
  const position = kind === "images" ? imagesUsed : messagesUsed;

  if (position > quota) {
    // Over the line: hand the slot straight back so the counter reflects real
    // usage rather than rejected attempts.
    await releaseUsage(userId, kind);
    const used = kind === "images" ? Math.max(0, imagesUsed - 1) : Math.max(0, messagesUsed - 1);
    return {
      ok: false,
      reason: "quota_exceeded",
      usage: snapshot(plan, kind === "images" ? used : imagesUsed, kind === "messages" ? used : messagesUsed, true),
      message: `You have used all ${quota} of this month's image generations. Your allowance resets on ${humanReset()}.`,
    };
  }

  return { ok: true, usage: snapshot(plan, imagesUsed, messagesUsed, true) };
}

/** Give a reserved unit back — the generation never happened. */
export async function releaseUsage(userId: string, kind: UsageKind): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const column = kind === "images" ? "p_images" : "p_messages";
  const { error } = await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_period: currentPeriod(),
    [column]: -1,
  });
  if (error) {
    // Worth knowing about: the customer has been charged a slot they did not use.
    console.error(`[usage] could not release a reserved ${kind} slot for ${userId}: ${error.message}`);
  }
}
