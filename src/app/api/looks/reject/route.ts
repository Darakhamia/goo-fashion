import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const { id } = body ?? {};
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Only a look still waiting can be rejected: one that was approved already
  // has its outfit in the catalogue, and marking it rejected would leave that
  // outfit published under a look the queue calls rejected.
  const { data: marked, error } = await supabase
    .from("pending_looks")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("[looks/reject] mark rejected error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!marked?.length) {
    return NextResponse.json(
      { error: "This look is no longer pending — it was already approved or rejected." },
      { status: 409 }
    );
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "looks.rejected",
    target_id: id,
    target_type: "pending_look",
  });

  return NextResponse.json({ ok: true });
}
