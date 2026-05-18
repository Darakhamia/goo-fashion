import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const PLAN_DAILY_LIMITS: Record<string, number | null> = {
  free:  20,
  plus:  150,
  ultra: null,
};

export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ remaining: null, limit: null }, { status: 401 });
  }

  const plan = (sessionClaims?.publicMetadata as Record<string, unknown>)?.plan as string | undefined;
  const dailyLimit = PLAN_DAILY_LIMITS[plan ?? ""] ?? PLAN_DAILY_LIMITS.free;

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
