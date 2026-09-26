import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PricePoint } from "@/lib/types";

// Nothing records real price snapshots, so this route never invents a history:
// no rows means an empty list. The whole feature is slated for removal.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json<PricePoint[]>([]);
  }

  const { data, error } = await supabase
    .from("price_history")
    .select("recorded_at, price, retailer_name")
    .eq("product_id", id)
    .order("recorded_at", { ascending: true })
    .limit(90);

  if (error || !data || data.length === 0) {
    return NextResponse.json<PricePoint[]>([]);
  }

  const points: PricePoint[] = data.map((row) => ({
    date: (row.recorded_at as string).slice(0, 10),
    price: row.price as number,
    retailerName: (row.retailer_name as string | null) ?? undefined,
  }));

  return NextResponse.json<PricePoint[]>(points);
}

// Admin can POST a new price snapshot
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase)
    return NextResponse.json({ error: "DB not configured" }, { status: 501 });

  const { id } = await params;
  const { price, retailerName } = await req.json();
  if (!price) return NextResponse.json({ error: "price required" }, { status: 400 });

  const { error } = await supabase.from("price_history").insert({
    product_id: id,
    price,
    retailer_name: retailerName ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
