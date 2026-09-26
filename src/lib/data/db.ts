/**
 * Server-side data access layer.
 *
 * Reads Supabase. The demo data in ./products, ./outfits and ./blog is served
 * only when Supabase is not configured at all (local development): on a
 * configured database a failed or empty read returns nothing and logs, because
 * demo looks with Unsplash photos and "#" store links are not something the
 * live site may ever show as its own.
 */
import type { BlogPost, ColorGroup, Outfit, OutfitItem, Product, ProductSwatch } from "@/lib/types";
import { supabase, isSupabaseConfigured, type DbBlogPost, type DbOutfit, type DbProduct, type DbColorGroup, dbToColorGroup } from "@/lib/supabase";
import { products as staticProducts } from "./products";
import { outfits as staticOutfits } from "./outfits";
import { blogPosts as staticBlogPosts } from "./blog";
import { storeNameFromUrl, isOfficialStore } from "@/lib/server/product-fields";
import { findSupportedStore, storeFaviconUrl, storeHomepageUrl, type SupportedStore } from "@/lib/stores";
import { writeRowDroppingUnknown, type WriteError } from "@/lib/server/write-row";

// Older imports stored the *brand* as the store name (so "Where to buy" rows
// read e.g. "Supreme" instead of "Farfetch"). Correct those at read time:
// only when a retailer's name matches the brand AND its link resolves to a
// real, different store — leaving genuine official-store rows untouched.
function normalizeRetailers(
  retailers: Product["retailers"],
  brand: string,
): Product["retailers"] {
  const slug = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const brandSlug = slug(brand);
  if (!brandSlug || !Array.isArray(retailers)) return retailers ?? [];
  return retailers.map((r) => {
    if (!r?.url || slug(r.name) !== brandSlug) return r;
    // A row that says it *is* the brand's own shop is entitled to carry the
    // brand's name — that is what an official store is. The comment above has
    // always promised to leave those alone; the code never checked the flag, so
    // every official store had its name replaced by its own host on the way out
    // of the database ("Enfants Riches Déprimés" served as
    // "Enfantsrichesdeprimes"), and the flag was then recomputed to false by a
    // heuristic that cannot see through an accent.
    //
    // That also made retailer domain rules inert exactly where they matter
    // most: a rule naming a brand's own shop after the brand was undone on
    // every read, so applying it appeared to do nothing at all.
    if (r.isOfficial === true) return r;
    const derived = storeNameFromUrl(r.url, "");
    if (!derived || derived === "Store" || slug(derived) === brandSlug) return r;
    return { ...r, name: derived, isOfficial: isOfficialStore(r.url, brand) };
  });
}

function isWithinLastWeek(dateStr?: string): boolean {
  if (!dateStr) return false;
  return Date.now() - new Date(dateStr).getTime() < 7 * 24 * 60 * 60 * 1000;
}

function shuffleArray<T>(arr: T[]): T[] {
  let s = 0x4a3f2e1d;
  const rng = () => {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return s / 0x100000000;
  };
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function dbToProduct(row: DbProduct): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand as Product["brand"],
    category: row.category as Product["category"],
    subcategory: row.subcategory ?? undefined,
    description: row.description ?? "",
    // Serve the exact stored URLs. Higher-resolution variants are requested at
    // render time by the image component, which falls back to these originals
    // if a CDN won't serve the upscaled size — so a photo never disappears.
    imageUrl: row.image_url ?? "",
    images: row.images ?? [],
    colors: row.colors ?? [],
    colorImages: row.color_images ?? undefined,
    sizes: row.sizes ?? [],
    material: row.material ?? "",
    retailers: normalizeRetailers((row.retailers as Product["retailers"]) ?? [], row.brand),
    priceMin: row.price_min,
    priceMax: row.price_max,
    currency: row.currency ?? "USD",
    isNew: (row.is_new ?? false) && isWithinLastWeek(row.created_at),
    isSaved: row.is_saved ?? false,
    styleKeywords: (row.style_keywords ?? []) as Product["styleKeywords"],
    gender: (row.gender ?? undefined) as Product["gender"],
    variantGroupId: row.variant_group_id ?? undefined,
    colorHex: row.color_hex ?? undefined,
    isGroupPrimary: row.is_group_primary ?? undefined,
    cropData: row.crop_data ?? undefined,
    colorGroupIds: row.color_group_ids?.length ? row.color_group_ids : undefined,
    createdAt: row.created_at,
    bgColor: row.bg_color ?? undefined,
    sourcePrice: row.source_price ?? undefined,
    sourceCurrency: row.source_currency ?? undefined,
    fxRate: row.fx_rate ?? undefined,
    fxDate: row.fx_date ?? undefined,
    gtin: row.gtin ?? undefined,
    mpn: row.mpn ?? undefined,
    sku: row.sku ?? undefined,
  };
}

export function productToDb(p: Partial<Product>) {
  const base = {
    name: p.name ?? "",
    brand: p.brand ?? "",
    category: p.category ?? "",
    description: p.description ?? "",
    image_url: p.imageUrl ?? "",
    images: p.images ?? [],
    colors: p.colors ?? [],
    sizes: p.sizes ?? [],
    material: p.material ?? "",
    retailers: p.retailers ?? [],
    price_min: p.priceMin ?? 0,
    price_max: p.priceMax ?? p.priceMin ?? 0,
    currency: p.currency ?? "USD",
    is_new: p.isNew ?? false,
    is_saved: p.isSaved ?? false,
    style_keywords: p.styleKeywords ?? [],
  };
  const extras: Record<string, unknown> = {};
  if (p.colorImages && Object.keys(p.colorImages).length > 0) {
    extras.color_images = p.colorImages;
  }
  if (p.gender) extras.gender = p.gender;
  // Sent only when the caller has an opinion, so importers that predate the
  // column keep working against a database that has not run migration 010.
  // An empty string means "cleared", which is a null rather than a no-op.
  if (p.subcategory !== undefined) extras.subcategory = p.subcategory || null;
  if (p.variantGroupId !== undefined) extras.variant_group_id = p.variantGroupId ?? null;
  if (p.colorHex !== undefined)       extras.color_hex = p.colorHex ?? null;
  if (p.isGroupPrimary !== undefined) extras.is_group_primary = p.isGroupPrimary ?? false;
  if (p.cropData !== undefined)       extras.crop_data = p.cropData ?? null;
  if (p.colorGroupIds !== undefined)  extras.color_group_ids = p.colorGroupIds ?? [];
  if (p.bgColor !== undefined)        extras.bg_color = p.bgColor ?? null;
  // The store's own price, kept beside the catalogue's converted one.
  if (p.sourcePrice !== undefined)    extras.source_price = p.sourcePrice ?? null;
  if (p.sourceCurrency !== undefined) extras.source_currency = p.sourceCurrency || null;
  if (p.fxRate !== undefined)         extras.fx_rate = p.fxRate ?? null;
  if (p.fxDate !== undefined)         extras.fx_date = p.fxDate || null;
  // Codes that identify the item, not the listing.
  if (p.gtin !== undefined)           extras.gtin = p.gtin || null;
  if (p.mpn !== undefined)            extras.mpn = p.mpn || null;
  if (p.sku !== undefined)            extras.sku = p.sku || null;
  return { ...base, ...extras };
}

/**
 * Columns that arrived with a migration and may not exist yet on a database
 * the code has been deployed ahead of.
 */
export const OPTIONAL_COLUMNS = [
  "subcategory",
  "color_group_ids",
  "crop_data",
  "color_images",
  "variant_group_id",
  "color_hex",
  "is_group_primary",
  "bg_color",
  "source_price",
  "source_currency",
  "fx_rate",
  "fx_date",
  "price_min_usd",
  "price_max_usd",
  "gtin",
  "mpn",
  "sku",
];

/**
 * Runs a product write, dropping optional columns the database does not have
 * and retrying rather than failing the whole save.
 *
 * Without this, deploying before running a migration takes down the entire
 * product editor — every save carries the new column, so nothing can be saved
 * at all, not just the field the migration added. The dropped names come back
 * so the caller can say what did not persist instead of silently losing it.
 *
 * The mechanism itself lives in lib/server/write-row, because the look
 * submission pipeline needs the same behaviour for its own optional columns.
 */
export function writeProductRow<T>(
  row: Record<string, unknown>,
  // Supabase query builders are thenable rather than real Promises.
  write: (row: Record<string, unknown>) => PromiseLike<{ data: T | null; error: WriteError | null }>,
) {
  return writeRowDroppingUnknown(row, OPTIONAL_COLUMNS, write);
}

/** Names the columns a save could not write, and why. */
export function missingColumnWarning(dropped: string[]): string {
  return `Saved, but ${dropped.join(", ")} ${dropped.length > 1 ? "were" : "was"} not stored — the database is missing ${dropped.length > 1 ? "those columns" : "that column"}. Run the pending migration in supabase/migrations.`;
}

/**
 * The product columns the site reads: everything dbToProduct maps, and not
 * `embedding`. That one is a 1536-float vector per row, used only inside the
 * semantic-search SQL function, and `select("*")` dragged it into every
 * catalogue read just to throw it away.
 */
const PRODUCT_READ_COLUMNS = [
  "id", "name", "brand", "category", "subcategory", "description", "image_url",
  "images", "colors", "color_images", "sizes", "material", "retailers",
  "price_min", "price_max", "currency", "is_new", "is_saved", "style_keywords",
  "gender", "created_at", "variant_group_id", "color_hex", "is_group_primary",
  "crop_data", "color_group_ids", "bg_color", "source_price", "source_currency",
  "fx_rate", "fx_date", "gtin", "mpn", "sku",
];

/** Read columns a database a migration behind may lack; the rest are required. */
const OPTIONAL_READ_COLUMNS = new Set<string>([...OPTIONAL_COLUMNS, "gender"]);

/**
 * Codes for "no such column": Postgres' own (what a select naming one returns)
 * and PostgREST's schema-cache variant.
 */
const UNKNOWN_READ_COLUMN_CODES = new Set(["42703", "PGRST204"]);

// Narrows for the life of the server instance once a column turns out to be
// missing, so every later read doesn't pay for the same failed request first.
let productReadColumns = PRODUCT_READ_COLUMNS;

type ReadResult = { data: unknown; error: { code?: string; message: string } | null };

/**
 * Runs a product read with the explicit column list, dropping an optional
 * column the database does not have yet and retrying — the read-side twin of
 * writeProductRow. Without it, naming a column is riskier than `*`: one
 * migration not yet run would take the whole catalogue down.
 */
async function selectProducts(
  // Supabase query builders are thenable rather than real Promises.
  run: (columns: string) => PromiseLike<ReadResult>,
): Promise<ReadResult> {
  for (;;) {
    const result = await run(productReadColumns.join(","));
    const { error } = result;
    if (!error || !UNKNOWN_READ_COLUMN_CODES.has(error.code ?? "")) return result;

    const missing = productReadColumns.find(
      (c) => OPTIONAL_READ_COLUMNS.has(c) && new RegExp(`\\b${c}\\b`).test(error.message),
    );
    if (!missing) return result;

    console.warn(
      `[db] products.${missing} does not exist — reading without it. Run the pending migration in supabase/migrations.`,
    );
    productReadColumns = productReadColumns.filter((c) => c !== missing);
  }
}

const DEFAULT_COLOR_GROUPS: ColorGroup[] = [
  { id: 1,  name: "White",      hexCode: "#ffffff",     sortOrder: 1 },
  { id: 2,  name: "Multicolor", hexCode: "#multicolor", sortOrder: 2 },
  { id: 3,  name: "Brown",      hexCode: "#7a4f35",     sortOrder: 3 },
  { id: 4,  name: "Pink",       hexCode: "#e8698a",     sortOrder: 4 },
  { id: 5,  name: "Yellow",     hexCode: "#f5c518",     sortOrder: 5 },
  { id: 6,  name: "Orange",     hexCode: "#e87722",     sortOrder: 6 },
  { id: 7,  name: "Grey",       hexCode: "#808080",     sortOrder: 7 },
  { id: 8,  name: "Black",      hexCode: "#111111",     sortOrder: 8 },
  { id: 9,  name: "Green",      hexCode: "#2d6a3f",     sortOrder: 9 },
  { id: 10, name: "Red",        hexCode: "#c0392b",     sortOrder: 10 },
  { id: 11, name: "Violet",     hexCode: "#7b3fa0",     sortOrder: 11 },
  { id: 12, name: "Blue",       hexCode: "#1a47a0",     sortOrder: 12 },
  { id: 13, name: "Beige",      hexCode: "#d4c5a9",     sortOrder: 13 },
];

/**
 * Fetches all base color groups from Supabase (used in the filter sidebar).
 * Falls back to DEFAULT_COLOR_GROUPS if Supabase is not configured.
 */
export async function getAllColorGroups(): Promise<ColorGroup[]> {
  if (!isSupabaseConfigured || !supabase) return DEFAULT_COLOR_GROUPS;
  const { data, error } = await supabase
    .from("color_groups")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[db] getAllColorGroups:", error.message);
    return DEFAULT_COLOR_GROUPS;
  }
  return (data as DbColorGroup[]).map(dbToColorGroup);
}

/**
 * Build a lightweight swatch from a product row.
 * colorName falls back to the first listed color then the product name.
 */
function toSwatch(p: Product): ProductSwatch {
  return {
    id:            p.id,
    name:          p.name,
    colorName:     p.colors?.[0] || p.name,
    colorHex:      p.colorHex ?? "#888888",
    priceMin:      p.priceMin,
    priceMax:      p.priceMax,
    imageUrl:      p.imageUrl,
    images:        p.images ?? [],
    sizes:         p.sizes ?? [],
    colorGroupIds: p.colorGroupIds,
    bgColor:       p.bgColor,
  };
}

/**
 * Fetches all products and groups linked variants.
 *
 * Products with the same variantGroupId are merged:
 * – The primary product (isGroupPrimary=true) appears in the list with a
 *   `variants` array containing swatches of all siblings (including itself).
 * – Non-primary products in a group are removed from the top-level list.
 * – Products without a group are returned unchanged.
 */
export async function getAllProducts(skipGrouping = false): Promise<Product[]> {
  const { products, error } = await readAllProducts(skipGrouping);
  if (error) console.error("[db] getAllProducts:", error);
  return products;
}

/**
 * getAllProducts that reports a failed read instead of answering with an empty
 * catalogue — for the admin, where "the database is down" and "there are no
 * products" must not look the same.
 */
export async function readAllProducts(
  skipGrouping = false,
): Promise<{ products: Product[]; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { products: staticProducts, error: null };

  const PAGE = 1000;
  const allData: DbProduct[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await selectProducts((columns) =>
      supabase!
        .from("products")
        .select(columns)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1),
    );

    if (error) return { products: [], error: error.message };

    const rows = (data ?? []) as DbProduct[];
    allData.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }

  const all = allData.map(dbToProduct);
  const grouped = skipGrouping ? all : groupVariants(all);
  // Admin view (skipGrouping=true) keeps the deterministic newest-first order from
  // the DB query so the table doesn't reshuffle on every refresh. The public catalog
  // stays shuffled for visual variety between visits.
  return { products: skipGrouping ? grouped : shuffleArray(grouped), error: null };
}

/**
 * Group products by variantGroupId, attaching swatches to the primary.
 * Products not in any group pass through unmodified.
 */
export function groupVariants(all: Product[]): Product[] {
  // Collect all groups: groupId → list of products
  const groups = new Map<string, Product[]>();
  const ungrouped: Product[] = [];

  for (const p of all) {
    if (p.variantGroupId) {
      const list = groups.get(p.variantGroupId) ?? [];
      list.push(p);
      groups.set(p.variantGroupId, list);
    } else {
      ungrouped.push(p);
    }
  }

  const grouped: Product[] = [];
  for (const [, members] of groups) {
    // Find primary; fall back to first member if none explicitly marked
    const primary = members.find((m) => m.isGroupPrimary) ?? members[0];
    const swatches = members.map(toSwatch);
    // Merge colorGroupIds from all variants so any member's color shows in filters
    const mergedColorGroupIds = [
      ...new Set(members.flatMap((m) => m.colorGroupIds ?? [])),
    ];
    grouped.push({
      ...primary,
      variants: swatches,
      colorGroupIds: mergedColorGroupIds.length ? mergedColorGroupIds : primary.colorGroupIds,
    });
  }

  // Preserve original ordering: ungrouped products stay in their positions
  const result: Product[] = [];
  for (const p of all) {
    if (!p.variantGroupId) {
      result.push(p);
    } else if ((p.isGroupPrimary || !groups.get(p.variantGroupId)?.find((m) => m.isGroupPrimary)) &&
               p.id === (groups.get(p.variantGroupId)?.find((m) => m.isGroupPrimary) ?? groups.get(p.variantGroupId)?.[0])?.id) {
      const withVariants = grouped.find((g) => g.id === p.id);
      if (withVariants) result.push(withVariants);
    }
    // non-primary members of a group are silently skipped
  }

  return result;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  if (!isSupabaseConfigured || !supabase) return undefined;
  const { data, error } = await selectProducts((columns) =>
    supabase!.from("products").select(columns).eq("id", id).maybeSingle(),
  );
  if (error) {
    console.error("[db] getProductById:", error.message);
    return undefined;
  }
  if (!data) return undefined;
  const product = dbToProduct(data as DbProduct);

  // If part of a variant group, fetch all siblings and attach as swatches
  if (product.variantGroupId) {
    const groupId = product.variantGroupId;
    const { data: siblings } = await selectProducts((columns) =>
      supabase!.from("products").select(columns).eq("variant_group_id", groupId),
    );
    const rows = (siblings ?? []) as DbProduct[];
    if (rows.length > 0) {
      product.variants = rows.map(dbToProduct).map(toSwatch);
    }
  }

  return product;
}

// PostgREST carries `.in()` filters in the URL; 200 UUIDs keep it well short
// of the length proxies reject.
const ID_BATCH = 200;

/** Products by id, in no particular order, with the first failure reported. */
async function readProductsByIds(ids: string[]): Promise<{ products: Product[]; error: string | null }> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { products: [], error: null };
  if (!isSupabaseConfigured || !supabase) {
    const wanted = new Set(unique);
    return { products: staticProducts.filter((p) => wanted.has(p.id)), error: null };
  }

  const products: Product[] = [];
  for (let i = 0; i < unique.length; i += ID_BATCH) {
    const batch = unique.slice(i, i + ID_BATCH);
    const { data, error } = await selectProducts((columns) =>
      supabase!.from("products").select(columns).in("id", batch),
    );
    if (error) return { products, error: error.message };
    products.push(...((data ?? []) as DbProduct[]).map(dbToProduct));
  }
  return { products, error: null };
}

/** Id → product for the ids given; what outfits and looks hydrate against. */
async function loadProductMap(ids: string[]): Promise<Map<string, Product>> {
  const { products, error } = await readProductsByIds(ids);
  if (error) console.error("[db] loadProductMap:", error);
  return new Map(products.map((p) => [p.id, p]));
}

/**
 * Just the products asked for, in the order asked for, ungrouped — a colour
 * variant is a product in its own right. Ids no longer in the catalogue are
 * left out. Replaces reading the whole catalogue to pick a handful from it.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const { products, error } = await readProductsByIds(ids);
  if (error) console.error("[db] getProductsByIds:", error);
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

/**
 * Swaps each grouped product for its group's primary, carrying a swatch for
 * every colour — what groupVariants gives a product when the whole catalogue
 * is loaded, for a handful of products that were read on their own.
 */
async function withFullVariantGroups(list: Product[]): Promise<Product[]> {
  const groupIds = [...new Set(list.map((p) => p.variantGroupId).filter((g): g is string => Boolean(g)))];
  if (groupIds.length === 0 || !isSupabaseConfigured || !supabase) return list;

  const { data, error } = await selectProducts((columns) =>
    supabase!.from("products").select(columns).in("variant_group_id", groupIds),
  );
  if (error) {
    console.error("[db] withFullVariantGroups:", error.message);
    return list;
  }
  const byGroup = new Map<string, Product>();
  for (const p of groupVariants(((data ?? []) as DbProduct[]).map(dbToProduct))) {
    if (p.variantGroupId) byGroup.set(p.variantGroupId, p);
  }
  return list.map((p) => (p.variantGroupId && byGroup.get(p.variantGroupId)) || p);
}

// How many of a category's newest products "You may also like" picks from.
const RELATED_POOL = 24;

/**
 * "You may also like" for a product page: others from the same category, never
 * the product itself or another colour of it. Reads a small pool of the
 * category's newest pieces instead of the whole catalogue.
 */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const isSelf = (p: Product) =>
    p.id === product.id || (!!product.variantGroupId && p.variantGroupId === product.variantGroupId);

  if (!isSupabaseConfigured || !supabase) {
    return staticProducts.filter((p) => p.category === product.category && !isSelf(p)).slice(0, limit);
  }

  const { data, error } = await selectProducts((columns) =>
    supabase!
      .from("products")
      .select(columns)
      .eq("category", product.category)
      .neq("id", product.id)
      .order("created_at", { ascending: false })
      .limit(RELATED_POOL),
  );
  if (error) {
    console.error("[db] getRelatedProducts:", error.message);
    return [];
  }

  const pool = groupVariants(((data ?? []) as DbProduct[]).map(dbToProduct)).filter((p) => !isSelf(p));
  return withFullVariantGroups(shuffleArray(pool).slice(0, limit));
}

// ============================================================
// Outfit CRUD
// ============================================================

/**
 * Converts a DB outfit row (with product_id references) to a full Outfit object
 * by looking up products from the provided map.
 */
function dbToOutfit(row: DbOutfit, productMap: Map<string, Product>): Outfit {
  const items: OutfitItem[] = [];
  for (const item of row.items ?? []) {
    const product = productMap.get(item.product_id);
    if (product) {
      items.push({ product, role: item.role, selectedColor: item.selected_color });
    }
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    occasion: row.occasion as Outfit["occasion"],
    imageUrl: row.image_url ?? "",
    items,
    totalPriceMin: row.total_price_min,
    totalPriceMax: row.total_price_max,
    currency: row.currency ?? "USD",
    styleKeywords: (row.style_keywords ?? []) as Outfit["styleKeywords"],
    isAIGenerated: row.is_ai_generated ?? false,
    isSaved: row.is_saved ?? false,
    season: (row.season ?? "all") as Outfit["season"],
    source: (row.source === "community" ? "community" : null),
    isHomepageFeatured: row.is_homepage_featured ?? false,
    createdAt: row.created_at,
  };
}

export interface OutfitApiBody {
  name?: string;
  description?: string;
  occasion?: string;
  imageUrl?: string;
  items?: { productId: string; role: string; selectedColor?: string }[];
  totalPriceMin?: number;
  totalPriceMax?: number;
  currency?: string;
  styleKeywords?: string[];
  isAIGenerated?: boolean;
  isSaved?: boolean;
  season?: string;
}

export function outfitToDb(o: OutfitApiBody) {
  return {
    name: o.name ?? "",
    description: o.description ?? "",
    occasion: o.occasion ?? "casual",
    image_url: o.imageUrl ?? "",
    items: (o.items ?? []).map((i) => ({ product_id: i.productId, role: i.role, selected_color: i.selectedColor })),
    total_price_min: o.totalPriceMin ?? 0,
    total_price_max: o.totalPriceMax ?? o.totalPriceMin ?? 0,
    currency: o.currency ?? "USD",
    style_keywords: o.styleKeywords ?? [],
    is_ai_generated: o.isAIGenerated ?? false,
    is_saved: o.isSaved ?? false,
    season: o.season ?? "all",
  };
}

/** Every product id an outfit row names. */
function outfitProductIds(rows: DbOutfit[]): string[] {
  return rows.flatMap((r) => (r.items ?? []).map((i) => i.product_id));
}

export async function getAllOutfits(): Promise<Outfit[]> {
  const { outfits, error } = await readAllOutfits();
  if (error) console.error("[db] getAllOutfits:", error);
  return outfits;
}

/**
 * getAllOutfits that reports a failed read, so an admin list can say the
 * database failed instead of showing an empty table.
 */
export async function readAllOutfits(): Promise<{ outfits: Outfit[]; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { outfits: staticOutfits, error: null };

  const { data, error } = await supabase
    .from("outfits")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return { outfits: [], error: error.message };

  const rows = (data ?? []) as DbOutfit[];
  if (rows.length === 0) return { outfits: [], error: null };

  const productMap = await loadProductMap(outfitProductIds(rows));
  return { outfits: rows.map((r) => dbToOutfit(r, productMap)), error: null };
}

export async function createOutfit(
  data: ReturnType<typeof outfitToDb>
): Promise<{ outfit: Outfit | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { outfit: null, error: "Database not configured." };

  const { data: row, error } = await supabase
    .from("outfits")
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error("[db] createOutfit:", error.message);
    return { outfit: null, error: error.message };
  }

  // Hydrate returned row
  const productMap = await loadProductMap(outfitProductIds([row as DbOutfit]));

  return { outfit: dbToOutfit(row as DbOutfit, productMap), error: null };
}

export async function updateOutfit(
  id: string,
  data: ReturnType<typeof outfitToDb>
): Promise<Outfit | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: row, error } = await supabase
    .from("outfits")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[db] updateOutfit:", error.message);
    return null;
  }

  const productMap = await loadProductMap(outfitProductIds([row as DbOutfit]));

  return dbToOutfit(row as DbOutfit, productMap);
}

export async function getOutfitById(id: string): Promise<Outfit | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    return staticOutfits.find((o) => o.id === id);
  }

  const { data, error } = await supabase
    .from("outfits")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Not found is a 404 — never a demo outfit wearing the id that was asked for.
  if (error) {
    console.error("[db] getOutfitById:", error.message);
    return undefined;
  }
  if (!data) return undefined;

  const row = data as DbOutfit;
  const productMap = await loadProductMap(outfitProductIds([row]));

  return dbToOutfit(row, productMap);
}

/**
 * Just the outfits asked for, in the order asked for; ids that match no outfit
 * are left out. The outfit twin of getProductsByIds, for id lookups such as
 * "Recently viewed" that would otherwise read every outfit to pick a handful.
 */
export async function getOutfitsByIds(ids: string[]): Promise<Outfit[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  let outfits: Outfit[];
  if (!isSupabaseConfigured || !supabase) {
    outfits = staticOutfits.filter((o) => unique.includes(o.id));
  } else {
    outfits = [];
    for (let i = 0; i < unique.length; i += ID_BATCH) {
      const { data, error } = await supabase
        .from("outfits")
        .select("*")
        .in("id", unique.slice(i, i + ID_BATCH));
      if (error) {
        console.error("[db] getOutfitsByIds:", error.message);
        break;
      }
      const rows = (data ?? []) as DbOutfit[];
      const productMap = await loadProductMap(outfitProductIds(rows));
      outfits.push(...rows.map((r) => dbToOutfit(r, productMap)));
    }
  }

  const byId = new Map(outfits.map((o) => [o.id, o]));
  return ids.map((id) => byId.get(id)).filter((o): o is Outfit => Boolean(o));
}

/**
 * A user-created builder look, resolved against the product catalog so it can
 * be rendered on a public share page the same way published outfits are. Reads
 * straight from `user_looks` by id (service-role), so anyone with the link can
 * view it without being the owner.
 */
export interface SharedLookPiece {
  slot: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  brand: string | null;
  priceMin: number | null;
  retailerCount: number;
  /** False when the referenced product is no longer in the catalog. */
  productExists: boolean;
}

export interface SharedLook {
  id: string;
  name: string | null;
  description: string | null;
  generatedImage: string | null;
  generatedStyle: string | null;
  totalPrice: number | null;
  styleKeywords: string[];
  savedAt: string | null;
  pieces: SharedLookPiece[];
}

type RawLookPiece = {
  slot?: unknown;
  productId?: unknown;
  imageUrl?: unknown;
  name?: unknown;
};

/**
 * Resolve raw look-piece refs against the catalog (brand, price, stores).
 * `trustImage`, when given, decides whether a piece's own image URL may be
 * shown; one it rejects is replaced by the catalogue photo.
 */
async function enrichSharedLookPieces(
  raw: unknown,
  trustImage?: (url: string, product: Product | undefined) => boolean,
): Promise<SharedLookPiece[]> {
  const rawPieces = (Array.isArray(raw) ? raw : []).filter(
    (p): p is RawLookPiece => !!p && typeof p === "object"
  );

  const productIds = rawPieces
    .map((p) => (typeof p.productId === "string" ? p.productId : null))
    .filter((id): id is string => !!id);

  const productMap = await loadProductMap(productIds);

  return rawPieces.map((p) => {
    const productId = typeof p.productId === "string" ? p.productId : "";
    const product = productMap.get(productId);
    const slot = typeof p.slot === "string" ? p.slot : "";
    const ownImage =
      typeof p.imageUrl === "string" && p.imageUrl && (!trustImage || trustImage(p.imageUrl, product))
        ? p.imageUrl
        : null;
    return {
      slot,
      productId,
      name: (typeof p.name === "string" && p.name ? p.name : product?.name) ?? slot,
      imageUrl: (ownImage || product?.imageUrl) ?? null,
      brand: product?.brand ?? null,
      priceMin: product?.priceMin ?? null,
      retailerCount: product?.retailers?.length ?? 0,
      productExists: !!product,
    };
  });
}

export async function getUserLookById(id: string): Promise<SharedLook | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from("user_looks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const pieces = await enrichSharedLookPieces(data.pieces);

  const generatedStyle =
    typeof data.generated_style === "string" ? data.generated_style : null;

  return {
    id: data.id,
    name: data.look_name ?? null,
    description: data.look_description ?? null,
    generatedImage: data.generated_image ?? null,
    generatedStyle,
    totalPrice: data.total_price ?? null,
    styleKeywords: Array.isArray(data.style_keywords) ? data.style_keywords : [],
    savedAt: data.saved_at ?? null,
    pieces,
  };
}

/**
 * Whether a URL points into our own Supabase Storage, where generate-outfit
 * persists look photos. Hosts shared with other tenants — any *.supabase.co
 * project, replicate.delivery — don't count: anyone can put a picture there.
 */
export function isOwnStorageUrl(url: string): boolean {
  const base = process.env.SUPABASE_URL;
  if (!base) return false;
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && u.host === new URL(base).host;
  } catch {
    return false;
  }
}

/** Every photo the catalogue holds for a product, across its colours. */
function productPhotos(product: Product): string[] {
  return [
    product.imageUrl,
    ...(product.images ?? []),
    ...Object.values(product.colorImages ?? {}).flat(),
  ].filter(Boolean);
}

/**
 * Fallback for share links that carry the look in the URL itself (?d=...).
 * Used when the look never reached the database (e.g. the write failed at
 * share time) — the link must still open the standard look page for any
 * recipient.
 *
 * The payload is untrusted and unsigned: anyone can mint a link that renders
 * on our domain. So every field is validated, the page is noindex (see
 * app/look/[id]), and no picture comes from the link itself — the generated
 * photo only from our own storage, piece photos only when they are that
 * product's catalogue photos. A payload naming no real product is refused.
 */
export async function sharedLookFromShareData(
  id: string,
  encoded: string
): Promise<SharedLook | null> {
  let data: Record<string, unknown>;
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;
  const httpUrl = (v: unknown) => {
    const s = str(v, 2000);
    return s && /^https?:\/\//.test(s) ? s : null;
  };

  const rawPieces = (Array.isArray(data.pieces) ? data.pieces : [])
    .slice(0, 12)
    .map((p: RawLookPiece) => ({
      slot: str(p?.slot, 40) ?? "",
      productId: str(p?.productId, 100) ?? "",
      name: str(p?.name, 300) ?? undefined,
      imageUrl: httpUrl(p?.imageUrl) ?? undefined,
    }))
    .filter((p) => p.productId);

  const pieces = await enrichSharedLookPieces(
    rawPieces,
    (url, product) => isOwnStorageUrl(url) || (!!product && productPhotos(product).includes(url)),
  );
  if (!pieces.some((p) => p.productExists)) return null;

  const generatedImage = httpUrl(data.generatedImage);

  return {
    id,
    name: str(data.name, 200),
    description: str(data.description, 2000),
    generatedImage: generatedImage && isOwnStorageUrl(generatedImage) ? generatedImage : null,
    generatedStyle: str(data.generatedStyle, 40),
    totalPrice:
      typeof data.totalPrice === "number" && Number.isFinite(data.totalPrice)
        ? data.totalPrice
        : null,
    styleKeywords: Array.isArray(data.styleKeywords)
      ? (data.styleKeywords as unknown[])
          .filter((k): k is string => typeof k === "string" && k.length > 0 && k.length <= 60)
          .slice(0, 20)
      : [],
    savedAt: null,
    pieces,
  };
}

/**
 * Outfits that include any of the given products, newest first — at most
 * `limit` of them when one is given. Asks the database for exactly those
 * outfits rather than loading every outfit and every product to filter here.
 */
export async function getOutfitsByProductId(
  productIds: string | string[],
  limit?: number,
): Promise<Outfit[]> {
  const ids = [...new Set(Array.isArray(productIds) ? productIds : [productIds])].filter(Boolean);
  if (ids.length === 0) return [];

  if (!isSupabaseConfigured || !supabase) {
    const matches = staticOutfits.filter((outfit) =>
      outfit.items.some((item) => ids.includes(item.product.id)),
    );
    return limit ? matches.slice(0, limit) : matches;
  }

  // `items` is a jsonb array of { product_id, role, … }; `@>` matches outfits
  // whose array holds an element naming the product. One query per id — the
  // page passes a product's colour variants, usually a handful.
  const results = await Promise.all(
    ids.map((id) => {
      let query = supabase!
        .from("outfits")
        .select("*")
        .contains("items", JSON.stringify([{ product_id: id }]))
        .order("created_at", { ascending: false });
      if (limit) query = query.limit(limit);
      return query;
    }),
  );

  const byId = new Map<string, DbOutfit>();
  for (const { data, error } of results) {
    if (error) {
      console.error("[db] getOutfitsByProductId:", error.message);
      continue;
    }
    for (const row of (data ?? []) as DbOutfit[]) byId.set(row.id, row);
  }

  let rows = [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (limit) rows = rows.slice(0, limit);
  if (rows.length === 0) return [];

  const productMap = await loadProductMap(outfitProductIds(rows));
  return rows.map((r) => dbToOutfit(r, productMap));
}

export async function toggleOutfitHomepageFeatured(
  id: string,
  featured: boolean
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  const { error } = await supabase
    .from("outfits")
    .update({ is_homepage_featured: featured })
    .eq("id", id);
  if (error) {
    console.error("[db] toggleOutfitHomepageFeatured:", error.message);
    return false;
  }
  return true;
}

// ─── Blog posts ─────────────────────────────────────────────────────────────

export function dbToBlogPost(row: DbBlogPost): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    body: row.body ?? "",
    // A post saved with an empty category would render an empty pill linking
    // to /blog?category= — it belongs in the default bucket instead.
    category: row.category?.trim() || "General",
    coverImageUrl: row.cover_image_url ?? "",
    readTime: row.read_time ?? "5 min",
    authorName: row.author_name ?? "GOO",
    metaTitle: row.meta_title ?? undefined,
    metaDescription: row.meta_description ?? undefined,
    ogImage: row.og_image ?? undefined,
    isPublished: row.is_published ?? true,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function blogPostToDb(p: Partial<BlogPost>) {
  const row: Record<string, unknown> = {
    slug: p.slug ?? "",
    title: p.title ?? "",
    excerpt: p.excerpt ?? "",
    body: p.body ?? "",
    // The category field sits under "Advanced options", so a post written
    // without opening them arrives with "" rather than no category at all.
    category: p.category?.trim() || "General",
    cover_image_url: p.coverImageUrl ?? "",
    read_time: p.readTime ?? "5 min",
    author_name: p.authorName ?? "GOO",
    meta_title: p.metaTitle ?? null,
    meta_description: p.metaDescription ?? null,
    og_image: p.ogImage ?? null,
    is_published: p.isPublished ?? true,
  };
  if (p.publishedAt) row.published_at = p.publishedAt;
  return row;
}

export async function getAllBlogPosts(opts: { publishedOnly?: boolean } = {}): Promise<BlogPost[]> {
  const { posts, error } = await readAllBlogPosts(opts);
  if (error) console.error("[db] getAllBlogPosts:", error);
  return posts;
}

/**
 * getAllBlogPosts that reports a failed read. The admin list (GET /api/blog) must
 * show the failure: an empty list there invites writing posts that already
 * exist, and the demo posts it used to get instead could not be edited or
 * deleted at all.
 */
export async function readAllBlogPosts(
  opts: { publishedOnly?: boolean } = {},
): Promise<{ posts: BlogPost[]; error: string | null }> {
  const { publishedOnly = false } = opts;
  if (!isSupabaseConfigured || !supabase) {
    return {
      posts: publishedOnly ? staticBlogPosts.filter((p) => p.isPublished) : staticBlogPosts,
      error: null,
    };
  }

  let query = supabase.from("blog_posts").select("*").order("published_at", { ascending: false });
  if (publishedOnly) query = query.eq("is_published", true);

  const { data, error } = await query;
  if (error) return { posts: [], error: error.message };

  return { posts: ((data ?? []) as DbBlogPost[]).map(dbToBlogPost), error: null };
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    return staticBlogPosts.find((p) => p.slug === slug);
  }
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[db] getBlogPostBySlug:", error.message);
    return undefined;
  }
  if (!data) return undefined;
  return dbToBlogPost(data as DbBlogPost);
}

export async function createBlogPost(
  data: ReturnType<typeof blogPostToDb>
): Promise<{ post: BlogPost | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { post: null, error: "Database not configured." };
  }
  const { data: row, error } = await supabase
    .from("blog_posts")
    .insert(data)
    .select()
    .single();
  if (error) {
    console.error("[db] createBlogPost:", error.message);
    return { post: null, error: error.message };
  }
  return { post: dbToBlogPost(row as DbBlogPost), error: null };
}

/**
 * Whether a save carries a publish date different from the stored one. The
 * editor's date field holds minutes, so seconds are not a difference.
 */
function publishDateSetByHand(incoming: unknown, stored: string | null): boolean {
  if (typeof incoming !== "string" || !incoming) return false;
  const a = Date.parse(incoming);
  const b = stored ? Date.parse(stored) : NaN;
  if (Number.isNaN(a)) return false;
  if (Number.isNaN(b)) return true;
  return Math.floor(a / 60_000) !== Math.floor(b / 60_000);
}

export async function updateBlogPost(
  id: string,
  data: ReturnType<typeof blogPostToDb>
): Promise<{ post: BlogPost | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { post: null, error: "Database not configured." };
  }

  // A draft going live is published now, not on the day it was first drafted
  // — otherwise a week-old draft comes out backdated, below newer posts. Only
  // when the admin left the date alone: the editor sends the stored date back
  // on every save, so an unchanged value means "not set by hand".
  let payload = data;
  if (data.is_published === true) {
    const { data: current, error: currentError } = await supabase
      .from("blog_posts")
      .select("is_published, published_at")
      .eq("id", id)
      .maybeSingle();
    if (currentError) {
      console.error("[db] updateBlogPost (current state):", currentError.message);
    } else if (
      current &&
      current.is_published === false &&
      !publishDateSetByHand(data.published_at, current.published_at)
    ) {
      payload = { ...data, published_at: new Date().toISOString() };
    }
  }

  const { data: row, error } = await supabase
    .from("blog_posts")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[db] updateBlogPost:", error.message);
    return { post: null, error: error.message };
  }
  return { post: dbToBlogPost(row as DbBlogPost), error: null };
}

export async function deleteBlogPost(id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  const { error } = await supabase.from("blog_posts").delete().eq("id", id);
  if (error) {
    console.error("[db] deleteBlogPost:", error.message);
    return false;
  }
  return true;
}

// ── HOMEPAGE SHOWCASE ("How it works" section) ───────────────────────────────
// Admins pick which existing products appear in each of the four steps. Stored
// as a single settings row (key = "homepage_showcase") holding product-id lists.

const SHOWCASE_KEY = "homepage_showcase";
const SHOWCASE_STEPS = ["step1", "step2", "step3", "step4"] as const;
export type ShowcaseStep = (typeof SHOWCASE_STEPS)[number];
export type HomepageShowcaseIds = Record<ShowcaseStep, string[]>;

export interface ShowcaseItem {
  id: string;
  name: string;
  imageUrl: string;
}
export type HomepageShowcase = Record<ShowcaseStep, ShowcaseItem[]>;

function emptyShowcaseIds(): HomepageShowcaseIds {
  return { step1: [], step2: [], step3: [], step4: [] };
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Raw product-id lists per step (used by the public homepage). */
export async function getHomepageShowcaseIds(): Promise<HomepageShowcaseIds> {
  const { ids, error } = await readHomepageShowcaseIds();
  if (error) console.error("[db] getHomepageShowcaseIds:", error);
  return ids;
}

/**
 * The stored selection with a failed read reported, for the admin editor: a
 * read that failed must not look like "nothing selected", or the next Save
 * writes that empty selection over the real one.
 */
export async function readHomepageShowcaseIds(): Promise<{ ids: HomepageShowcaseIds; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { ids: emptyShowcaseIds(), error: null };
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", SHOWCASE_KEY)
    .maybeSingle();
  if (error) return { ids: emptyShowcaseIds(), error: error.message };
  const raw = (data as { value: string } | null)?.value;
  if (!raw) return { ids: emptyShowcaseIds(), error: null };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out = emptyShowcaseIds();
    for (const step of SHOWCASE_STEPS) out[step] = asStringArray(parsed[step]);
    return { ids: out, error: null };
  } catch {
    // Unreadable is not a transient failure — there is nothing to protect
    // from being overwritten, so the editor may start from empty.
    console.error("[db] readHomepageShowcaseIds: stored value is not valid JSON");
    return { ids: emptyShowcaseIds(), error: null };
  }
}

/**
 * Resolved items per step (used by the public homepage). Steps 1/2/4 reference
 * individual products; step 3 ("Generate preview") references a generated
 * outfit/look and uses its preview image.
 */
export async function getHomepageShowcase(): Promise<HomepageShowcase> {
  const ids = await getHomepageShowcaseIds();
  const productWanted = new Set([...ids.step1, ...ids.step2, ...ids.step4]);
  const outfitWanted = new Set(ids.step3);
  if (productWanted.size === 0 && outfitWanted.size === 0) {
    return { step1: [], step2: [], step3: [], step4: [] };
  }

  const productById = new Map<string, ShowcaseItem>();
  if (productWanted.size > 0) {
    for (const p of await getProductsByIds([...productWanted])) {
      productById.set(p.id, { id: p.id, name: p.name, imageUrl: p.imageUrl });
    }
  }

  const outfitById = new Map<string, ShowcaseItem>();
  if (outfitWanted.size > 0) {
    const all = await getAllOutfits();
    for (const o of all) {
      if (outfitWanted.has(o.id)) outfitById.set(o.id, { id: o.id, name: o.name, imageUrl: o.imageUrl });
    }
  }

  const fromProducts = (arr: string[]) =>
    arr.map((id) => productById.get(id)).filter((x): x is ShowcaseItem => Boolean(x));
  const fromOutfits = (arr: string[]) =>
    arr.map((id) => outfitById.get(id)).filter((x): x is ShowcaseItem => Boolean(x));

  return {
    step1: fromProducts(ids.step1),
    step2: fromProducts(ids.step2),
    step3: fromOutfits(ids.step3),
    step4: fromProducts(ids.step4),
  };
}

// ── HOMEPAGE AI STYLIST SHOWCASE ─────────────────────────────────────────────
// Drives the "Your style. Found by AI." section on the homepage. Admins pick:
//   • up to 2 outfits ("looks") rendered as cards inside the chat preview, and
//   • one featured product shown bottom-left with its "Where to buy" retailers.
// Stored as a single settings row (key = "homepage_stylist").

const STYLIST_KEY = "homepage_stylist";
const MAX_CHAT_LOOKS = 2;
const MAX_SHOWCASE_STORES = 6;

/** A trending "look" card shown inside the chat preview. */
export interface StylistChatLook {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  currency: string;
}

/** An admin-added extra store shown in the homepage "Where to buy" list. */
export interface ShowcaseStore {
  name: string;
  logoUrl: string | null;
  /** Admin-set price tag for this store, or null when not set. */
  price: number | null;
  /** Store homepage URL — clicking the row opens this store. */
  url: string | null;
}

/** One extra store as stored in settings (name + admin-set price). */
export interface ExtraStore {
  name: string;
  price: number | null;
}

/** Raw ids stored in settings (used by the admin editor). */
export interface HomepageStylistIds {
  chatOutfits: string[];
  featuredProduct: string | null;
  /**
   * Extra stores the admin added to the "Where to buy" list, on top of the
   * featured item's own retailers (which always show automatically). Each has
   * an admin-set price; the logo is pulled from the store library by name.
   */
  extraStores: ExtraStore[];
}

/** Resolved data consumed by the public homepage. */
export interface HomepageStylist {
  chatLooks: StylistChatLook[];
  featuredProduct: Product | null;
  /** Lower-cased store name → logo URL, used to badge "Where to buy" rows. */
  retailerLogos: Record<string, string>;
  /**
   * Admin-added extra stores shown after the featured item's own retailers in
   * the "Where to buy" list (logo pulled from the library, admin-set price).
   */
  showcaseStores: ShowcaseStore[];
}

/**
 * Brand name → logo URL map (lower-cased keys). Resilient to the brands table
 * or the logo_url column not existing yet, in which case it returns {}.
 */
export async function getBrandLogos(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured || !supabase) return {};
  const { data, error } = await supabase.from("brands").select("name, logo_url");
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of data as { name: string; logo_url: string | null }[]) {
    if (row.name && row.logo_url) map[row.name.toLowerCase()] = row.logo_url;
  }
  return map;
}

function emptyStylistIds(): HomepageStylistIds {
  return { chatOutfits: [], featuredProduct: null, extraStores: [] };
}

/** Coerce a stored value into an ExtraStore list, accepting legacy string[] names. */
function asExtraStores(value: unknown): ExtraStore[] {
  if (!Array.isArray(value)) return [];
  const out: ExtraStore[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      out.push({ name: item.trim(), price: null });
    } else if (item && typeof item === "object") {
      const name = (item as Record<string, unknown>).name;
      const price = (item as Record<string, unknown>).price;
      if (typeof name === "string" && name.trim()) {
        out.push({
          name: name.trim(),
          price: typeof price === "number" && price > 0 ? price : null,
        });
      }
    }
  }
  return out;
}

/** Raw selection (used by the public homepage). */
export async function getHomepageStylistIds(): Promise<HomepageStylistIds> {
  const { ids, error } = await readHomepageStylistIds();
  if (error) console.error("[db] getHomepageStylistIds:", error);
  return ids;
}

/**
 * The stored selection with a failed read reported, for the admin editor —
 * see readHomepageShowcaseIds for why that matters.
 */
export async function readHomepageStylistIds(): Promise<{ ids: HomepageStylistIds; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) return { ids: emptyStylistIds(), error: null };
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", STYLIST_KEY)
    .maybeSingle();
  if (error) return { ids: emptyStylistIds(), error: error.message };
  const raw = (data as { value: string } | null)?.value;
  if (!raw) return { ids: emptyStylistIds(), error: null };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    // `extraStores` is the current field; legacy `stores`/`brands` were string
    // arrays of names (no price) and are still read for back-compat.
    const extraStores = asExtraStores(
      parsed.extraStores ?? parsed.stores ?? parsed.brands
    ).slice(0, MAX_SHOWCASE_STORES);
    return {
      ids: {
        chatOutfits: asStringArray(parsed.chatOutfits).slice(0, MAX_CHAT_LOOKS),
        featuredProduct:
          typeof parsed.featuredProduct === "string" ? parsed.featuredProduct : null,
        extraStores,
      },
      error: null,
    };
  } catch {
    console.error("[db] readHomepageStylistIds: stored value is not valid JSON");
    return { ids: emptyStylistIds(), error: null };
  }
}

/**
 * Resolved stylist showcase for the homepage. Falls back to the first available
 * outfits / a product with retailers so the section never renders empty.
 */
export async function getHomepageStylist(): Promise<HomepageStylist> {
  const ids = await getHomepageStylistIds();

  // Chat looks: resolve configured outfits in order, then top up from the
  // catalogue so there are always two cards in the preview.
  const allOutfits = await getAllOutfits();
  const chosen: Outfit[] = ids.chatOutfits
    .map((id) => allOutfits.find((o) => o.id === id))
    .filter((o): o is Outfit => Boolean(o));
  for (const o of allOutfits) {
    if (chosen.length >= MAX_CHAT_LOOKS) break;
    if (!chosen.some((c) => c.id === o.id)) chosen.push(o);
  }
  const chatLooks: StylistChatLook[] = chosen.slice(0, MAX_CHAT_LOOKS).map((o) => ({
    id: o.id,
    name: o.name,
    imageUrl: o.imageUrl,
    price: o.totalPriceMin,
    currency: o.currency,
  }));

  // Featured product: the configured one (with retailers attached), else the
  // first product that actually has a "where to buy" list.
  let featuredProduct: Product | null = null;
  if (ids.featuredProduct) {
    featuredProduct = (await getProductById(ids.featuredProduct)) ?? null;
  }
  if (!featuredProduct) {
    const all = await getAllProducts(true);
    featuredProduct = all.find((p) => p.retailers?.length > 0) ?? all[0] ?? null;
  }

  const retailerLogos = await getBrandLogos();

  // Extra stores the admin added on top of the item's own retailers. Only the
  // supported (integrated) stores are kept; each resolves its logo from the
  // store favicon and its link from the store homepage.
  const showcaseStores: ShowcaseStore[] = ids.extraStores
    .map((e) => ({ e, store: findSupportedStore(e.name) }))
    .filter((x): x is { e: ExtraStore; store: SupportedStore } => Boolean(x.store))
    .map(({ e, store }) => ({
      name: store.name,
      logoUrl: storeFaviconUrl(store.domain),
      price: e.price,
      url: storeHomepageUrl(store.domain),
    }));

  return { chatLooks, featuredProduct, retailerLogos, showcaseStores };
}
