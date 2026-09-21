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
import { productToDb, writeProductRow } from "@/lib/data/db";
import { colorToHex, colorGroupNamesFor } from "@/lib/server/product-fields";
import { loadRetailerRules, resolveRetailer } from "@/lib/server/retailer-domains";
import { mirrorProductImages } from "@/lib/server/storage/product-images";
import { storeBackgroundColor } from "@/lib/server/bg-color";
import { toUsd } from "@/lib/server/fx";
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Colour filters ────────────────────────────────────────────────────────────
// A product the parser brought in with "Core Black" on it should appear under
// Black in the browse filter without anyone opening the editor. That means
// turning the store's word into `color_group_ids`, which are database ids — so
// the groups have to be read, not guessed. They change about never, and a crawl
// batch imports five products per request, so one read is cached for the run.

const COLOR_GROUP_TTL_MS = 5 * 60_000;
let colorGroupCache: { at: number; byName: Map<string, number> } | null = null;

async function loadColorGroups(): Promise<Map<string, number> | null> {
  if (colorGroupCache && Date.now() - colorGroupCache.at < COLOR_GROUP_TTL_MS) {
    return colorGroupCache.byName;
  }
  const { data, error } = await supabase!.from("color_groups").select("id, name");
  // No table (migration not run) is not an error worth failing an import over —
  // the product lands without a colour filter, exactly as it did before.
  if (error || !data) return null;
  const byName = new Map<string, number>();
  for (const g of data as { id: number; name: string }[]) {
    byName.set(String(g.name).trim().toLowerCase(), g.id);
  }
  colorGroupCache = { at: Date.now(), byName };
  return byName;
}

/** The colour-filter ids a product's colour labels put it under. */
async function colorGroupIdsFor(colors: string[]): Promise<number[] | undefined> {
  const names = colorGroupNamesFor(colors);
  if (!names.length) return undefined;
  const byName = await loadColorGroups();
  if (!byName) return undefined;
  const ids = names
    .map((n) => byName.get(n.toLowerCase()))
    .filter((id): id is number => typeof id === "number");
  return ids.length ? [...new Set(ids)] : undefined;
}

export interface ImportOptions {
  /** Download photos into Supabase Storage and store our URLs instead. */
  mirrorImages?: boolean;
  /**
   * Currency the admin declared for this store, used only when the product
   * carries none. Without it a currency-less price is refused rather than
   * assumed to be dollars.
   */
  fallbackCurrency?: string;
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
  /**
   * Set when the import was refused for something the admin can fix, rather
   * than something broken. Lets the caller report "tell me this store's
   * currency" instead of a generic failure.
   */
  needs?: "currency";
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

  // What currency this price is in, in order of authority: what the page said,
  // then what the admin declared for the store. There is deliberately no third
  // option. Falling back to "USD" here is what put a 4 000 ₴ jacket in the
  // catalogue as a $4 000 jacket, and it did so silently — wrong on the product
  // page, wrong in every price filter, and wrong in the stylist's budget.
  const declared = String(opts.fallbackCurrency ?? "").trim().toUpperCase().slice(0, 3);
  const currency = String(p.currency ?? "").trim().toUpperCase().slice(0, 3) || declared;
  if (price > 0 && !/^[A-Z]{3}$/.test(currency)) {
    return {
      ok: false,
      productId: null,
      updated: false,
      needs: "currency",
      error:
        "This page does not say which currency its price is in. Pick the store's currency and run it again.",
    };
  }

  // The USD scale every comparison uses. Stored, not computed at read time: a
  // rate looked up later would change yesterday's numbers today, and then no
  // query result could be explained. The rate and its date travel with it.
  //
  // A price of zero needs no scale and no rate — there is nothing to convert,
  // and refusing it here would block image-only rows the catalogue already
  // accepts.
  const usd = price > 0 ? await toUsd(price, currency) : null;
  if (price > 0 && !usd) {
    return {
      ok: false,
      productId: null,
      updated: false,
      needs: "currency",
      error: `No exchange rate is available for ${currency}, so this price cannot be compared with the rest of the catalogue.`,
    };
  }
  const priceOriginalUsd =
    usd && priceOriginal > price ? round2(priceOriginal / usd.fxRate) : usd?.priceUsd;

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

  // The store's name and its "official store" flag come from the domain rules
  // when the admin has written one, and from the guesses made off the link only
  // when they haven't. This is the path the bookmarklet uses, so it is where a
  // mislabelled shop would otherwise enter the catalogue one product at a time.
  const retailerRules = sourceUrl ? await loadRetailerRules() : new Map();
  const resolved = sourceUrl ? resolveRetailer(sourceUrl, brand, retailerRules) : null;

  const retailers: Product["retailers"] = sourceUrl && resolved
    ? [{
        name: resolved.name,
        url: sourceUrl,
        price,
        currency,
        availability: "in stock",
        isOfficial: resolved.isOfficial,
      }]
    : [];

  const colorGroupIds = await colorGroupIdsFor(colors);

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
    ...(usd
      ? {
          priceMinUsd: usd.priceUsd,
          priceMaxUsd: priceOriginalUsd ?? usd.priceUsd,
          fxRate: usd.fxRate,
          fxDate: usd.fxDate,
        }
      : {}),
    isNew: true,
    isSaved: false,
    gender,
    styleKeywords: [],
    retailers,
    ...(colors[0] ? { colorHex: colorToHex(colors[0]) } : {}),
    ...(colorGroupIds ? { colorGroupIds } : {}),
  };

  const dbRow = { ...productToDb(product), source_url: sourceUrl };

  // Written through `writeProductRow` so a database that has not run the
  // colour-filter migration drops that one column and still takes the product,
  // instead of every import failing on a column it has never heard of.
  const insert = (row: Record<string, unknown>) =>
    supabase!.from("products").insert(row).select("id").maybeSingle();

  let productId: string | null = null;
  let updated = false;
  try {
    let existingId: string | null = null;
    if (sourceUrl) {
      const { data: existing } = await supabase
        .from("products").select("id").eq("source_url", sourceUrl).maybeSingle();
      existingId = (existing as { id: string } | null)?.id ?? null;
    }

    if (existingId) {
      const id = existingId;
      // PostgREST reports failures in `error` rather than throwing, so an
      // unchecked update reads as success while writing nothing (the silent
      // failure pattern audit item Б1-3 called out on the billing ledger).
      const { data, error } = await writeProductRow<{ id: string }>(dbRow, (row) =>
        supabase!.from("products").update(row).eq("id", id).select("id").maybeSingle(),
      );
      if (error) throw new Error(error.message);
      productId = data?.id ?? id;
      updated = true;
    } else {
      const { data, error } = await writeProductRow<{ id: string }>(dbRow, insert);
      if (error) throw new Error(error.message);
      productId = data?.id ?? null;
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
