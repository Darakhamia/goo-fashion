import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
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

  // Fetch the pending look
  const { data: look, error: fetchErr } = await supabase
    .from("pending_looks")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !look) {
    return NextResponse.json({ error: "Pending look not found" }, { status: 404 });
  }

  // Create an outfit from the pending look
  const { data: outfit, error: insertErr } = await supabase
    .from("outfits")
    .insert({
      name: "Community Look",
      description: "",
      occasion: "casual",
      season: "all",
      image_url: look.generated_image,
      items: [],
      total_price_min: look.total_price ?? 0,
      total_price_max: look.total_price ?? 0,
      currency: "USD",
      style_keywords: look.style_keywords ?? [],
      is_ai_generated: true,
      is_saved: false,
      source: "community",
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("[looks/approve] insert outfit error:", insertErr);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Mark pending look as approved
  await supabase
    .from("pending_looks")
    .update({ status: "approved", outfit_id: outfit?.id ?? null })
    .eq("id", id);

  return NextResponse.json({ ok: true, outfitId: outfit?.id });
}
