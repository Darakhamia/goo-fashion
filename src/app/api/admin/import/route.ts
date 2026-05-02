import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb } from "@/lib/data/db";
import type { Product } from "@/lib/types";
import type { Category, Gender } from "@/lib/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const SCRAPER_KEY = process.env.SCRAPER_API_KEY;

function proxyUrl(target: string): string {
  if (!SCRAPER_KEY) return target;
  return `https://api.scraperapi.com/?api_key=${SCRAPER_KEY}&url=${encodeURIComponent(target)}&country_code=gb`;
}

// ── Platform detection ────────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("farfetch")) return "farfetch";
    if (host.includes("ssense")) return "ssense";
    if (host.includes("mytheresa")) return "mytheresa";
    if (host.includes("net-a-porter")) return "net-a-porter";
    if (host.includes("mrporter")) return "mr-porter";
    if (host.includes("matchesfashion")) return "matchesfashion";
    if (host.includes("zara")) return "zara";
    if (host.includes("asos")) return "asos";
    if (host.includes("hm.com") || host.includes("h&m")) return "hm";
    if (host.includes("nordstrom")) return "nordstrom";
    if (host.includes("saks")) return "saks";
    if (host.includes("shopbop")) return "shopbop";
    if (host.includes("revolve")) return "revolve";
    if (host.includes("luisaviaroma")) return "luisaviaroma";
    return host.split(".").slice(-2, -1)[0] ?? host;
  } catch {
    return "unknown";
  }
}

// ── Category inference ────────────────────────────────────────────────────────

function inferCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/jacket|coat|parka|anorak|windbreaker|bomber|trench/.test(t)) return "outerwear";
  if (/blazer/.test(t)) return "blazers";
  if (/sweater|knitwear|cardigan|\bknit\b/.test(t)) return "knitwear";
  if (/hoodie|sweatshirt|crewneck|pullover|fleece|t-shirt|tshirt|\btee\b|blouse|polo|tank/.test(t)) return "tops";
  if (/\bshirt\b/.test(t)) return "shirts";
  if (/jeans?\b|denim(?! jacket)/.test(t)) return "jeans";
  if (/pants?\b|trousers?|chinos?|leggings?|joggers?/.test(t)) return "bottoms";
  if (/\bshorts?\b/.test(t)) return "shorts";
  if (/\bskirt\b/.test(t)) return "skirts";
  if (/\bdress\b|\bgown\b/.test(t)) return "dresses";
  if (/jumpsuit|playsuit|romper|\boveralls?\b/.test(t)) return "jumpsuits";
  if (/swimsuit|bikini|swimwear|\bswim\b/.test(t)) return "swimwear";
  // footwear — broad list incl. "low-top", "high-top", "athletic", "running"
  if (/sneaker|trainer|runner|loafer|\bboot\b|\bshoe\b|sandal|slide|\bmule\b|heel|pump|slipper|low.?top|high.?top|athletic|running shoe|court shoe|derby|oxford|espadrille|clog/.test(t)) return "footwear";
  if (/\bbag\b|backpack|tote|clutch|wallet|purse|satchel|handbag/.test(t)) return "bags";
  return "accessories";
}

function inferGender(text: string): Gender | undefined {
  const t = text.toLowerCase();
  if (/\bwomen\b|\bwoman\b|\bfemale\b|\bladies\b/.test(t)) return "women";
  if (/\bmen\b|\bman\b|\bmale\b|\bgents\b/.test(t)) return "men";
  return undefined;
}

// ── HTML helper ───────────────────────────────────────────────────────────────

function getMeta(html: string, attr: string, value: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtmlEntities(m[1]);
  }
  return undefined;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Fix Cloudinary template placeholders (e.g. SSENSE uses __IMAGE_PARAMS__)
function fixImageUrl(url: string): string {
  return url.replace(/__IMAGE_PARAMS__/g, "f_auto,c_limit,w_1200");
}

function isValidImageUrl(url: string): boolean {
  return (
    url.startsWith("http") &&
    !url.includes("__") &&
    !url.includes("placeholder") &&
    !url.includes("noimage")
  );
}

// Extract all og:image tags (pages can have multiple)
function extractOgImages(html: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const patterns = [
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/gi,
    /<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const url = fixImageUrl(m[1]);
      if (isValidImageUrl(url) && !seen.has(url)) {
        seen.add(url);
        result.push(url);
      }
    }
  }
  return result;
}

// For SSENSE: image URLs end with _1/slug.jpg — generate _2…_6 variants
function expandSsenseAngles(urls: string[]): string[] {
  const expanded: string[] = [...urls];
  for (const url of urls) {
    if (!url.includes("ssensemedia.com")) continue;
    const m = url.match(/(_1)(\/[^/]+\.jpg)/);
    if (!m) continue;
    const base = url.slice(0, url.lastIndexOf(m[1] + m[2]));
    for (let i = 2; i <= 6; i++) {
      expanded.push(`${base}_${i}${m[2]}`);
    }
  }
  return [...new Set(expanded)];
}

// ── Structured data extracted from a page ────────────────────────────────────

interface Extracted {
  name: string;
  brand: string;
  category: Category;
  description: string;
  price: number;
  sale_price?: number;
  currency: string;
  colors: string[];
  sizes: string[];
  gender?: Gender;
  image_urls: string[];
  source_url: string;
  platform: string;
}

// ── 1. JSON-LD (schema.org/Product) ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSchemaProduct(p: any, sourceUrl: string): Extracted | null {
  const name: string = p.name ?? p.title ?? "";
  if (!name) return null;

  const brand: string =
    typeof p.brand === "string" ? p.brand : (p.brand?.name ?? p.manufacturer ?? "");

  const description: string = stripTags(p.description ?? "");

  // Price / offers
  const offers = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  const price: number = parseFloat(offers?.price ?? p.price ?? "0") || 0;
  const lowPrice: number = parseFloat(p.lowPrice ?? offers?.lowPrice ?? "0") || 0;
  const sale_price: number | undefined =
    lowPrice && lowPrice < price ? lowPrice : undefined;
  const currency: string = offers?.priceCurrency ?? p.priceCurrency ?? "USD";

  // Images
  const rawImages = Array.isArray(p.image) ? p.image : p.image ? [p.image] : [];
  const image_urls: string[] = rawImages
    .map((img: unknown) => (typeof img === "string" ? img : (img as Record<string, string>)?.url ?? ""))
    .map(fixImageUrl)
    .filter(isValidImageUrl)
    .slice(0, 8);

  // Colors & sizes (schema.org ProductVariant style)
  const colors: string[] = [];
  const sizes: string[] = [];
  if (Array.isArray(p.color)) colors.push(...p.color);
  else if (p.color) colors.push(String(p.color));
  if (Array.isArray(p.size)) sizes.push(...p.size);
  else if (p.size) sizes.push(String(p.size));

  const genderRaw: string = p.audience?.suggestedGender ?? p.gender ?? "";
  const gender = inferGender(genderRaw) ?? inferGender(name);
  const category = inferCategory(p.category ?? name);

  return {
    name,
    brand,
    category,
    description,
    price: price || lowPrice,
    sale_price,
    currency,
    colors,
    sizes,
    gender,
    image_urls,
    source_url: sourceUrl,
    platform: detectPlatform(sourceUrl),
  };
}

function extractJsonLd(html: string, sourceUrl: string): Extracted | null {
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = JSON.parse(m[1]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = Array.isArray(json)
        ? json
        : json["@graph"]
        ? json["@graph"]
        : [json];
      for (const item of items) {
        const type: string | string[] = item["@type"] ?? "";
        const isProduct = Array.isArray(type)
          ? type.some((t) => t === "Product" || t.endsWith("Product"))
          : type === "Product" || type.endsWith("Product");
        if (isProduct) {
          const result = parseSchemaProduct(item, sourceUrl);
          if (result) return result;
        }
      }
    } catch {
      // malformed JSON-LD, skip
    }
  }
  return null;
}

// ── 2. Open Graph tags ────────────────────────────────────────────────────────

function extractOgTags(html: string, sourceUrl: string): Extracted | null {
  const title = getMeta(html, "property", "og:title");
  if (!title) return null;

  const description = getMeta(html, "property", "og:description") ?? getMeta(html, "name", "description") ?? "";
  const price = parseFloat(
    getMeta(html, "property", "product:price:amount") ??
    getMeta(html, "property", "og:price:amount") ?? "0"
  ) || 0;
  const currency =
    getMeta(html, "property", "product:price:currency") ??
    getMeta(html, "property", "og:price:currency") ?? "USD";

  const brand =
    getMeta(html, "property", "og:brand") ??
    getMeta(html, "name", "brand") ??
    getMeta(html, "property", "og:site_name") ?? "";

  // Use title + description + URL path for category — og:title on many sites is "Brand | Site"
  const urlPath = (() => { try { return new URL(sourceUrl).pathname; } catch { return ""; } })();
  const categoryHint = title + " " + description + " " + urlPath;

  return {
    name: title,
    brand,
    category: inferCategory(categoryHint),
    description,
    price,
    currency,
    colors: [],
    sizes: [],
    gender: inferGender(title + " " + description),
    image_urls: extractOgImages(html),
    source_url: sourceUrl,
    platform: detectPlatform(sourceUrl),
  };
}

// ── 3. HTML selectors (last resort) ──────────────────────────────────────────

function extractHtmlFallback(html: string, sourceUrl: string): Extracted | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const name = h1 ? stripTags(h1).trim() : "";
  if (!name) return null;

  const description = getMeta(html, "name", "description") ?? "";
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const pageTitle = titleTag ? stripTags(titleTag) : "";

  return {
    name,
    brand: "",
    category: inferCategory(name + " " + pageTitle),
    description,
    price: 0,
    currency: "USD",
    colors: [],
    sizes: [],
    gender: inferGender(name + " " + pageTitle),
    image_urls: [],
    source_url: sourceUrl,
    platform: detectPlatform(sourceUrl),
  };
}

// ── Main extraction pipeline ──────────────────────────────────────────────────

async function extractProduct(url: string): Promise<Extracted> {
  const fetchUrl = proxyUrl(url);
  const res = await fetch(fetchUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const hint = !SCRAPER_KEY && res.status === 403
      ? " — this site blocks bots. Add SCRAPER_API_KEY to bypass (free at scraperapi.com)"
      : "";
    throw new Error(`Page returned HTTP ${res.status}${hint}`);
  }

  const html = await res.text();

  const result =
    extractJsonLd(html, url) ??
    extractOgTags(html, url) ??
    extractHtmlFallback(html, url);

  if (!result) throw new Error("Could not extract product data from page");

  // Expand SSENSE angle variants + merge any OG images not already in the list
  const ogImages = extractOgImages(html);
  const merged = [...new Set([...result.image_urls, ...ogImages])];
  result.image_urls = expandSsenseAngles(merged).slice(0, 10);

  return result;
}

// ── GET — recent import jobs ──────────────────────────────────────────────────

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ jobs: [] });
  }

  const { data, error } = await supabase
    .from("import_jobs")
    .select("id, url, status, error, result_product_id, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

// ── POST — import a product URL ───────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }, { status: 501 });
  }

  const body = await req.json().catch(() => ({}));
  const url: string = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "A product URL is required" }, { status: 400 });

  // Create a pending job record
  const { data: job, error: jobCreateErr } = await supabase
    .from("import_jobs")
    .insert({ url, status: "processing" })
    .select()
    .single();

  if (jobCreateErr || !job) {
    return NextResponse.json({ error: "Failed to create import job" }, { status: 500 });
  }

  const jobId: string = job.id;

  const fail = async (message: string) => {
    await supabase!
      .from("import_jobs")
      .update({ status: "failed", error: message })
      .eq("id", jobId);
    return NextResponse.json({ error: message }, { status: 422 });
  };

  // Extract product data
  let extracted: Extracted;
  try {
    extracted = await extractProduct(url);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Extraction failed");
  }

  // Build the product row
  const partial: Partial<Product> = {
    name: extracted.name,
    brand: extracted.brand as Product["brand"],
    category: extracted.category,
    description: extracted.description,
    imageUrl: extracted.image_urls[0] ?? "",
    images: extracted.image_urls,
    colors: extracted.colors,
    sizes: extracted.sizes,
    material: "",
    priceMin: extracted.price,
    priceMax: extracted.sale_price ?? extracted.price,
    currency: extracted.currency,
    isNew: true,
    isSaved: false,
    gender: extracted.gender,
    styleKeywords: [],
    retailers: [
      {
        name: extracted.platform,
        url: extracted.source_url,
        price: extracted.sale_price ?? extracted.price,
        currency: extracted.currency,
        availability: "in stock",
        isOfficial: true,
      },
    ],
  };

  const row = {
    ...productToDb(partial),
    status: "draft",
    source_url: extracted.source_url,
    ai_tags: [],
  };

  // Check for existing product with same source_url to avoid upsert constraint issues
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("source_url", extracted.source_url)
    .maybeSingle();

  let product: Record<string, unknown> | null = null;

  if (existing?.id) {
    // Update in place
    const { data, error: updateErr } = await supabase
      .from("products")
      .update(row)
      .eq("id", existing.id)
      .select()
      .single();
    if (updateErr || !data) return fail(updateErr?.message ?? "Failed to update product");
    product = data as Record<string, unknown>;
  } else {
    // Fresh insert
    const { data, error: insertErr } = await supabase
      .from("products")
      .insert(row)
      .select()
      .single();
    if (insertErr || !data) return fail(insertErr?.message ?? "Failed to save product");
    product = data as Record<string, unknown>;
  }

  // Mark job as done
  await supabase
    .from("import_jobs")
    .update({ status: "done", result_product_id: product.id })
    .eq("id", jobId);

  revalidatePath("/admin/products");
  revalidatePath("/admin/import");

  return NextResponse.json({
    product: {
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price_min,
      currency: product.currency,
      image_url: product.image_url,
      status: product.status ?? "draft",
      source_url: product.source_url,
    },
    job: { id: jobId, status: "done" },
  }, { status: 201 });
}
