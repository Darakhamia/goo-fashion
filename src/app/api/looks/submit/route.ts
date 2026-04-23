import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.generatedImage) {
    return NextResponse.json({ error: "generatedImage is required" }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    // Accept gracefully when DB not configured
    return NextResponse.json({ ok: true, id: null });
  }

  const { data, error } = await supabase
    .from("pending_looks")
    .insert({
      user_id: userId,
      generated_image: body.generatedImage,
      generated_style: body.generatedStyle ?? null,
      pieces: body.pieces ?? [],
      total_price: body.totalPrice ?? null,
      style_keywords: body.styleKeywords ?? [],
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[looks/submit]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? null });
}
