import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getAllProducts } from "@/lib/data/db";
import { productToDb, dbToProduct } from "@/lib/data/db";
import type { DbProduct } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // raw=true → skip variant grouping (used by admin panel to show all products)
  const raw = searchParams.get("raw") === "true";
  const products = await getAllProducts(raw);
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 501 }
    );
  }
  const body = await req.json();
  const row = productToDb(body);
  const { data, error } = await supabase
    .from("products")
    .insert(row)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(dbToProduct(data as DbProduct), { status: 201 });
}
