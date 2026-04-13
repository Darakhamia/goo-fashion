import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getAllOutfits, createOutfit, outfitToDb } from "@/lib/data/db";

export async function GET() {
  const outfits = await getAllOutfits();
  return NextResponse.json(outfits);
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 501 }
    );
  }

  const body = await req.json();

  // body.items = [{ productId, role }]
  const row = outfitToDb(body);
  const outfit = await createOutfit(row);

  if (!outfit) {
    return NextResponse.json({ error: "Failed to create outfit." }, { status: 500 });
  }

  return NextResponse.json(outfit, { status: 201 });
}
