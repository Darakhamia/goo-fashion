import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { coercePlan, STYLIST_DAILY_LIMITS } from "@/lib/plans";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ remaining: null, limit: null }, { status: 401 });
  }

  // Read the plan from the full user record (publicMetadata is always present
  // here, unlike sessionClaims which depends on the JWT template).
  let plan: ReturnType<typeof coercePlan> = "free";
  try {
    const user = await currentUser();
    plan = coercePlan((user?.publicMetadata as { plan?: unknown } | null)?.plan);
  } catch {
    /* default to free */
  }

  const dailyLimit = STYLIST_DAILY_LIMITS[plan];

  if (dailyLimit === null) {
    return NextResponse.json({ remaining: null, limit: null });
  }

  let usageCount = 0;
  if (isSupabaseConfigured && supabase) {
    const today = new Date().toISOString().split("T")[0];
    try {
      const { data } = await supabase
        .from("stylist_daily_usage")
        .select("count")
        .eq("user_id", userId)
        .eq("usage_date", today)
        .maybeSingle();
      usageCount = (data?.count as number) ?? 0;
    } catch {}
  }

  const remaining = Math.max(0, dailyLimit - usageCount);
  return NextResponse.json({ remaining, limit: dailyLimit });
}
