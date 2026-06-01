import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Reset a user's AI Stylist daily message usage.
 *
 * POST body (optional):
 *   { scope: "today" }  → reset only today's counter (default)
 *   { scope: "all" }    → delete all usage rows for the user
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 501 });
  }

  const body = (await req.json().catch(() => ({}))) as { scope?: string };
  const scope = body.scope === "all" ? "all" : "today";

  try {
    if (scope === "all") {
      const { error } = await supabase
        .from("stylist_daily_usage")
        .delete()
        .eq("user_id", id);
      if (error) throw error;
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("stylist_daily_usage")
        .delete()
        .eq("user_id", id)
        .eq("usage_date", today);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, scope });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/stylist-usage] reset failed:", msg);
    return NextResponse.json({ error: "Failed to reset usage." }, { status: 500 });
  }
}
