import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PricePoint } from "@/lib/types";

// Generate plausible 30-day mock history around a base price
function mockHistory(basePrice: number): PricePoint[] {
  const points: PricePoint[] = [];
  const today = new Date();
  let price = basePrice * 1.12;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // Random walk ±3%
    price = Math.round(price * (1 + (Math.random() - 0.52) * 0.06));
    points.push({ date: d.toISOString().slice(0, 10), price });
  }
  // Last point = current price
  points[points.length - 1].price = basePrice;
  return points;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isSupabaseConfigured || !supabase) {
    // No DB — fetch the product's current price and return mock history
    const prodRes = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/products/${id}`,
      { cache: "no-store" }
    ).catch(() => null);
    const basePrice = prodRes?.ok ? (await prodRes.json().catch(() => null))?.priceMin ?? 100 : 100;
    return NextResponse.json<PricePoint[]>(mockHistory(basePrice));
  }

  const { data, error } = await supabase
    .from("price_history")
    .select("recorded_at, price, retailer_name")
    .eq("product_id", id)
    .order("recorded_at", { ascending: true })
    .limit(90);

  if (error || !data || data.length === 0) {
    // Table exists but no rows yet — fall back to mock
    const { data: prod } = await supabase
      .from("products")
      .select("price_min")
      .eq("id", id)
      .single();
    return NextResponse.json<PricePoint[]>(mockHistory(prod?.price_min ?? 100));
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
