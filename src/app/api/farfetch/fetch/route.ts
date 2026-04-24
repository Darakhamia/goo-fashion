import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Category, Gender } from "@/lib/types";

const RETAILED_KEY = process.env.RETAILED_API_KEY;
const BUCKET = "product-images";

interface RetailedProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  gender: string;
  images: string[];
  description: string | null;
  price_currency: string;
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
  if (gender === "women") return "tops";
  return "tops";
}

async function uploadImageToStorage(url: string): Promise<string> {
  if (!isSupabaseConfigured || !supabase) return url;

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
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

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType, upsert: false });

  if (error) return url;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return publicUrl;
}

// POST /api/farfetch/fetch  { url: string, country?: string }
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!RETAILED_KEY) {
    return NextResponse.json({ error: "RETAILED_API_KEY is not configured" }, { status: 501 });
  }

  const { url } = await req.json().catch(() => ({}));
  if (!url || typeof url !== "string" || !url.includes("farfetch.com")) {
    return NextResponse.json({ error: "A valid Farfetch product URL is required" }, { status: 400 });
  }

  // Retailed only supports certain Farfetch locales.
  // Rewrite the URL locale AND set matching country so Farfetch doesn't reject the request.
  const SUPPORTED = new Set(["uk", "us", "fr", "de", "it", "es", "pt", "au", "ca", "jp", "kr", "hk", "sg", "ae", "sa", "br", "ru", "mx", "se", "nl"]);
  const localeMatch = url.match(/farfetch\.com\/([a-z]{2})\//i);
  const urlLocale = localeMatch?.[1]?.toLowerCase() ?? "";
  const targetLocale = SUPPORTED.has(urlLocale) ? urlLocale : "uk";

  // Rewrite URL to the supported locale (e.g. /cz/ → /uk/)
  const normalizedUrl = urlLocale && urlLocale !== targetLocale
    ? url.replace(`farfetch.com/${urlLocale}/`, `farfetch.com/${targetLocale}/`)
    : url;

  // Extract product ID from URL (item-XXXXXXXX)
  const productIdMatch = url.match(/item-(\d+)/i);
  const productId = productIdMatch?.[1];

  // Try 1: full URL
  // Try 2: product ID with extended mode (fallback)
  const attempts = [
    { query: normalizedUrl, mode: undefined },
    ...(productId ? [{ query: productId, mode: "extended" }] : []),
  ];

  let retailedRes: Response | null = null;
  let attemptedUrl = "";

  for (const attempt of attempts) {
    const retailedUrl = new URL("https://app.retailed.io/api/v1/scraper/farfetch/product");
    retailedUrl.searchParams.set("query", attempt.query);
    retailedUrl.searchParams.set("country", targetLocale.toUpperCase());
    if (attempt.mode) retailedUrl.searchParams.set("mode", attempt.mode);
    attemptedUrl = retailedUrl.toString();

    retailedRes = await fetch(attemptedUrl, {
      headers: { "x-api-key": RETAILED_KEY },
      signal: AbortSignal.timeout(20_000),
    });

    if (retailedRes.ok) break;
  }

  if (!retailedRes || !retailedRes.ok) {
    const text = await retailedRes?.text().catch(() => "") ?? "";
    return NextResponse.json(
      { error: `Retailed API error ${retailedRes?.status}: ${text.slice(0, 300)}`, debug: attemptedUrl },
      { status: 502 }
    );
  }

  const raw: RetailedProduct = await retailedRes.json();

  // Upload images to Supabase Storage in parallel (max 6)
  const imageUrls = (raw.images ?? []).slice(0, 6);
  const uploadedImages = await Promise.all(imageUrls.map(uploadImageToStorage));
  const imageUrl = uploadedImages[0] ?? "";

  const gender = raw.gender === "men" ? "men" : raw.gender === "women" ? "women" : undefined;
  const category = inferCategory(raw.name, raw.gender ?? "");

  return NextResponse.json({
    farfetchId: raw.id,
    name: raw.name,
    brand: raw.brand,
    price: raw.price,
    currency: raw.price_currency ?? "USD",
    gender: gender as Gender | undefined,
    category,
    description: raw.description ?? "",
    imageUrl,
    images: uploadedImages,
    sourceUrl: url,
    // Raw Farfetch image URLs in case the admin wants to inspect them
    originalImages: imageUrls,
  });
}
