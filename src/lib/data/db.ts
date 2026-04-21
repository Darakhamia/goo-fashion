/**
 * Server-side data access layer.
 * Uses Supabase when configured, falls back to static data.
 */
import type { BlogPost, ColorGroup, Outfit, OutfitItem, Product, ProductSwatch } from "@/lib/types";
import { supabase, isSupabaseConfigured, type DbBlogPost, type DbOutfit, type DbProduct, type DbColorGroup, dbToColorGroup } from "@/lib/supabase";
import { products as staticProducts } from "./products";
import { outfits as staticOutfits } from "./outfits";
import { blogPosts as staticBlogPosts } from "./blog";

export function dbToProduct(row: DbProduct): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand as Product["brand"],
    category: row.category as Product["category"],
    description: row.description ?? "",
    imageUrl: row.image_url ?? "",
    images: row.images ?? [],
    colors: row.colors ?? [],
    colorImages: row.color_images ?? undefined,
    sizes: row.sizes ?? [],
    material: row.material ?? "",
    retailers: (row.retailers as Product["retailers"]) ?? [],
    priceMin: row.price_min,
    priceMax: row.price_max,
    currency: row.currency ?? "USD",
    isNew: row.is_new ?? false,
    isSaved: row.is_saved ?? false,
    styleKeywords: (row.style_keywords ?? []) as Product["styleKeywords"],
    gender: (row.gender ?? undefined) as Product["gender"],
    variantGroupId: row.variant_group_id ?? undefined,
    colorHex: row.color_hex ?? undefined,
    isGroupPrimary: row.is_group_primary ?? undefined,
    cropData: row.crop_data ?? undefined,
    colorGroupIds: row.color_group_ids?.length ? row.color_group_ids : undefined,
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
  if (p.variantGroupId !== undefined) extras.variant_group_id = p.variantGroupId ?? null;
  if (p.colorHex !== undefined)       extras.color_hex = p.colorHex ?? null;
  if (p.isGroupPrimary !== undefined) extras.is_group_primary = p.isGroupPrimary ?? false;
  if (p.cropData !== undefined)       extras.crop_data = p.cropData ?? null;
  if (p.colorGroupIds !== undefined)  extras.color_group_ids = p.colorGroupIds ?? [];
  return { ...base, ...extras };
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
    id:         p.id,
    name:       p.name,
    colorName:  p.colors?.[0] || p.name,
    colorHex:   p.colorHex ?? "#888888",
    priceMin:   p.priceMin,
    priceMax:   p.priceMax,
    imageUrl:   p.imageUrl,
    images:     p.images ?? [],
    sizes:      p.sizes ?? [],
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
  if (!isSupabaseConfigured || !supabase) return staticProducts;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[db] getAllProducts:", error.message);
    return [];
  }

  const all = (data as DbProduct[]).map(dbToProduct);
  return skipGrouping ? all : groupVariants(all);
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
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  const product = dbToProduct(data as DbProduct);

  // If part of a variant group, fetch all siblings and attach as swatches
  if (product.variantGroupId) {
    const { data: siblings } = await supabase
      .from("products")
      .select("*")
      .eq("variant_group_id", product.variantGroupId);
    if (siblings && siblings.length > 0) {
      product.variants = (siblings as DbProduct[]).map(dbToProduct).map(toSwatch);
    }
  }

  return product;
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("category", category)
    .order("created_at", { ascending: false });
  if (error) return [];
  return groupVariants((data as DbProduct[]).map(dbToProduct));
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
      items.push({ product, role: item.role });
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
  };
}

export interface OutfitApiBody {
  name?: string;
  description?: string;
  occasion?: string;
  imageUrl?: string;
  items?: { productId: string; role: string }[];
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
    items: (o.items ?? []).map((i) => ({ product_id: i.productId, role: i.role })),
    total_price_min: o.totalPriceMin ?? 0,
    total_price_max: o.totalPriceMax ?? o.totalPriceMin ?? 0,
    currency: o.currency ?? "USD",
    style_keywords: o.styleKeywords ?? [],
    is_ai_generated: o.isAIGenerated ?? false,
    is_saved: o.isSaved ?? false,
    season: o.season ?? "all",
  };
}

export async function getAllOutfits(): Promise<Outfit[]> {
  if (!isSupabaseConfigured || !supabase) return staticOutfits;

  const { data, error } = await supabase
    .from("outfits")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[db] getAllOutfits:", error.message);
    return staticOutfits;
  }

  const rows = data as DbOutfit[];
  if (rows.length === 0) return staticOutfits;

  // Collect all product IDs referenced across all outfits
  const productIds = [...new Set(rows.flatMap((r) => (r.items ?? []).map((i) => i.product_id)))];

  const productMap = new Map<string, Product>();
  if (productIds.length > 0) {
    const { data: prodData } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);
    if (prodData) {
      for (const p of (prodData as DbProduct[]).map(dbToProduct)) {
        productMap.set(p.id, p);
      }
    }
  }

  return rows.map((r) => dbToOutfit(r, productMap));
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
  const productIds = (row.items ?? []).map((i: { product_id: string }) => i.product_id);
  const productMap = new Map<string, Product>();
  if (productIds.length > 0) {
    const { data: prodData } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);
    if (prodData) {
      for (const p of (prodData as DbProduct[]).map(dbToProduct)) {
        productMap.set(p.id, p);
      }
    }
  }

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

  const productIds = (row.items ?? []).map((i: { product_id: string }) => i.product_id);
  const productMap = new Map<string, Product>();
  if (productIds.length > 0) {
    const { data: prodData } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);
    if (prodData) {
      for (const p of (prodData as DbProduct[]).map(dbToProduct)) {
        productMap.set(p.id, p);
      }
    }
  }

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
    .single();

  if (error || !data) {
    // Fall back to static data
    return staticOutfits.find((o) => o.id === id);
  }

  const row = data as DbOutfit;
  const productIds = (row.items ?? []).map((i) => i.product_id);
  const productMap = new Map<string, Product>();
  if (productIds.length > 0) {
    const { data: prodData } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);
    if (prodData) {
      for (const p of (prodData as DbProduct[]).map(dbToProduct)) {
        productMap.set(p.id, p);
      }
    }
  }

  return dbToOutfit(row, productMap);
}

export async function deleteOutfit(id: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  const { error } = await supabase.from("outfits").delete().eq("id", id);
  if (error) {
    console.error("[db] deleteOutfit:", error.message);
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
    category: row.category ?? "General",
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
    category: p.category ?? "General",
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
  const { publishedOnly = false } = opts;
  if (!isSupabaseConfigured || !supabase) {
    return publishedOnly ? staticBlogPosts.filter((p) => p.isPublished) : staticBlogPosts;
  }

  let query = supabase.from("blog_posts").select("*").order("published_at", { ascending: false });
  if (publishedOnly) query = query.eq("is_published", true);

  const { data, error } = await query;
  if (error) {
    console.error("[db] getAllBlogPosts:", error.message);
    return publishedOnly ? staticBlogPosts.filter((p) => p.isPublished) : staticBlogPosts;
  }

  const rows = (data ?? []) as DbBlogPost[];
  if (rows.length === 0) {
    return publishedOnly ? staticBlogPosts.filter((p) => p.isPublished) : staticBlogPosts;
  }
  return rows.map(dbToBlogPost);
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
  if (error || !data) {
    return staticBlogPosts.find((p) => p.slug === slug);
  }
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

export async function updateBlogPost(
  id: string,
  data: ReturnType<typeof blogPostToDb>
): Promise<{ post: BlogPost | null; error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    return { post: null, error: "Database not configured." };
  }
  const { data: row, error } = await supabase
    .from("blog_posts")
    .update(data)
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
