import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("user_looks")
    .select("*")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const looks = (data ?? []).map((r) => ({
    id: r.id,
    savedAt: r.saved_at,
    name: r.look_name ?? undefined,
    pieces: r.pieces,
    totalPrice: r.total_price,
    styleKeywords: r.style_keywords,
    generatedImage: r.generated_image,
    generatedStyle: r.generated_style,
  }));

  return NextResponse.json(looks);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.pieces) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("user_looks")
    .upsert({
      id: body.id,
      user_id: userId,
      saved_at: body.savedAt ?? new Date().toISOString(),
      look_name: body.name ?? null,
      pieces: body.pieces,
      total_price: body.totalPrice ?? null,
      style_keywords: body.styleKeywords ?? [],
      generated_image: body.generatedImage ?? null,
      generated_style: body.generatedStyle ?? null,
    }, { onConflict: "id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("user_looks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
