import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// Must mirror the limits used in /api/stylist/chat/route.ts
const PLAN_DAILY_LIMITS: Record<string, number | null> = {
  free:    20,
  basic:   50,
  pro:     150,
  premium: null,
  plus:    150,   // legacy alias
  ultra:   null,  // legacy alias
};

export interface UserStats {
  stylistMsgToday:  number;
  stylistMsgTotal:  number;
  stylistLimitDay:  number | null; // null = unlimited
  stylistRemaining: number | null; // null = unlimited
  imagesGenerated:  number;
  looksPublished:   number;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fallback when Supabase is not available
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json<UserStats>({
      stylistMsgToday:  0,
      stylistMsgTotal:  0,
      stylistLimitDay:  20,
      stylistRemaining: 20,
      imagesGenerated:  0,
      looksPublished:   0,
    });
  }

  // Resolve user plan from Clerk
  let plan = "free";
  try {
    const cc = await clerkClient();
    const u  = await cc.users.getUser(id);
    plan = ((u.publicMetadata as { plan?: string })?.plan) ?? "free";
  } catch { /* keep "free" as fallback */ }

  const dailyLimit = Object.prototype.hasOwnProperty.call(PLAN_DAILY_LIMITS, plan)
    ? PLAN_DAILY_LIMITS[plan]
    : 20;

  const today = new Date().toISOString().slice(0, 10);

  const [allUsageRes, todayUsageRes, looksRes, imagesRes] = await Promise.allSettled([
    // All-time usage rows
    supabase
      .from("stylist_daily_usage")
      .select("count")
      .eq("user_id", id),

    // Today's usage row
    supabase
      .from("stylist_daily_usage")
      .select("count")
      .eq("user_id", id)
      .eq("usage_date", today)
      .maybeSingle(),

    // Approved (published) looks
    supabase
      .from("pending_looks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
      .eq("status", "approved"),

    // Generated images — query storage.objects via the internal schema
    supabase
      .schema("storage")
      .from("objects")
      .select("id", { count: "exact", head: true })
      .eq("bucket_id", "generated-outfits")
      .like("name", `${id}/%`),
  ]);

  // Total messages (sum of all daily rows)
  const allRows: { count: number }[] =
    allUsageRes.status === "fulfilled" ? (allUsageRes.value.data ?? []) : [];
  const stylistMsgTotal = allRows.reduce((s, r) => s + (r.count ?? 0), 0);

  // Today's messages
  const todayRow =
    todayUsageRes.status === "fulfilled" ? todayUsageRes.value.data : null;
  const stylistMsgToday = (todayRow as { count?: number } | null)?.count ?? 0;

  // Remaining for today
  const stylistRemaining =
    dailyLimit === null ? null : Math.max(0, dailyLimit - stylistMsgToday);

  // Published looks
  const looksPublished =
    looksRes.status === "fulfilled" ? (looksRes.value.count ?? 0) : 0;

  // Generated images
  const imagesGenerated =
    imagesRes.status === "fulfilled" ? (imagesRes.value.count ?? 0) : 0;

  return NextResponse.json<UserStats>({
    stylistMsgToday,
    stylistMsgTotal,
    stylistLimitDay:  dailyLimit,
    stylistRemaining,
    imagesGenerated,
    looksPublished,
  });
}
