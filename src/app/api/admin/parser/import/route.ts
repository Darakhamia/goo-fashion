import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb } from "@/lib/data/db";
import { logAdminAction } from "@/lib/server/audit";
import { clerkClient } from "@clerk/nextjs/server";
import { colorToHex } from "@/lib/server/product-fields";
import type { Product, Category, Gender } from "@/lib/types";

const CATEGORIES: Category[] = [
  "outerwear", "tops", "shirts", "bottoms", "jeans", "shorts", "skirts",
  "footwear", "accessories", "bags", "dresses", "jumpsuits", "knitwear",
  "blazers", "swimwear",
];
const GENDERS: Gender[] = ["women", "men", "unisex"];

function httpUrl(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return /^https?:\/\//.test(s) ? s : "";
}

function retailerNameFromUrl(url: string, fallback: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const root = host.split(".").slice(-2, -1)[0] ?? host;
    return root ? root.charAt(0).toUpperCase() + root.slice(1) : (fallback || "Store");
  } catch {
    return fallback || "Store";
  }
}

// POST { product, sourceUrl } — insert/update one parsed product (dedupe by source_url).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  const body = await req.json().catch(() => null);
  const p = body?.product;
  if (!p || typeof p !== "object") {
    return NextResponse.json({ error: "product is required" }, { status: 400 });
  }

  const name = String(p.name ?? "").trim().slice(0, 300);
  if (!name) return NextResponse.json({ error: "Product name is required" }, { status: 400 });

  const sourceUrl = httpUrl(body?.sourceUrl ?? p.sourceUrl) || null;

  const category: Category = CATEGORIES.includes(p.category) ? p.category : "accessories";
  const gender: Gender | undefined = GENDERS.includes(p.gender) ? p.gender : undefined;

  const price = Math.max(0, Number(p.price) || 0);
  const priceOriginal = Math.max(0, Number(p.priceOriginal) || 0);
  const currency = String(p.currency ?? "USD").trim().toUpperCase().slice(0, 3) || "USD";

  const images = (Array.isArray(p.images) ? p.images : [])
    .map(httpUrl)
    .filter(Boolean)
    .slice(0, 12);
  const imageUrl = httpUrl(p.imageUrl) || images[0] || "";

  const colors = (Array.isArray(p.colors) ? p.colors : [])
    .map((c: unknown) => String(c).trim())
    .filter(Boolean)
    .slice(0, 10);
  const sizes = (Array.isArray(p.sizes) ? p.sizes : [])
    .map((s: unknown) => String(s).trim())
    .filter(Boolean)
    .slice(0, 40);

  const brand = String(p.brand ?? "").trim().slice(0, 80);

  const retailers: Product["retailers"] = sourceUrl
    ? [{
        name: brand || retailerNameFromUrl(sourceUrl, brand),
        url: sourceUrl,
        price,
        currency,
        availability: "in stock",
        isOfficial: true,
      }]
    : [];

  const product: Partial<Product> = {
    name,
    brand: brand as Product["brand"],
    category,
    description: String(p.description ?? "").slice(0, 5000),
    imageUrl,
    images: images.length ? images : (imageUrl ? [imageUrl] : []),
    colors,
    sizes,
    material: String(p.material ?? "").slice(0, 500),
    priceMin: price,
    priceMax: priceOriginal > price ? priceOriginal : price,
    currency,
    isNew: true,
    isSaved: false,
    gender,
    styleKeywords: [],
    retailers,
    ...(colors[0] ? { colorHex: colorToHex(colors[0]) } : {}),
  };

  const dbRow = { ...productToDb(product), source_url: sourceUrl };

  let productId: string | null = null;
  let updated = false;
  try {
    if (sourceUrl) {
      const { data: existing } = await supabase
        .from("products").select("id").eq("source_url", sourceUrl).maybeSingle();
      if (existing?.id) {
        const { data } = await supabase
          .from("products").update(dbRow).eq("id", existing.id).select("id").maybeSingle();
        productId = (data as { id: string } | null)?.id ?? existing.id;
        updated = true;
      } else {
        const { data } = await supabase.from("products").insert(dbRow).select("id").maybeSingle();
        productId = (data as { id: string } | null)?.id ?? null;
      }
    } else {
      const { data } = await supabase.from("products").insert(dbRow).select("id").maybeSingle();
      productId = (data as { id: string } | null)?.id ?? null;
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Insert failed" }, { status: 500 });
  }

  // Record an import job (best-effort — table is optional, ignore if absent).
  if (sourceUrl) {
    try {
      await supabase.from("import_jobs").insert({
        url: sourceUrl,
        status: "done",
        result_product_id: productId,
      });
    } catch { /* import_jobs not migrated — non-critical */ }
  }

  try {
    const cc = await clerkClient();
    const adminUser = await cc.users.getUser(admin.userId);
    void logAdminAction({
      admin_id: admin.userId,
      admin_email: adminUser.emailAddresses[0]?.emailAddress,
      action: "parser.product_imported",
      target_id: productId ?? undefined,
      target_type: "product",
      metadata: { sourceUrl, updated, name },
    });
  } catch { /* non-critical */ }

  revalidatePath("/goo-studio/products");
  revalidatePath("/");

  return NextResponse.json({ ok: true, productId, updated });
}
