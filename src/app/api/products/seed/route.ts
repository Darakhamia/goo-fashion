import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb, dbToProduct } from "@/lib/data/db";
import { products as staticProducts } from "@/lib/data/products";
import type { DbProduct } from "@/lib/supabase";

// GET /api/products/seed — check if Supabase is configured (no data change)
export async function GET() {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ configured: false }, { status: 501 });
  }
  return NextResponse.json({ configured: true });
}

// POST /api/products/seed
// Imports the default static catalog into Supabase (skips duplicates by name).
export async function POST() {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 501 }
    );
  }
  // Avoid duplicates: fetch existing names
  const { data: existing } = await supabase.from("products").select("name");
  const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name));
  const toInsert = staticProducts
    .filter((p) => !existingNames.has(p.name))
    .map(productToDb);

  if (toInsert.length === 0) {
    return NextResponse.json({ message: "All products already exist.", inserted: 0 });
  }
  const { data, error } = await supabase
    .from("products")
    .insert(toInsert)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    message: `Inserted ${data?.length ?? 0} products.`,
    inserted: (data as DbProduct[]).map(dbToProduct),
  });
}
