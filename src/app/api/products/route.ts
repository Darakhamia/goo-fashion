import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getAllProducts } from "@/lib/data/db";
import { productToDb, dbToProduct } from "@/lib/data/db";
import type { DbProduct } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // raw=true → skip variant grouping (used by admin panel to show all products)
  const raw = searchParams.get("raw") === "true";
  const products = await getAllProducts(raw);
  return NextResponse.json(products, {
    headers: raw
      ? { "Cache-Control": "no-store" } // admin view must always be fresh
      : {
          // Public catalog: CDN-cache 5 min, serve stale while revalidating —
          // this fetch fires every time the stylist drawer opens.
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
  });
}

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
  const row = productToDb(body);
  const { data, error } = await supabase
    .from("products")
    .insert(row)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/");
  return NextResponse.json(dbToProduct(data as DbProduct), { status: 201 });
}
