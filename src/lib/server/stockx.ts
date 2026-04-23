import type { Product } from "@/lib/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const STOCKX_API_BASE = "https://api.stockx.com/v1";

export const STOCKX_APP_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.goo-fashion.com";

export const STOCKX_REDIRECT_URI = `${STOCKX_APP_URL}/api/stockx/callback`;

async function readSettings(keys: string[]): Promise<Record<string, string>> {
  if (!isSupabaseConfigured || !supabase) return {};
  const { data } = await supabase
    .from("settings")
    .select("key, value")
    .in("key", keys);
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as { key: string; value: string }[]) {
    map[row.key] = row.value;
  }
  return map;
}

async function writeSettings(entries: Record<string, string>) {
  if (!isSupabaseConfigured || !supabase) return;
  const rows = Object.entries(entries).map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString(),
  }));
  await supabase.from("settings").upsert(rows, { onConflict: "key" });
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://accounts.stockx.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.STOCKX_CLIENT_ID ?? "",
      client_secret: process.env.STOCKX_CLIENT_SECRET ?? "",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`StockX token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const expiresAt = Date.now() + (data.expires_in ?? 86400) * 1000;

  await writeSettings({
    stockx_access_token: data.access_token,
    stockx_token_expires_at: String(expiresAt),
    ...(data.refresh_token ? { stockx_refresh_token: data.refresh_token } : {}),
  });

  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const settings = await readSettings([
    "stockx_access_token",
    "stockx_refresh_token",
    "stockx_token_expires_at",
  ]);

  const accessToken = settings["stockx_access_token"];
  const refreshToken = settings["stockx_refresh_token"];
  const expiresAt = parseInt(settings["stockx_token_expires_at"] ?? "0", 10);

  if (accessToken && Date.now() < expiresAt - 60_000) {
    return accessToken;
  }

  if (refreshToken) {
    return refreshAccessToken(refreshToken);
  }

  throw new Error(
    "StockX not connected. Go to /admin/stockx and click Connect."
  );
}

export async function storeStockXTokens(tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}) {
  const expiresAt = Date.now() + (tokens.expires_in ?? 86400) * 1000;
  await writeSettings({
    stockx_access_token: tokens.access_token,
    stockx_token_expires_at: String(expiresAt),
    ...(tokens.refresh_token
      ? { stockx_refresh_token: tokens.refresh_token }
      : {}),
  });
}

export async function clearStockXTokens() {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase
    .from("settings")
    .delete()
    .in("key", [
      "stockx_access_token",
      "stockx_refresh_token",
      "stockx_token_expires_at",
    ]);
}

export async function getStockXConnectionStatus(): Promise<{
  connected: boolean;
  expiresAt?: number;
}> {
  const settings = await readSettings([
    "stockx_access_token",
    "stockx_token_expires_at",
  ]);
  const token = settings["stockx_access_token"];
  const expiresAt = parseInt(settings["stockx_token_expires_at"] ?? "0", 10);
  return { connected: !!token, expiresAt: expiresAt || undefined };
}

async function stockxFetch(path: string): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${STOCKX_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-key": process.env.STOCKX_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

export interface StockXProductAttributes {
  gender?: string;
  season?: string;
  releaseDate?: string;
  retailPrice?: number;
  colorway?: string;
  color?: string;
  description?: string;
}

export interface StockXProduct {
  productId: string;
  urlKey: string;
  styleId: string | null;
  productType: string;
  title: string;
  brand: string | null;
  productAttributes: StockXProductAttributes;
  sizeChart?: object;
}

export interface StockXVariant {
  productId: string;
  variantId: string;
  variantName: string;
  variantValue: string | null;
}

export interface StockXSearchResponse {
  products: StockXProduct[];
  pagination?: { total: number; pageNumber: number; pageSize: number };
}

export async function searchStockX(
  query: string,
  page = 1
): Promise<StockXSearchResponse> {
  const params = new URLSearchParams({
    query,
    pageNumber: String(page),
    pageSize: "24",
  });
  const res = await stockxFetch(`/catalog/search?${params}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`StockX search failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  const products: StockXProduct[] =
    data.products ?? data.items ?? (Array.isArray(data) ? data : []);
  return { products, pagination: data.pagination };
}

export async function getStockXVariants(
  productId: string
): Promise<StockXVariant[]> {
  const res = await stockxFetch(`/catalog/products/${productId}/variants`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.variants ?? [];
}

// ── Mappers ──────────────────────────────────────────────────────────────────

const PRODUCT_TYPE_TO_CATEGORY: Record<string, string> = {
  Sneakers: "footwear",
  Shoes: "footwear",
  Apparel: "tops",
  "Hoodies & Sweatshirts": "tops",
  "T-Shirts": "tops",
  "Jackets & Coats": "outerwear",
  "Pants & Shorts": "bottoms",
  Shorts: "shorts",
  Skirts: "skirts",
  Dresses: "dresses",
  Handbags: "bags",
  Accessories: "accessories",
  Hats: "accessories",
  Socks: "accessories",
  Collectibles: "accessories",
  Electronics: "accessories",
  "Trading Cards": "accessories",
};

const COLOR_TO_HEX: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  red: "#FF2D2D",
  blue: "#2D6EFF",
  green: "#2DBF5E",
  yellow: "#FFD600",
  orange: "#FF6B2D",
  purple: "#7B2D8B",
  pink: "#FF69B4",
  grey: "#9B9B9B",
  gray: "#9B9B9B",
  brown: "#8B5E3C",
  beige: "#F5F0E8",
  navy: "#1C2B6B",
  cream: "#FFFDD0",
  tan: "#D2B48C",
  gold: "#FFD700",
  silver: "#C0C0C0",
  multicolor: "#888888",
};

export function stockxCdnImage(productId: string): string {
  return `https://images.stockx.com/images/${productId}.jpg`;
}

export function mapStockXToProduct(p: StockXProduct, sizes: string[]) {
  const category = PRODUCT_TYPE_TO_CATEGORY[p.productType] ?? "accessories";
  const colorKey = (p.productAttributes.color ?? "").toLowerCase().trim();
  const colorHex = COLOR_TO_HEX[colorKey] ?? undefined;
  const price = p.productAttributes.retailPrice ?? 0;
  const rawGender = (p.productAttributes.gender ?? "unisex").toLowerCase();
  const gender = (
    ["women", "men", "unisex"].includes(rawGender) ? rawGender : "unisex"
  ) as "women" | "men" | "unisex";
  const imageUrl = stockxCdnImage(p.productId);
  const colors = p.productAttributes.colorway
    ? [p.productAttributes.colorway]
    : [];

  return {
    name: p.title,
    brand: (p.brand ?? "") as Product["brand"],
    category: category as Product["category"],
    description: "",
    imageUrl,
    images: [imageUrl],
    colors,
    colorHex,
    sizes,
    material: "",
    retailers: [
      {
        name: "StockX",
        url: `https://stockx.com/${p.urlKey}`,
        price,
        currency: "USD",
        availability: "in stock" as const,
        isOfficial: true,
      },
    ],
    priceMin: price,
    priceMax: price,
    currency: "USD",
    styleKeywords: [] as Product["styleKeywords"],
    gender,
    isNew: false,
    isSaved: false,
  };
}
