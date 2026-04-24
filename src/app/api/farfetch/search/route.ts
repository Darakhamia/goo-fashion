import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import type { Category } from "@/lib/types";

const SCRAPER_KEY = process.env.SCRAPER_API_KEY;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface FarfetchListItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  imageUrl: string;
  url: string;
  gender: string;
  category: Category;
}

function inferCategory(name: string): Category {
  const t = name.toLowerCase();
  if (/jacket|coat|parka|windbreaker|bomber|trench/.test(t)) return "outerwear";
  if (/blazer/.test(t)) return "blazers";
  if (/hoodie|sweatshirt|crewneck|pullover/.test(t)) return "tops";
  if (/sweater|knitwear|cardigan|knit/.test(t)) return "knitwear";
  if (/t-shirt|tshirt|tee|\bshirt\b|blouse|polo|tank/.test(t)) return "tops";
  if (/jeans|denim/.test(t)) return "jeans";
  if (/pants|trousers|chinos|leggings|joggers/.test(t)) return "bottoms";
  if (/shorts/.test(t)) return "shorts";
  if (/skirt/.test(t)) return "skirts";
  if (/dress|gown/.test(t)) return "dresses";
  if (/jumpsuit|playsuit|romper|overalls/.test(t)) return "jumpsuits";
  if (/swimsuit|bikini|swimwear/.test(t)) return "swimwear";
  if (/sneaker|trainer|runner|loafer|boot|shoe|sandal|slide|mule|heel|pump/.test(t)) return "footwear";
  if (/bag|backpack|tote|clutch|wallet|purse|satchel|handbag/.test(t)) return "bags";
  if (/hat|cap|beanie/.test(t)) return "accessories";
  if (/belt|scarf|glove|sunglasses|watch|jewelry|ring|necklace/.test(t)) return "accessories";
  return "tops";
}

// ── Strategy 1: Farfetch internal listing API (fast, JSON) ─────────────────
async function tryInternalApi(q: string, gender: string, page: number): Promise<FarfetchListItem[] | null> {
  // Farfetch uses an internal v1 API for their listing page
  const genderId = gender === "women" ? 2 : 1;
  const apiUrl = new URL("https://www.farfetch.com/v1/content/listing");
  apiUrl.searchParams.set("countrycode", "GB");
  apiUrl.searchParams.set("culturecode", "en-GB");
  apiUrl.searchParams.set("q", q);
  apiUrl.searchParams.set("gender", String(genderId));
  apiUrl.searchParams.set("page", String(page));
  apiUrl.searchParams.set("view", "90");

  // Route through ScraperAPI to bypass Cloudflare
  const proxyUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(apiUrl.toString())}&country_code=gb`;

  const res = await fetch(proxyUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) return null;

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    const rawItems: unknown[] =
      data?.listingItems?.items ??
      data?.items ??
      data?.products ??
      data?.data?.items ??
      [];

    return parseItems(rawItems, gender);
  } catch {
    return null;
  }
}

// ── Strategy 2: Rendered HTML via ScraperAPI render=true ───────────────────
async function tryRenderedPage(q: string, gender: string, page: number): Promise<FarfetchListItem[] | null> {
  const genderPath = gender === "women" ? "women" : "men";
  const farfetchUrl = `https://www.farfetch.com/uk/shopping/${genderPath}/?q=${encodeURIComponent(q)}&page=${page}&view=90`;

  // render=true runs real Chromium, waits for JS, returns full DOM
  const proxyUrl = `https://api.scraperapi.com/?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(farfetchUrl)}&country_code=gb&render=true`;

  const res = await fetch(proxyUrl, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) return null;

  const html = await res.text();

  // After render, __NEXT_DATA__ should be populated with listing data
  const ndMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (ndMatch) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nd: any = JSON.parse(ndMatch[1]);
      const items = extractFromNextData(nd, gender);
      if (items.length > 0) return items;
    } catch { /* continue */ }
  }

  // Fallback: parse product cards from rendered HTML by data attributes
  return parseHtmlCards(html, gender);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromNextData(nd: any, gender: string): FarfetchListItem[] {
  const pp = nd?.props?.pageProps ?? nd?.props ?? {};
  const rawItems: unknown[] =
    pp?.initialData?.listingItems?.items ??
    pp?.listingItems?.items ??
    pp?.items ??
    pp?.products ??
    findProductArray(pp) ??
    [];
  return parseItems(rawItems, gender);
}

function parseHtmlCards(html: string, gender: string): FarfetchListItem[] {
  const items: FarfetchListItem[] = [];
  // Farfetch product cards have data-testid="productCard" or similar
  // Extract product JSON blobs embedded as data attributes
  const cardMatches = html.matchAll(/data-testid="[^"]*product[^"]*"[^>]*data-analytics='(\{[^']+\})'/gi);
  for (const m of cardMatches) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = JSON.parse(m[1]);
      const id = String(d.id ?? d.productId ?? "");
      const name = String(d.productDescription ?? d.name ?? "");
      const brand = String(d.brand ?? "");
      const price = Number(d.price ?? d.priceValue ?? 0);
      if (!id || !name) continue;
      items.push({
        id, name, brand, price,
        currency: "GBP",
        imageUrl: String(d.imageUrl ?? d.image ?? ""),
        url: `https://www.farfetch.com/uk/shopping/item-${id}.aspx`,
        gender,
        category: inferCategory(name),
      });
    } catch { /* skip */ }
  }

  // Also try og-style JSON-LD
  const ldMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
  for (const m of ldMatches) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = JSON.parse(m[1]);
      if (d["@type"] === "ItemList" && Array.isArray(d.itemListElement)) {
        for (const el of d.itemListElement) {
          const item = el.item ?? el;
          const id = String(item["@id"] ?? item.productID ?? "").split("-").pop() ?? "";
          const name = String(item.name ?? "");
          const brand = typeof item.brand === "string" ? item.brand : (item.brand?.name ?? "");
          const price = Number(item.offers?.price ?? 0);
          if (!name) continue;
          items.push({
            id, name, brand: String(brand), price,
            currency: String(item.offers?.priceCurrency ?? "GBP"),
            imageUrl: Array.isArray(item.image) ? String(item.image[0] ?? "") : String(item.image ?? ""),
            url: String(item.url ?? `https://www.farfetch.com/uk/shopping/item-${id}.aspx`),
            gender,
            category: inferCategory(name),
          });
        }
      }
    } catch { /* skip */ }
  }

  return items;
}

function parseItems(rawItems: unknown[], gender: string): FarfetchListItem[] {
  const items: FarfetchListItem[] = [];
  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const i = item as Record<string, unknown>;
    const id = String(i.id ?? i.productId ?? "");
    const name = String(i.name ?? i.shortDescription ?? "");
    const brand = typeof i.brand === "object" && i.brand !== null
      ? String((i.brand as Record<string, unknown>).name ?? "")
      : String(i.brand ?? i.designerName ?? "");
    const priceObj = (i.priceInfo ?? i.price ?? {}) as Record<string, unknown>;
    const price = Number(priceObj.finalPrice ?? priceObj.price ?? i.priceMin ?? 0);
    const currency = String(priceObj.currencyCode ?? priceObj.currency ?? "GBP");

    let imageUrl = "";
    const imgs = i.images as unknown[];
    if (Array.isArray(imgs) && imgs.length > 0) {
      const first = imgs[0] as Record<string, unknown>;
      imageUrl = String(first?.url ?? first?.src ?? imgs[0] ?? "");
      if (!imageUrl && first?.images && Array.isArray(first.images)) {
        imageUrl = String((first.images[0] as Record<string, unknown>)?.url ?? "");
      }
    }

    const slug = String(i.slug ?? i.urlSlug ?? "");
    const genderPath = gender === "women" ? "women" : "men";
    const url = slug
      ? `https://www.farfetch.com/uk/shopping/${genderPath}/${slug}-item-${id}.aspx`
      : `https://www.farfetch.com/uk/shopping/item-${id}.aspx`;

    if (!name || !id) continue;
    items.push({ id, name, brand, price, currency, imageUrl, url, gender, category: inferCategory(name) });
  }
  return items;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findProductArray(obj: any, depth = 0): any[] | null {
  if (!obj || typeof obj !== "object" || depth > 5) return null;
  if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === "object" && (obj[0]?.name || obj[0]?.id)) return obj;
  for (const key of Object.keys(obj)) {
    const result = findProductArray(obj[key], depth + 1);
    if (result && result.length > 0) return result;
  }
  return null;
}

// GET /api/farfetch/search?q=balenciaga&gender=men&page=1
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!SCRAPER_KEY) {
    return NextResponse.json({ error: "SCRAPER_API_KEY not configured — sign up free at scraperapi.com" }, { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const gender = searchParams.get("gender") ?? "men";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  if (!q.trim()) return NextResponse.json({ error: "q is required" }, { status: 400 });

  // Try fast internal API first, fall back to rendered page
  let items = await tryInternalApi(q, gender, page);

  if (!items || items.length === 0) {
    items = await tryRenderedPage(q, gender, page);
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No products found. Farfetch may be blocking the request or the search returned no results." }, { status: 502 });
  }

  return NextResponse.json({ items, page, query: q, gender });
}
