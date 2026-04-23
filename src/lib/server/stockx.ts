import type { Product } from "@/lib/types";

const STOCKX_API_BASE = "https://api.stockx.com/v1";
const STOCKX_TOKEN_URL = "https://accounts.stockx.com/oauth/token";

interface TokenCache {
  access_token: string;
  expires_at: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expires_at - 60_000) {
    return tokenCache.access_token;
  }

  const clientId = process.env.STOCKX_CLIENT_ID;
  const clientSecret = process.env.STOCKX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("STOCKX_CLIENT_ID or STOCKX_CLIENT_SECRET not configured");
  }

  const res = await fetch(STOCKX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: "gateway.stockx.com",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`StockX auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in ?? 43200) * 1000,
  };

  return tokenCache.access_token;
}

async function stockxFetch(path: string): Promise<Response> {
  const token = await getAccessToken();
  const apiKey = process.env.STOCKX_API_KEY ?? "";

  return fetch(`${STOCKX_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-api-key": apiKey,
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

export async function searchStockX(query: string, page = 1): Promise<StockXSearchResponse> {
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
  const products: StockXProduct[] = data.products ?? data.items ?? (Array.isArray(data) ? data : []);
  return { products, pagination: data.pagination };
}

export async function getStockXVariants(productId: string): Promise<StockXVariant[]> {
  const res = await stockxFetch(`/catalog/products/${productId}/variants`);
  if (!res.ok) return [];

  const data = await res.json();
  return Array.isArray(data) ? data : data.variants ?? [];
}

// ── Mappers ──────────────────────────────────────────────────────────────────

const PRODUCT_TYPE_TO_CATEGORY: Record<string, string> = {
  "Sneakers": "footwear",
  "Shoes": "footwear",
  "Apparel": "tops",
  "Hoodies & Sweatshirts": "tops",
  "T-Shirts": "tops",
  "Jackets & Coats": "outerwear",
  "Pants & Shorts": "bottoms",
  "Shorts": "shorts",
  "Skirts": "skirts",
  "Dresses": "dresses",
  "Handbags": "bags",
  "Accessories": "accessories",
  "Hats": "accessories",
  "Socks": "accessories",
  "Collectibles": "accessories",
  "Electronics": "accessories",
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
  const gender = (["women", "men", "unisex"].includes(rawGender) ? rawGender : "unisex") as "women" | "men" | "unisex";
  const imageUrl = stockxCdnImage(p.productId);
  const colors = p.productAttributes.colorway ? [p.productAttributes.colorway] : [];

  return {
    name: p.title,
    brand: (p.brand ?? "") as Product["brand"],
    category,
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
        availability: "available",
        isOfficial: true,
      },
    ],
    priceMin: price,
    priceMax: price,
    currency: "USD",
    styleKeywords: [],
    gender,
    isNew: false,
    isSaved: false,
  };
}
