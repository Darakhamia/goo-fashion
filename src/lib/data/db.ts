/**
 * Server-side data access layer.
 * Uses Supabase when configured, falls back to static data.
 */
import type { ColorGroup, Product, ProductSwatch } from "@/lib/types";
import { supabase, isSupabaseConfigured, type DbProduct, type DbColorGroup, dbToColorGroup } from "@/lib/supabase";
import { products as staticProducts } from "./products";

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
