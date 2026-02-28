/**
 * Server-side data access layer.
 * Uses Supabase when configured, falls back to static data.
 */
import type { Product } from "@/lib/types";
import { supabase, isSupabaseConfigured, type DbProduct } from "@/lib/supabase";
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
  };
}

export function productToDb(p: Partial<Product>) {
  return {
    name: p.name ?? "",
    brand: p.brand ?? "",
    category: p.category ?? "",
    description: p.description ?? "",
    image_url: p.imageUrl ?? "",
    images: p.images ?? [],
    colors: p.colors ?? [],
    color_images: p.colorImages ?? null,
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
}

export async function getAllProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase) return staticProducts;
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[db] getAllProducts:", error.message);
    return staticProducts;
  }
  return (data as DbProduct[]).map(dbToProduct);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    return staticProducts.find((p) => p.id === id);
  }
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return undefined;
  return dbToProduct(data as DbProduct);
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase) {
    return staticProducts.filter((p) => p.category === category);
  }
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("category", category)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as DbProduct[]).map(dbToProduct);
}
