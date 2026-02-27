import type { Product } from "@/lib/types";

// ── Raw types returned by the Nike RapidAPI ──────────────────────────────────
// The API may return slightly different shapes depending on endpoint.
// We use a loose structure and extract what we can.

interface NikeRawImage {
  squarishURL?: string;
  portraitURL?: string;
  squarish_url?: string;
  portrait_url?: string;
  url?: string;
}

interface NikeRawColorway {
  colorDescription?: string;
  color_description?: string;
  pdpUrl?: string;
  pdp_url?: string;
}

interface NikeRawPrice {
  currentPrice?: number;
  current_price?: number;
  fullPrice?: number;
  full_price?: number;
  currency?: string;
}

interface NikeRawProduct {
  id?: string;
  cloudProductId?: string;
  title?: string;
  name?: string;
  subtitle?: string;
  description?: string;
  price?: NikeRawPrice | number;
  images?: NikeRawImage;
  colorways?: NikeRawColorway[];
  availableSizes?: string[];
  available_sizes?: string[];
  skus?: { nikeSize?: string; size?: string }[];
  url?: string;
  pdpUrl?: string;
  pdp_url?: string;
  productType?: string;
  product_type?: string;
}

interface NikeApiResponse {
  // Common shapes returned by various Nike RapidAPI wrappers
  products?: NikeRawProduct[];
  objects?: NikeRawProduct[];
  data?: NikeRawProduct[] | { products?: NikeRawProduct[] };
  items?: NikeRawProduct[];
  results?: NikeRawProduct[];
}

// ── Normalisation helpers ─────────────────────────────────────────────────────

function extractImage(raw: NikeRawProduct): string {
  const img = raw.images;
  if (!img) return "";
  return (
    img.squarishURL ||
    img.squarish_url ||
    img.portraitURL ||
    img.portrait_url ||
    img.url ||
    ""
  );
}

function extractPrice(raw: NikeRawProduct): number {
  if (!raw.price) return 0;
  if (typeof raw.price === "number") return raw.price;
  return (
    raw.price.currentPrice ||
    raw.price.current_price ||
    raw.price.fullPrice ||
    raw.price.full_price ||
    0
  );
}

function extractColors(raw: NikeRawProduct): string[] {
  if (!raw.colorways?.length) return [];
  return raw.colorways.map(
    (c) => c.colorDescription || c.color_description || "—"
  );
}

function extractSizes(raw: NikeRawProduct): string[] {
  if (raw.availableSizes?.length) return raw.availableSizes;
  if (raw.available_sizes?.length) return raw.available_sizes;
  if (raw.skus?.length) {
    return raw.skus.map((s) => s.nikeSize || s.size || "").filter(Boolean);
  }
  return [];
}

function extractUrl(raw: NikeRawProduct): string {
  return raw.url || raw.pdpUrl || raw.pdp_url || "https://www.nike.com";
}

function extractId(raw: NikeRawProduct): string {
  return raw.id || raw.cloudProductId || Math.random().toString(36).slice(2);
}

function extractName(raw: NikeRawProduct): string {
  return raw.title || raw.name || "Nike Product";
}

// ── Category guesser from product type / name ─────────────────────────────────

function guessCategory(raw: NikeRawProduct): Product["category"] {
  const type = (raw.productType || raw.product_type || "").toLowerCase();
  const name = extractName(raw).toLowerCase();
  const sub = (raw.subtitle || "").toLowerCase();

  if (
    type.includes("footwear") ||
    type.includes("shoe") ||
    name.includes("shoe") ||
    name.includes("sneaker") ||
    name.includes("boot") ||
    name.includes("air") ||
    sub.includes("shoe")
  )
    return "footwear";

  if (
    type.includes("top") ||
    name.includes("t-shirt") ||
    name.includes("tee") ||
    name.includes("hoodie") ||
    name.includes("sweatshirt") ||
    name.includes("jacket") ||
    sub.includes("top")
  )
    return "tops";

  if (
    type.includes("bottom") ||
    name.includes("shorts") ||
    name.includes("tights") ||
    name.includes("leggings") ||
    name.includes("pants") ||
    name.includes("jogger")
  )
    return "bottoms";

  if (name.includes("bag") || name.includes("backpack") || name.includes("cap") || name.includes("hat"))
    return "accessories";

  return "tops"; // safe default for Nike apparel
}

// ── Public mapper ─────────────────────────────────────────────────────────────

export function mapNikeProduct(raw: NikeRawProduct, index: number): Product {
  const price = extractPrice(raw);
  const imageUrl = extractImage(raw);
  const productUrl = extractUrl(raw);
  const colors = extractColors(raw);
  const sizes = extractSizes(raw);

  return {
    id: `nike-${extractId(raw)}`,
    name: extractName(raw),
    brand: "Nike",
    category: guessCategory(raw),
    description: raw.description || raw.subtitle || "Nike product.",
    imageUrl,
    images: imageUrl ? [imageUrl] : [],
    colors: colors.length ? colors : ["Default"],
    sizes: sizes.length ? sizes : ["S", "M", "L", "XL"],
    material: "Nike performance fabric",
    priceMin: price,
    priceMax: price,
    currency: "USD",
    retailers: [
      {
        name: "Nike Official",
        url: productUrl,
        price,
        currency: "USD",
        availability: "in stock",
        isOfficial: true,
      },
    ],
    isNew: index < 5,
    isSaved: false,
    styleKeywords: ["sporty"],
  };
}

// ── Extract product array from various response shapes ────────────────────────

export function extractProductsFromResponse(data: NikeApiResponse): NikeRawProduct[] {
  if (Array.isArray(data)) return data as NikeRawProduct[];
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.objects)) return data.objects;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  if (data.data) {
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray((data.data as { products?: NikeRawProduct[] }).products))
      return (data.data as { products?: NikeRawProduct[] }).products!;
  }
  return [];
}

// ── Client-side fetch helper ──────────────────────────────────────────────────

export async function fetchNikeProducts(query?: string): Promise<Product[]> {
  const url = query
    ? `/api/nike?q=${encodeURIComponent(query)}`
    : `/api/nike`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Nike API error ${res.status}`);
  }

  const data: NikeApiResponse = await res.json();
  const raw = extractProductsFromResponse(data);
  return raw.map((item, i) => mapNikeProduct(item, i));
}
