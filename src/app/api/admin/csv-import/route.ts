import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb } from "@/lib/data/db";
import type { Product, Category, Gender } from "@/lib/types";
import type { CSVMappedRow } from "@/app/goo-studio/brightdata/page";

// ── AWIN category_name → { category, gender } ────────────────────────────────

function parseAwinkCategory(raw: string): { category: Category; gender?: Gender } {
  const t = raw.toLowerCase();

  let gender: Gender | undefined;
  if (/^(women|girls|ladies|femme|woman)/.test(t)) gender = "women";
  else if (/^(men|boys|homme|man\b)/.test(t)) gender = "men";
  else if (/unisex/.test(t)) gender = "unisex";

  let category: Category = "accessories";
  if (/trouser|pant(?!y)/.test(t))                            category = "bottoms";
  else if (/footwear|shoe|boot|trainer|sneaker|sandal|loafer/.test(t)) category = "footwear";
  else if (/\bshirt\b/.test(t))                               category = "shirts";
  else if (/knitwear|knit|sweater|jumper|cardigan/.test(t))   category = "knitwear";
  else if (/jacket|coat|outerwear|parka|anorak/.test(t))      category = "outerwear";
  else if (/\bshort\b/.test(t))                               category = "shorts";
  else if (/skirt/.test(t))                                   category = "skirts";
  else if (/dress/.test(t))                                   category = "dresses";
  else if (/suit|blazer/.test(t))                             category = "blazers";
  else if (/t-shirt|top\b|blouse|polo/.test(t))              category = "tops";
  else if (/jeans|denim/.test(t))                             category = "jeans";
  else if (/bag|backpack|luggage|handbag/.test(t))            category = "bags";
  else if (/swim|bikini|beachwear/.test(t))                   category = "swimwear";
  else if (/jumpsuit|playsuit|overall/.test(t))               category = "jumpsuits";

  return { category, gender };
}

// ── Fallback category from product name ────────────────────────────────────────

function inferCategoryFromName(text: string): Category {
  const t = text.toLowerCase();
  if (/jacket|coat|parka|anorak|windbreaker|bomber|trench/.test(t)) return "outerwear";
  if (/blazer/.test(t)) return "blazers";
  if (/sweater|knit|cardigan|jumper/.test(t)) return "knitwear";
  if (/hoodie|sweatshirt|pullover|\btop\b|blouse|polo/.test(t)) return "tops";
  if (/\bshirt\b/.test(t)) return "shirts";
  if (/\bjeans?\b|denim(?! jacket)/.test(t)) return "jeans";
  if (/trouser|pant|legging|jogger/.test(t)) return "bottoms";
  if (/\bshort\b/.test(t)) return "shorts";
  if (/skirt/.test(t)) return "skirts";
  if (/dress|gown/.test(t)) return "dresses";
  if (/jumpsuit|overall/.test(t)) return "jumpsuits";
  if (/swimwear|bikini/.test(t)) return "swimwear";
  if (/sneaker|trainer|boot|shoe|sandal|loafer|pump/.test(t)) return "footwear";
  if (/\bbag\b|backpack|tote|clutch/.test(t)) return "bags";
  return "accessories";
}

// ── Simple CSV parser (handles quoted fields, pipe separator fallback) ─────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };

  const firstLine = lines.find((l) => l.trim()) ?? "";
  const sep = firstLine.split("\t").length > firstLine.split(",").length ? "\t"
    : firstLine.split("|").length > 10 ? "|" : ",";

  const parseRow = (line: string): string[] => {
    if (sep !== ",") return line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ""));
    const result: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        result.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  let headerLine = 0;
  while (headerLine < lines.length && !lines[headerLine].trim()) headerLine++;
  if (headerLine >= lines.length) return { headers: [], rows: [] };

  const headers = parseRow(lines[headerLine]);
  const dataRows: Record<string, string>[] = [];

  for (let i = headerLine + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    dataRows.push(row);
  }

  return { headers, rows: dataRows };
}

// ── Column resolver (case-insensitive) ────────────────────────────────────────

function resolve(row: Record<string, string>, ...candidates: string[]): string {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find((k) => k.toLowerCase().trim() === c.toLowerCase());
    if (found !== undefined) return (row[found] ?? "").trim();
  }
  return "";
}

// ── Strip trailing size suffix from product name ──────────────────────────────
// Awin names: "Polo Shirt - Blue - M" → strip " - M" → "Polo Shirt - Blue"

const SIZE_SUFFIXES = /\s+-\s+(one\s*size|one|os|xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|\d{1,3}(?:\.\d)?)$/i;

function cleanName(raw: string): string {
  return raw.replace(SIZE_SUFFIXES, "").trim();
}

// ── Strip trailing color suffix from a size-cleaned name ──────────────────────
// "Polo Shirt - Blue" → "Polo Shirt"
// Used for variant grouping — preserves the color-inclusive name for display.

function getBaseProductName(sizeCleanedName: string): string {
  return sizeCleanedName.replace(/\s+-\s+[\w/]+$/, "").trim();
}

// ── Boost AWIN proxy image resolution (200→800px) ────────────────────────────

function boostAwinkImageUrl(url: string): string {
  if (!url.includes("productserve.com") && !url.includes("awin1.com")) return url;
  return url.replace(/w=\d+/, "w=800").replace(/h=\d+/, "h=800");
}

// ── Collect all non-empty image URLs preserving quality order ─────────────────

function collectImages(row: Record<string, string>): string[] {
  const awImage = boostAwinkImageUrl(resolve(row, "aw_image_url"));
  const awThumb = boostAwinkImageUrl(resolve(row, "aw_thumb_url"));

  const candidates = [
    awImage,
    resolve(row, "alternate_image"),
    resolve(row, "merchant_image_url"),
    resolve(row, "alternate_image_three"),
    resolve(row, "alternate_image_four"),
    resolve(row, "large_image"),
    resolve(row, "alternate_image_two"),
    resolve(row, "merchant_thumb_url"),
    awThumb,
  ];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of candidates) {
    if (url && !seen.has(url)) { seen.add(url); result.push(url); }
  }
  return result;
}

// ── Extract ISO currency code from a display price string ────────────────────
// Handles: "£49.99", "GBP89.00", "€39,00", "USD 29.99"

function extractCurrencyFromDisplay(raw: string): string {
  if (!raw) return "";
  if (raw.includes("£")) return "GBP";
  if (raw.includes("€")) return "EUR";
  if (raw.includes("zł")) return "PLN";
  if (raw.includes("₺")) return "TRY";
  if (raw.includes("¥")) return "JPY";
  if (raw.includes("₴")) return "UAH";
  if (raw.includes("Kč")) return "CZK";
  if (raw.includes("kr")) return "SEK";
  if (raw.includes("$")) return "USD";
  // ISO code prefix without space: "GBP89.00"
  const prefixMatch = raw.match(/^([A-Z]{3})\s*[\d.,]/);
  if (prefixMatch) return prefixMatch[1];
  // ISO code suffix: "29.99 GBP"
  const suffixMatch = raw.match(/[\d.,]\s*([A-Z]{3})$/);
  if (suffixMatch) return suffixMatch[1];
  return "";
}

// ── Parse price handling "49.99" and European "49,99" formats ─────────────────

function parsePrice(raw: string): number {
  if (!raw) return 0;
  const stripped = raw.replace(/[^\d.,]/g, "");
  if (!stripped) return 0;
  const lastComma = stripped.lastIndexOf(",");
  const lastDot = stripped.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    // European decimal: "1.234,99" → "1234.99"
    normalized = stripped.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = stripped.replace(/,/g, "");
  }
  return parseFloat(normalized) || 0;
}

// ── Map color name → hex for variant swatches ────────────────────────────────

const COLOR_HEX: Record<string, string> = {
  black: "#111111", white: "#f5f5f5", grey: "#808080", gray: "#808080",
  blue: "#1a47a0", navy: "#001f5b", "navy blue": "#001f5b",
  red: "#c0392b", green: "#2d6a3f", beige: "#d4c5a9", pink: "#e8698a",
  orange: "#e87722", yellow: "#f5c518", purple: "#7b3fa0", violet: "#7b3fa0",
  brown: "#7a4f35", cream: "#f5f0e8", khaki: "#c3b091", camel: "#c19a6b",
  burgundy: "#800020", wine: "#722f37", stone: "#c2b280", sand: "#c2b280",
  silver: "#c0c0c0", gold: "#ffd700", "rose gold": "#b76e79",
  teal: "#008080", mint: "#98d8c8", lilac: "#c8a2c8", coral: "#ff6b6b",
  "off white": "#f5f0e8", ecru: "#f5f0e8", ivory: "#fffff0",
};

function colorToHex(colorName: string): string {
  const key = colorName.toLowerCase().trim();
  return COLOR_HEX[key] ?? "#888888";
}

// ── Map one raw CSV row → CSVMappedRow ────────────────────────────────────────

function mapCSVRow(row: Record<string, string>): CSVMappedRow {
  const issues: string[] = [];

  const rawName = resolve(row, "product_name", "name", "title", "product", "название");
  const name = cleanName(rawName);
  if (!name) issues.push("missing name");

  const merchant = resolve(row, "merchant_name", "brand_name", "brand", "manufacturer");
  const brand = resolve(row, "brand_name", "brand", "merchant_name", "manufacturer");

  // Price: search_price is the main Awin field (always numeric)
  const priceRaw = resolve(row, "search_price", "store_price", "display_price", "base_price", "price", "цена");
  const price = parsePrice(priceRaw);
  if (!price) issues.push("missing price");

  // RRP / original price for discount display
  const rrpRaw = resolve(row, "rrp_price", "product_price_old", "base_price");
  const priceOriginal = parsePrice(rrpRaw);

  // Currency: explicit column → symbol in display_price → ISO code in display_price
  const displayPriceRaw = resolve(row, "display_price");
  const currencyColumn = resolve(row, "currency", "валюта");
  const currency = (
    currencyColumn ||
    extractCurrencyFromDisplay(displayPriceRaw) ||
    extractCurrencyFromDisplay(priceRaw) ||
    "GBP"
  ).toUpperCase();

  // Images: best quality first (AWIN proxy always accessible)
  const allImages = collectImages(row);
  const imageUrl = allImages[0] ?? "";

  // Affiliate link: ONLY aw_deep_link — no fallback to direct merchant URLs
  const referralUrl = resolve(row, "aw_deep_link");
  if (!referralUrl) issues.push("no affiliate link");

  // In-stock check
  const inStockRaw = resolve(row, "in_stock", "stock_status", "is_for_sale");
  const isOutOfStock = inStockRaw === "0" || /sold.?out|out.?of.?stock/i.test(inStockRaw);
  if (isOutOfStock) issues.push("out of stock");

  // Category + gender: Awin category_name → merchant_category → path
  const categoryRaw = resolve(row,
    "category_name", "merchant_category",
    "merchant_product_category_path", "product_type", "category",
  );
  let category: Category;
  let gender: Gender | undefined;

  if (categoryRaw) {
    const parsed = parseAwinkCategory(categoryRaw);
    category = parsed.category;
    gender = parsed.gender;
  } else {
    category = inferCategoryFromName(name);
  }

  // fashion_suitable_for (or Fashion:suitable_for) overrides gender
  const suitableFor = resolve(row,
    "fashion_suitable_for", "fashion:suitable_for", "suitable_for", "gender",
  );
  if (suitableFor) {
    const sf = suitableFor.toLowerCase();
    if (/women|female|ladies|girl/.test(sf)) gender = "women";
    else if (/\bmen\b|male|boy|homme/.test(sf)) gender = "men";
    else if (/unisex/.test(sf)) gender = "unisex";
  }

  // fashion_type as category hint when no category column
  if (!categoryRaw) {
    const fashionType = resolve(row, "fashion_type", "fashion:category");
    if (fashionType) category = inferCategoryFromName(fashionType);
  }

  const colorRaw = resolve(row, "colour", "color", "цвет");
  const colors = colorRaw ? [colorRaw] : [];

  // Sizes: from fashion feed field or standard size columns
  const fashionSizeRaw = resolve(row,
    "fashion_size", "fashion:size", "sizes", "available_sizes", "size",
  );
  const sizes = fashionSizeRaw
    ? fashionSizeRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
    : [];

  // Description: prefer long description, fall back to short or keywords
  const description = resolve(row,
    "description", "product_short_description", "keywords", "desc",
  );

  // Material from specifications (Awin often puts fabric content there)
  const material = resolve(row,
    "fashion:material", "fashion_material", "specifications", "material", "composition", "fabric",
  );

  return {
    name,
    brand,
    merchant,
    category,
    gender,
    price,
    priceOriginal,
    currency,
    imageUrl,
    images: allImages,
    referralUrl,
    colors,
    sizes,
    material,
    description,
    _valid: issues.length === 0,
    _issues: issues,
  };
}

// ── POST /api/admin/csv-import — parse CSV, return merchants summary + rows ───

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const text = await req.text().catch(() => "");
  if (!text.trim()) return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });

  const { headers, rows: csvRows } = parseCSV(text);
  if (!headers.length) return NextResponse.json({ error: "Could not parse CSV headers" }, { status: 400 });

  // Map rows preserving original currencies — no USD conversion
  const rows = csvRows.map((r) => mapCSVRow(r));

  // Build merchants summary
  const merchantMap = new Map<string, { count: number; validCount: number }>();
  for (const row of rows) {
    const m = row.merchant || "Unknown";
    const existing = merchantMap.get(m) ?? { count: 0, validCount: 0 };
    existing.count++;
    if (row._valid) existing.validCount++;
    merchantMap.set(m, existing);
  }

  const merchants = Array.from(merchantMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ columns: headers, merchants, rows });
}

// ── Group keys for variant detection ─────────────────────────────────────────
// colorKey  = brand::baseName::color → same product same color (merge sizes + retailers)
// baseKey   = brand::baseName        → same product diff color (link as variants)

function getGroupKeys(row: CSVMappedRow): { colorKey: string; baseKey: string } {
  const base = getBaseProductName(row.name);
  const brand = (row.brand || row.merchant || "").toLowerCase();
  const color = (row.colors[0] || "").toLowerCase();
  return {
    colorKey: `${brand}::${base.toLowerCase()}::${color}`,
    baseKey:  `${brand}::${base.toLowerCase()}`,
  };
}

// ── PUT /api/admin/csv-import — import rows ───────────────────────────────────

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const toImport: CSVMappedRow[] = Array.isArray(body?.rows) ? body.rows : [];

  if (!toImport.length) return NextResponse.json({ error: "rows array is required" }, { status: 400 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 501 });
  }

  // Separate invalid rows
  let skipped = 0;
  const validRows = toImport.filter((r) => {
    if (!r._valid || !r.name) { skipped++; return false; }
    return true;
  });

  // ── Step 1: group by colorKey (same product + same color, possibly diff sizes/merchants)
  const colorGroupMap = new Map<string, CSVMappedRow[]>();
  for (const row of validRows) {
    const { colorKey } = getGroupKeys(row);
    const existing = colorGroupMap.get(colorKey) ?? [];
    existing.push(row);
    colorGroupMap.set(colorKey, existing);
  }

  // ── Step 2: find base products with multiple color variants → assign variantGroupId
  const baseColorCount = new Map<string, Set<string>>();
  for (const [colorKey, rows] of colorGroupMap) {
    const { baseKey } = getGroupKeys(rows[0]);
    const set = baseColorCount.get(baseKey) ?? new Set<string>();
    set.add(colorKey);
    baseColorCount.set(baseKey, set);
  }

  const baseToVariantGroupId = new Map<string, string>();
  for (const [baseKey, colorSet] of baseColorCount) {
    if (colorSet.size > 1) {
      baseToVariantGroupId.set(baseKey, crypto.randomUUID());
    }
  }

  // ── Step 3: import one product per colorKey
  let imported = 0;
  const errors: { name: string; error: string }[] = [];
  const primarySet = new Set<string>(); // tracks which baseKeys have had their primary assigned

  for (const [, colorRows] of colorGroupMap) {
    const repr = colorRows[0];
    const { baseKey } = getGroupKeys(repr);

    // Merge sizes from all rows in this color group
    const allSizes = [...new Set(colorRows.flatMap((r) => r.sizes || []))];

    // Collect retailers: one entry per unique aw_deep_link
    const seenLinks = new Set<string>();
    const retailers: Product["retailers"] = [];
    for (const row of colorRows) {
      if (row.referralUrl && !seenLinks.has(row.referralUrl)) {
        seenLinks.add(row.referralUrl);
        retailers.push({
          name: row.brand || row.merchant || "Store",
          url: row.referralUrl,
          price: row.price,
          currency: (row.currency || "GBP").toUpperCase(),
          availability: "in stock",
          isOfficial: true,
        });
      }
    }

    // Use minimum price across the group (best deal)
    const prices = colorRows.map((r) => r.price).filter((p) => p > 0);
    const price = prices.length ? Math.min(...prices) : repr.price;
    const currency = (repr.currency || "GBP").toUpperCase();
    const priceOriginal = colorRows.find((r) => r.priceOriginal > 0)?.priceOriginal ?? 0;

    const variantGroupId = baseToVariantGroupId.get(baseKey);
    const isPrimary = variantGroupId ? !primarySet.has(baseKey) : undefined;
    if (isPrimary) primarySet.add(baseKey);

    // When part of a variant group, use base name (without color suffix) as display name
    const displayName = variantGroupId ? getBaseProductName(repr.name) : repr.name;
    const colorHex = repr.colors[0] ? colorToHex(repr.colors[0]) : undefined;

    const product: Partial<Product> = {
      name: displayName,
      brand: (repr.brand || repr.merchant) as Product["brand"],
      category: repr.category,
      description: repr.description || "",
      imageUrl: repr.imageUrl,
      images: repr.images?.length ? repr.images : (repr.imageUrl ? [repr.imageUrl] : []),
      colors: repr.colors,
      sizes: allSizes,
      material: repr.material,
      priceMin: price,
      priceMax: priceOriginal && priceOriginal > price ? priceOriginal : price,
      currency,
      isNew: true,
      isSaved: false,
      gender: repr.gender,
      styleKeywords: [],
      retailers,
      ...(variantGroupId ? { variantGroupId, isGroupPrimary: isPrimary, colorHex } : {}),
    };

    // source_url = first aw_deep_link in the group (for deduplication on re-import)
    const sourceUrl = repr.referralUrl || null;
    const dbRow = { ...productToDb(product), source_url: sourceUrl };

    try {
      if (sourceUrl) {
        const { data: existing } = await supabase
          .from("products").select("id").eq("source_url", sourceUrl).maybeSingle();
        if (existing?.id) {
          await supabase.from("products").update(dbRow).eq("id", existing.id);
        } else {
          await supabase.from("products").insert(dbRow);
        }
      } else {
        await supabase.from("products").insert(dbRow);
      }
      imported++;
    } catch (err) {
      errors.push({ name: repr.name, error: String(err) });
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/");

  return NextResponse.json({ imported, skipped, errors });
}
