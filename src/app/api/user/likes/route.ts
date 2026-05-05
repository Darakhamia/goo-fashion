import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ outfits: [], products: [] });
  }

  const { data, error } = await supabase
    .from("user_likes")
    .select("entity_type, entity_id")
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const outfits = (data ?? []).filter((r) => r.entity_type === "outfit").map((r) => r.entity_id);
  const products = (data ?? []).filter((r) => r.entity_type === "product").map((r) => r.entity_id);

  return NextResponse.json({ outfits, products });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { entityType, entityId, liked } = body ?? {};
  if (!entityType || !entityId || typeof liked !== "boolean") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ ok: true });
  }

  if (liked) {
    const { error } = await supabase
      .from("user_likes")
      .upsert({ user_id: userId, entity_type: entityType, entity_id: entityId }, { onConflict: "user_id,entity_type,entity_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("user_likes")
      .delete()
      .eq("user_id", userId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
