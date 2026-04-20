import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb, dbToProduct } from "@/lib/data/db";
import type { DbProduct } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";

// POST /api/products/bulk
// Body: { products: Product[] }
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 501 }
    );
  }
  const body = await req.json();
  const items = Array.isArray(body) ? body : body.products;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Provide an array of products." }, { status: 400 });
  }
  const rows = items.map(productToDb);
  const { data, error } = await supabase
    .from("products")
    .insert(rows)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    { inserted: (data as DbProduct[]).map(dbToProduct) },
    { status: 201 }
  );
}
