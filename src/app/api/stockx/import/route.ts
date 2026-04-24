import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getStockXVariants, mapStockXToProduct, type StockXProduct } from "@/lib/server/stockx";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb } from "@/lib/data/db";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.products || !Array.isArray(body.products)) {
    return NextResponse.json({ error: "Missing products array" }, { status: 400 });
  }

  const products: StockXProduct[] = body.products;
  const results: { title: string; status: "imported" | "error"; error?: string }[] = [];

  for (const p of products) {
    try {
      const variants = await getStockXVariants(p.productId);
      const sizes = variants
        .map((v) => v.variantValue)
        .filter((v): v is string => v !== null && v !== "");

      const mapped = mapStockXToProduct(p, sizes);
      const row = productToDb(mapped);

      const { error } = await supabase.from("products").insert(row);

      if (error) {
        results.push({ title: p.title, status: "error", error: error.message });
      } else {
        results.push({ title: p.title, status: "imported" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ title: p.title, status: "error", error: message });
    }
  }

  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath("/admin/products");

  const imported = results.filter((r) => r.status === "imported").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ imported, errors, results });
}
