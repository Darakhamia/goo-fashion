/**
 * Persist a parsed product into the catalog.
 *
 * Shared by the single-product import route and the bulk crawler. Deduping is by
 * `source_url`: re-importing the same page updates the existing row instead of
 * creating a twin, which is what makes a crawl safe to re-run.
 *
 * Photos are mirrored into our own storage first (see
 * `@/lib/server/storage/product-images`) so the catalog never depends on a
 * retailer CDN staying friendly.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb } from "@/lib/data/db";
import { colorToHex, storeNameFromUrl, isOfficialStore } from "@/lib/server/product-fields";
import { mirrorProductImages } from "@/lib/server/storage/product-images";
import { storeBackgroundColor } from "@/lib/server/bg-color";
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

export interface ImportOptions {
  /** Download photos into Supabase Storage and store our URLs instead. */
  mirrorImages?: boolean;
}

export interface ImportResult {
  ok: boolean;
  productId: string | null;
  updated: boolean;
  error?: string;
  /** How many photos ended up on our storage. */
  imagesMirrored?: number;
  /** Photos we failed to mirror (kept as original URLs). */
  imagesFailed?: number;
}

export async function importParsedProduct(
  p: Record<string, unknown>,
  sourceUrlInput: unknown,
  opts: ImportOptions = {},
): Promise<ImportResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, productId: null, updated: false, error: "Database not configured" };
  }

  const name = String(p.name ?? "").trim().slice(0, 300);
  if (!name) return { ok: false, productId: null, updated: false, error: "Product name is required" };

  const sourceUrl = httpUrl(sourceUrlInput ?? p.sourceUrl) || null;

  const category: Category = CATEGORIES.includes(p.category as Category)
    ? (p.category as Category)
    : "accessories";
  const gender: Gender | undefined = GENDERS.includes(p.gender as Gender)
    ? (p.gender as Gender)
    : undefined;

  const price = Math.max(0, Number(p.price) || 0);
  const priceOriginal = Math.max(0, Number(p.priceOriginal) || 0);
  const currency = String(p.currency ?? "USD").trim().toUpperCase().slice(0, 3) || "USD";

  let images = (Array.isArray(p.images) ? p.images : []).map(httpUrl).filter(Boolean).slice(0, 12);
  let imageUrl = httpUrl(p.imageUrl) || images[0] || "";

  // Mirror photos to our storage before writing the row, so the catalog only
  // ever references URLs we control. A failed download keeps its original URL.
  let imagesMirrored: number | undefined;
  let imagesFailed: number | undefined;
  if (opts.mirrorImages && (imageUrl || images.length)) {
    const mirror = await mirrorProductImages({ imageUrl, images });
    if (mirror.attempted) {
      imageUrl = mirror.imageUrl;
      images = mirror.images;
      imagesMirrored = mirror.mirrored;
      imagesFailed = mirror.failed;
    }
  }

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
        name: storeNameFromUrl(sourceUrl, brand),
        url: sourceUrl,
        price,
        currency,
        availability: "in stock",
        isOfficial: isOfficialStore(sourceUrl, brand),
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
        // PostgREST reports failures in `error` rather than throwing, so an
        // unchecked update reads as success while writing nothing (the silent
        // failure pattern audit item Б1-3 called out on the billing ledger).
        const { data, error } = await supabase
          .from("products").update(dbRow).eq("id", existing.id).select("id").maybeSingle();
        if (error) throw new Error(error.message);
        productId = (data as { id: string } | null)?.id ?? existing.id;
        updated = true;
      } else {
        const { data, error } = await supabase.from("products").insert(dbRow).select("id").maybeSingle();
        if (error) throw new Error(error.message);
        productId = (data as { id: string } | null)?.id ?? null;
      }
    } else {
      const { data, error } = await supabase.from("products").insert(dbRow).select("id").maybeSingle();
      if (error) throw new Error(error.message);
      productId = (data as { id: string } | null)?.id ?? null;
    }
  } catch (err) {
    return {
      ok: false,
      productId: null,
      updated: false,
      error: err instanceof Error ? err.message : "Insert failed",
    };
  }

  // Measure the backdrop the photo was shot on, so the piece lands on the
  // storefront already padded with its own colour instead of framed in white.
  //
  // This happens after the write rather than before it because by now `imageUrl`
  // points at our own storage (mirroring ran above), which is a copy we can
  // fetch without a retailer CDN rate-limiting us. Best-effort: a failure leaves
  // the column null and the batch job in the admin picks the row up.
  if (productId && imageUrl) {
    await storeBackgroundColor(productId, imageUrl);
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

  return { ok: true, productId, updated, imagesMirrored, imagesFailed };
}
