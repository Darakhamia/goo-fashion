import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb } from "@/lib/data/db";
import type { Product } from "@/lib/types";

// POST /api/farfetch/import
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "Product data is required" }, { status: 400 });
  }

  const product: Partial<Product> = {
    name: body.name,
    brand: body.brand as Product["brand"],
    category: body.category as Product["category"],
    description: body.description ?? "",
    imageUrl: body.imageUrl ?? "",
    images: body.images ?? [],
    colors: body.colors ?? [],
    sizes: body.sizes ?? [],
    material: "",
    priceMin: body.price ?? 0,
    priceMax: body.price ?? 0,
    currency: body.currency ?? "USD",
    isNew: true,
    isSaved: false,
    gender: body.gender,
    styleKeywords: [],
    retailers: [
      {
        name: "Farfetch",
        url: body.sourceUrl ?? "",
        price: body.price ?? 0,
        currency: body.currency ?? "USD",
        availability: "in stock" as const,
        isOfficial: true,
      },
    ],
  };

  const row = productToDb(product);

  const { data, error } = await supabase
    .from("products")
    .insert(row)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/browse");
  revalidatePath("/admin/products");

  return NextResponse.json({ ok: true, id: data.id });
}
