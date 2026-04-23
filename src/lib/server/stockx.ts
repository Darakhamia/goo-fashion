import type { Product } from "@/lib/types";

const STOCKX_API_BASE = "https://api.stockx.com/v2";

interface TokenCache {
  access_token: string;
  expires_at: number;
}

let tokenCache: TokenCache | null = null;

async function refreshViaToken(refreshToken: string): Promise<string> {
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
  tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in ?? 86400) * 1000,
  };

  return tokenCache.access_token;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expires_at - 60_000) {
    return tokenCache.access_token;
  }

  const refreshToken = process.env.STOCKX_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "STOCKX_REFRESH_TOKEN is not set. Add it to your environment variables and redeploy."
    );
  }

  return refreshViaToken(refreshToken);
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
  media?: {
    imageUrl?: string;
    smallImageUrl?: string;
    thumbUrl?: string;
  };
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

export async function searchStockX(query: string, page = 1, pageSize = 40): Promise<StockXSearchResponse> {
  const params = new URLSearchParams({
    query,
    pageNumber: String(page),
    pageSize: String(Math.min(pageSize, 40)),
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

// Infer GOO category from StockX productType + product title.
// productType alone is often too coarse ("Apparel"), so we fall back to
// keyword-matching on the title when the type doesn't resolve precisely.
function inferCategory(p: StockXProduct): string {
  const type = (p.productType ?? "").toLowerCase();
  const title = (p.title ?? "").toLowerCase();

  // ── productType exact / keyword matches ─────────────────────────────────
  if (/sneaker|shoe|boot|clog|sandal|slide|loafer|mule/.test(type)) return "footwear";
  if (/jacket|coat|parka|anorak|windbreaker|blazer/.test(type)) return "outerwear";
  if (/hoodie|sweatshirt|crewneck|pullover|fleece/.test(type)) return "tops";
  if (/t-shirt|tee|shirt|blouse|polo|tank/.test(type)) return "tops";
  if (/knitwear|sweater|cardigan/.test(type)) return "knitwear";
  if (/jean|denim|pant|trouser|chino|legging/.test(type)) return "bottoms";
  if (/short/.test(type)) return "shorts";
  if (/skirt/.test(type)) return "skirts";
  if (/dress/.test(type)) return "dresses";
  if (/jumpsuit|overall|romper/.test(type)) return "jumpsuits";
  if (/bag|backpack|tote|clutch|wallet|purse|handbag/.test(type)) return "bags";
  if (/hat|cap|beanie|bucket/.test(type)) return "accessories";
  if (/sock/.test(type)) return "accessories";
  if (/accessory|accessories|jewelry|watch|belt|scarf|glove/.test(type)) return "accessories";
  if (/collectible|electronics|trading|card/.test(type)) return "accessories";

  // ── title keyword fallback ───────────────────────────────────────────────
  if (/jacket|coat|parka|anorak|windbreaker|bomber|harrington/.test(title)) return "outerwear";
  if (/blazer/.test(title)) return "outerwear";
  if (/hoodie|hoody|sweatshirt|crewneck|pullover|fleece/.test(title)) return "tops";
  if (/sweater|knitwear|cardigan|knit/.test(title)) return "knitwear";
  if (/\bt-shirt\b|tee\b|\bshirt\b|blouse|polo|tank top/.test(title)) return "tops";
  if (/pants\b|trousers|chinos|jeans\b|leggings|joggers/.test(title)) return "bottoms";
  if (/denim(?! jacket)/.test(title)) return "bottoms";
  if (/\bshorts\b/.test(title)) return "shorts";
  if (/\bskirt\b/.test(title)) return "skirts";
  if (/\bdress\b|\bgown\b/.test(title)) return "dresses";
  if (/jumpsuit|playsuit|romper|\boveralls\b/.test(title)) return "jumpsuits";
  if (/\bbag\b|backpack|tote|clutch|wallet|purse|satchel|duffel/.test(title)) return "bags";
  if (/\bhat\b|\bcap\b|beanie|snapback|bucket hat|beret/.test(title)) return "accessories";
  if (/\bsocks?\b/.test(title)) return "accessories";
  if (/sneaker|shoe|boot|trainer|runner/.test(title)) return "footwear";

  return "accessories";
}

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

export function stockxCdnImage(urlKey: string): string {
  return `https://images.stockx.com/images/${urlKey}.jpg`;
}

export function getStockXImageUrl(p: StockXProduct): string {
  return p.media?.imageUrl ?? p.media?.smallImageUrl ?? stockxCdnImage(p.urlKey);
}

export function mapStockXToProduct(p: StockXProduct, sizes: string[]) {
  const category = inferCategory(p);
  const colorKey = (p.productAttributes.color ?? "").toLowerCase().trim();
  const colorHex = COLOR_TO_HEX[colorKey] ?? undefined;
  const price = p.productAttributes.retailPrice ?? 0;
  const rawGender = (p.productAttributes.gender ?? "unisex").toLowerCase();
  const gender = (["women", "men", "unisex"].includes(rawGender) ? rawGender : "unisex") as "women" | "men" | "unisex";
  const imageUrl = getStockXImageUrl(p);
  const colors = p.productAttributes.colorway ? [p.productAttributes.colorway] : [];

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
