import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Category, Gender } from "@/lib/types";

const BUCKET = "product-images";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface FarfetchProduct {
  farfetchId: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  gender?: Gender;
  category: Category;
  description: string;
  imageUrl: string;
  images: string[];
  sourceUrl: string;
}

function inferCategory(name: string, gender: string): Category {
  const t = name.toLowerCase();
  if (/jacket|coat|parka|anorak|windbreaker|bomber|trench/.test(t)) return "outerwear";
  if (/blazer/.test(t)) return "blazers";
  if (/hoodie|sweatshirt|crewneck|pullover|fleece/.test(t)) return "tops";
  if (/sweater|knitwear|cardigan|knit/.test(t)) return "knitwear";
  if (/t-shirt|tshirt|\btee\b|\bshirt\b|blouse|polo|tank/.test(t)) return "tops";
  if (/jeans?\b|denim(?! jacket)/.test(t)) return "jeans";
  if (/pants?\b|trousers?|chinos?|leggings?|joggers?/.test(t)) return "bottoms";
  if (/\bshorts?\b/.test(t)) return "shorts";
  if (/\bskirt\b/.test(t)) return "skirts";
  if (/\bdress\b|\bgown\b/.test(t)) return "dresses";
  if (/jumpsuit|playsuit|romper|\boveralls?\b/.test(t)) return "jumpsuits";
  if (/swimsuit|bikini|swimwear|swim/.test(t)) return "swimwear";
  if (/sneaker|trainer|runner|loafer|boot|shoe|sandal|slide|mule|heel|pump|slipper/.test(t)) return "footwear";
  if (/\bbag\b|backpack|tote|clutch|wallet|purse|satchel|handbag/.test(t)) return "bags";
  if (/\bhat\b|\bcap\b|beanie|bucket hat|beret|snapback/.test(t)) return "accessories";
  if (/\bsock/.test(t)) return "accessories";
  if (/belt|scarf|glove|sunglasses|glasses|watch|jewelry|jewellery|ring|necklace|bracelet|earring/.test(t)) return "accessories";
  return gender === "Women" ? "tops" : "tops";
}

async function uploadImageToStorage(url: string): Promise<string> {
  if (!isSupabaseConfigured || !supabase) return url;
  try {
    const res = await fetch(url, {
      headers: { "Referer": "https://www.farfetch.com/", "User-Agent": UA },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return url;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return url;
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const filename = `farfetch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }
    const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, { contentType, upsert: false });
    if (error) return url;
    return supabase.storage.from(BUCKET).getPublicUrl(filename).data.publicUrl;
  } catch {
    return url;
  }
}

// Parse product data from Farfetch __NEXT_DATA__ JSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNextData(data: any, sourceUrl: string): FarfetchProduct | null {
  try {
    // Try multiple known paths in the Next.js page props
    const pageProps =
      data?.props?.pageProps ??
      data?.props?.initialProps ??
      data?.props ?? {};

    const productData =
      pageProps?.productDetails ??
      pageProps?.product ??
      pageProps?.initialData?.productDetails ??
      pageProps?.initialData?.product ??
      // Deep search for product object with id + brand
      findProductInObject(pageProps);

    if (!productData) return null;

    const id = String(productData.id ?? productData.productId ?? "");
    const name: string = productData.name ?? productData.shortDescription ?? "";
    const brand: string =
      productData.brand?.name ??
      productData.brand ??
      productData.designerName ??
      "";

    // Price
    const priceInfo =
      productData.priceInfo ??
      productData.price ??
      productData.currentPriceInfo ??
      {};
    const price: number =
      priceInfo.finalPrice ??
      priceInfo.initialPrice ??
      priceInfo.price ??
      productData.priceMin ??
      0;
    const currency: string = priceInfo.currencyCode ?? priceInfo.currency ?? "GBP";

    // Images
    const images: string[] = [];
    const rawImages =
      productData.images ??
      productData.imageGroups ??
      productData.media ??
      [];
    if (Array.isArray(rawImages)) {
      for (const img of rawImages) {
        const src = typeof img === "string" ? img : (img?.url ?? img?.src ?? img?.imageUrl ?? img?.images?.[0]?.url);
        if (src && typeof src === "string" && src.startsWith("http")) images.push(src);
        // Some images arrays are nested
        if (img?.images && Array.isArray(img.images)) {
          for (const i2 of img.images) {
            const s2 = i2?.url ?? i2?.src;
            if (s2 && typeof s2 === "string") images.push(s2);
          }
        }
      }
    }

    const gender: string = productData.gender ?? productData.genderName ?? "";
    const description: string = productData.description ?? productData.longDescription ?? "";

    if (!name || !brand) return null;

    return {
      farfetchId: id,
      name,
      brand,
      price,
      currency,
      gender: gender.toLowerCase().includes("men") ? "men" : gender.toLowerCase().includes("women") ? "women" : undefined,
      category: inferCategory(name, gender),
      description,
      imageUrl: images[0] ?? "",
      images: images.slice(0, 8),
      sourceUrl,
    };
  } catch {
    return null;
  }
}

// Recursively search for a product-shaped object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findProductInObject(obj: any, depth = 0): any {
  if (!obj || typeof obj !== "object" || depth > 6) return null;
  if (obj.name && obj.brand && (obj.id || obj.productId)) return obj;
  for (const key of Object.keys(obj)) {
    const result = findProductInObject(obj[key], depth + 1);
    if (result) return result;
  }
  return null;
}

async function scrapeFarfetchProduct(url: string): Promise<FarfetchProduct> {
  // Normalise to UK to get GBP pricing
  const normalised = url.replace(/farfetch\.com\/[a-z]{2}\//, "farfetch.com/uk/");

  const res = await fetch(normalised, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) throw new Error(`Farfetch returned ${res.status}`);

  const html = await res.text();

  // Extract __NEXT_DATA__ JSON
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Could not find __NEXT_DATA__ in page — Farfetch may be blocking the request");

  let nextData: unknown;
  try {
    nextData = JSON.parse(match[1]);
  } catch {
    throw new Error("Failed to parse __NEXT_DATA__ JSON");
  }

  const product = parseNextData(nextData, url);
  if (!product) throw new Error("Could not extract product data from page — structure may have changed");

  return product;
}

// POST /api/farfetch/fetch  { url: string }
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string" || !url.includes("farfetch.com")) {
    return NextResponse.json({ error: "A valid Farfetch product URL is required" }, { status: 400 });
  }

  let product: FarfetchProduct;
  try {
    product = await scrapeFarfetchProduct(url);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Scrape failed" }, { status: 502 });
  }

  // Upload images to Supabase Storage (max 6, in parallel)
  const uploadedImages = await Promise.all(product.images.slice(0, 6).map(uploadImageToStorage));
  const imageUrl = uploadedImages[0] ?? "";

  return NextResponse.json({ ...product, imageUrl, images: uploadedImages });
}
