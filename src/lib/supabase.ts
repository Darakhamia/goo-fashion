import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = url && key ? createClient(url, key) : null;
export const isSupabaseConfigured = !!(url && key);

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
};
