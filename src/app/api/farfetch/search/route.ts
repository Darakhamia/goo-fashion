import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import type { Category } from "@/lib/types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SCRAPER_KEY = process.env.SCRAPER_API_KEY;

function scraperUrl(target: string): string {
  if (!SCRAPER_KEY) return target;
  return `https://api.scraperapi.com/?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(target)}&country_code=gb`;
}

export interface FarfetchListItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  imageUrl: string;
  url: string;
  gender: string;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractListings(nextData: any): FarfetchListItem[] {
  const items: FarfetchListItem[] = [];
  try {
    const pageProps = nextData?.props?.pageProps ?? nextData?.props ?? {};
    // Multiple possible locations for the product list
    const rawItems: unknown[] =
      pageProps?.initialData?.listingItems?.items ??
      pageProps?.listingItems?.items ??
      pageProps?.items ??
      pageProps?.products ??
      pageProps?.initialData?.products ??
      findArrayWithProducts(pageProps) ??
      [];

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

      // Image
      const imgs = i.images as unknown[];
      let imageUrl = "";
      if (Array.isArray(imgs) && imgs.length > 0) {
        const first = imgs[0] as Record<string, unknown>;
        imageUrl = String(first?.url ?? first?.src ?? imgs[0] ?? "");
        // Sometimes nested
        if (!imageUrl && first?.images && Array.isArray(first.images)) {
          imageUrl = String((first.images[0] as Record<string, unknown>)?.url ?? "");
        }
      }

      const gender = String(i.gender ?? i.genderName ?? "");
      const slug = String(i.slug ?? i.urlSlug ?? "");
      const url = slug
        ? `https://www.farfetch.com/uk/shopping/${gender.toLowerCase().includes("men") ? "men" : "women"}/${slug}-item-${id}.aspx`
        : `https://www.farfetch.com/uk/shopping/item-${id}.aspx`;

      if (!name || !brand || !id) continue;
      items.push({ id, name, brand, price, currency, imageUrl, url, gender });
    }
  } catch {
    // parsing failed, return empty
  }
  return items;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findArrayWithProducts(obj: any, depth = 0): any[] | null {
  if (!obj || typeof obj !== "object" || depth > 5) return null;
  if (Array.isArray(obj)) {
    if (obj.length > 0 && typeof obj[0] === "object" && (obj[0]?.name || obj[0]?.id)) return obj;
    return null;
  }
  for (const key of Object.keys(obj)) {
    const result = findArrayWithProducts(obj[key], depth + 1);
    if (result && result.length > 0) return result;
  }
  return null;
}

// GET /api/farfetch/search?q=balenciaga&gender=men&page=1
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const gender = searchParams.get("gender") ?? "men";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  if (!q.trim()) return NextResponse.json({ error: "q is required" }, { status: 400 });

  // Build Farfetch search URL
  const genderPath = gender === "women" ? "women" : "men";
  const farfetchUrl = new URL(`https://www.farfetch.com/uk/shopping/${genderPath}/`);
  farfetchUrl.searchParams.set("q", q.trim());
  farfetchUrl.searchParams.set("page", String(page));
  farfetchUrl.searchParams.set("view", "90");

  if (!SCRAPER_KEY) {
    return NextResponse.json({ error: "SCRAPER_API_KEY is not configured. Sign up free at scraperapi.com." }, { status: 501 });
  }

  const res = await fetch(scraperUrl(farfetchUrl.toString()), {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Farfetch returned ${res.status}` }, { status: 502 });
  }

  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) {
    return NextResponse.json({ error: "No data found — Farfetch may be blocking the request" }, { status: 502 });
  }

  let nextData: unknown;
  try { nextData = JSON.parse(match[1]); }
  catch { return NextResponse.json({ error: "Failed to parse search results" }, { status: 502 }); }

  const items = extractListings(nextData);
  return NextResponse.json({
    items: items.map((item) => ({ ...item, category: inferCategory(item.name) })),
    page,
    query: q,
    gender,
  });
}
