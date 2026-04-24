import { createClient } from "@supabase/supabase-js";
import type { ColorGroup } from "@/lib/types";

export type DbColorGroup = {
  id: number;
  name: string;
  hex_code: string;
  sort_order: number;
};

export function dbToColorGroup(row: DbColorGroup): ColorGroup {
  return {
    id: row.id,
    name: row.name,
    hexCode: row.hex_code,
    sortOrder: row.sort_order,
  };
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = url && key ? createClient(url, key) : null;
export const isSupabaseConfigured = !!(url && key);

export type DbOutfitItem = {
  product_id: string;
  role: "hero" | "secondary" | "accent";
  light?: number;
};

export type DbOutfit = {
  id: string;
  name: string;
  description: string;
  occasion: string;
  image_url: string;
  items: DbOutfitItem[];
  total_price_min: number;
  total_price_max: number;
  currency: string;
  style_keywords: string[];
  is_ai_generated: boolean;
  is_saved: boolean;
  season: string;
  created_at: string;
  source?: string | null;
};

export type DbBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: string;
  cover_image_url: string;
  read_time: string;
  author_name: string;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  is_published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export type DbProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  image_url: string;
  images: string[];
  colors: string[];
  color_images: Record<string, string[]> | null;
  sizes: string[];
  material: string;
  retailers: object[];
  price_min: number;
  price_max: number;
  currency: string;
  is_new: boolean;
  is_saved: boolean;
  style_keywords: string[];
  gender?: string;
  created_at: string;
  // Color-variant linking
  variant_group_id?: string | null;
  color_hex?: string | null;
  is_group_primary?: boolean | null;
  // Manual crop data
  crop_data?: { x: number; y: number; width: number; height: number; focalX: number; focalY: number } | null;
  // Base color group IDs for color filter (references color_groups.id)
  color_group_ids?: number[] | null;
};
