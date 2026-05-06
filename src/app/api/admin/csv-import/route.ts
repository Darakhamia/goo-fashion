import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb } from "@/lib/data/db";
import type { Product, Category, Gender } from "@/lib/types";
import type { CSVMappedRow } from "@/app/admin/brightdata/page";

// ── AWIN category_name → { category, gender } ────────────────────────────────

function parseAwinkCategory(raw: string): { category: Category; gender?: Gender } {
  const t = raw.toLowerCase();

  let gender: Gender | undefined;
  if (/^(women|girls|ladies|femme)/.test(t)) gender = "women";
  else if (/^(men|boys|homme)/.test(t)) gender = "men";
  else if (/unisex/.test(t)) gender = "unisex";

  let category: Category = "accessories";
  if (/trouser|pant(?!y)/.test(t)) category = "bottoms";
  else if (/footwear|shoe|boot|trainer|sneaker|sandal|loafer/.test(t)) category = "footwear";
  else if (/\bshirt\b/.test(t)) category = "shirts";
  else if (/knitwear|knit|sweater|jumper|cardigan/.test(t)) category = "knitwear";
  else if (/jacket|coat|outerwear|parka|anorak/.test(t)) category = "outerwear";
  else if (/\bshort\b/.test(t)) category = "shorts";
  else if (/skirt/.test(t)) category = "skirts";
  else if (/dress/.test(t)) category = "dresses";
  else if (/suit|blazer/.test(t)) category = "blazers";
  else if (/t-shirt|top\b|blouse|polo/.test(t)) category = "tops";
  else if (/jeans|denim/.test(t)) category = "jeans";
  else if (/bag|backpack|luggage|handbag/.test(t)) category = "bags";
  else if (/swim|bikini|beachwear/.test(t)) category = "swimwear";
  else if (/jumpsuit|playsuit|overall/.test(t)) category = "jumpsuits";

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

  // Detect separator
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

// ── Strip trailing size/color suffix from product name ────────────────────────
// Awin names often end with " - Color - Size" e.g. "Cap - Beige - One"

const SIZE_SUFFIXES = /\s+-\s+(one\s*size|one|os|xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|\d{1,3}(?:\.\d)?)$/i;

function cleanName(raw: string): string {
  return raw.replace(SIZE_SUFFIXES, "").trim();
}

// ── Collect all non-empty image URLs preserving quality order ─────────────────

function collectImages(row: Record<string, string>): string[] {
  // Priority: Original/Full merchant images first, then AWIN proxy (resized), then thumbs
  const candidates = [
    resolve(row, "alternate_image"),        // /Images/Models/Original/ — best quality
    resolve(row, "merchant_image_url"),     // /Images/Models/Full/ — full size
    resolve(row, "alternate_image_three"),  // additional angle
    resolve(row, "alternate_image_four"),   // additional angle
    resolve(row, "aw_image_url"),           // AWIN proxy 200×200 — reliable fallback
    resolve(row, "large_image"),            // often empty in Awin feeds
    resolve(row, "alternate_image_two"),    // usually a thumbnail
    resolve(row, "merchant_thumb_url"),
    resolve(row, "aw_thumb_url"),
  ];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of candidates) {
    if (url && !seen.has(url)) { seen.add(url); result.push(url); }
  }
  return result;
}

// ── Map one raw CSV row → CSVMappedRow ────────────────────────────────────────

function mapCSVRow(row: Record<string, string>): CSVMappedRow {
  const issues: string[] = [];

  const rawName = resolve(row, "product_name", "name", "title", "product", "название");
  const name = cleanName(rawName);
  if (!name) issues.push("missing name");

  const merchant = resolve(row, "merchant_name", "brand_name", "brand", "manufacturer");
  const brand = resolve(row, "brand_name", "brand", "merchant_name", "manufacturer");

  // Price: search_price is the main Awin field, always filled
  const priceRaw = resolve(row, "search_price", "store_price", "display_price", "base_price", "price", "цена");
  const price = priceRaw ? parseFloat(priceRaw.replace(/[^\d.]/g, "")) : 0;
  if (!price) issues.push("missing price");

  // RRP / original price for discount display
  const rrpRaw = resolve(row, "rrp_price", "product_price_old", "base_price");
  const priceOriginal = rrpRaw ? parseFloat(rrpRaw.replace(/[^\d.]/g, "")) : 0;

  const currency = resolve(row, "currency", "валюта") || "GBP";

  // Images: collect all available URLs, best quality first
  const allImages = collectImages(row);
  const imageUrl = allImages[0] ?? "";

  // Referral: aw_deep_link is the tracked affiliate link (preferred over direct merchant link)
  const referralUrl = resolve(row,
    "aw_deep_link", "merchant_deep_link",
    "referral_url", "affiliate_url", "url", "link",
  );

  // In-stock check
  const inStockRaw = resolve(row, "in_stock", "stock_status", "is_for_sale");
  const isOutOfStock = inStockRaw === "0"
    || /sold.?out|out.?of.?stock/i.test(inStockRaw);
  if (isOutOfStock) issues.push("out of stock");

  // Category + gender from Awin category_name (most accurate source)
  const categoryRaw = resolve(row, "category_name", "merchant_category", "merchant_product_category_path", "product_type", "category");
  let category: Category;
  let gender: Gender | undefined;

  if (categoryRaw) {
    const parsed = parseAwinkCategory(categoryRaw);
    category = parsed.category;
    gender = parsed.gender;
  } else {
    category = inferCategoryFromName(name);
  }

  const colorRaw = resolve(row, "colour", "color", "цвет");
  const colors = colorRaw ? [colorRaw] : [];

  // Description: prefer long description, fall back to short
  const description = resolve(row, "description", "product_short_description", "keywords", "desc");

  // Material from specifications field (Awin often puts fabric content there)
  const material = resolve(row, "specifications", "material", "composition", "fabric");

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

  const rows = csvRows.map(mapCSVRow);

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

  let imported = 0;
  let skipped = 0;
  const errors: { name: string; error: string }[] = [];

  for (const row of toImport) {
    if (!row._valid || !row.name) { skipped++; continue; }

    try {
      const product: Partial<Product> = {
        name: row.name,
        brand: (row.brand || row.merchant) as Product["brand"],
        category: row.category,
        description: row.description || "",
        imageUrl: row.imageUrl,
        images: row.images?.length ? row.images : (row.imageUrl ? [row.imageUrl] : []),
        colors: row.colors,
        sizes: [],
        material: row.material,
        priceMin: row.price,
        priceMax: row.priceOriginal && row.priceOriginal > row.price ? row.priceOriginal : row.price,
        currency: row.currency,
        isNew: true,
        isSaved: false,
        gender: row.gender,
        styleKeywords: [],
        retailers: row.referralUrl
          ? [{
              name: row.brand || row.merchant || "Store",
              url: row.referralUrl,
              price: row.price,
              currency: row.currency,
              availability: "in stock",
              isOfficial: true,
            }]
          : [],
      };

      const dbRow = { ...productToDb(product), source_url: row.referralUrl || null };

      if (row.referralUrl) {
        const { data: existing } = await supabase
          .from("products").select("id").eq("source_url", row.referralUrl).maybeSingle();
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
      errors.push({ name: row.name, error: String(err) });
    }
  }

  revalidatePath("/admin/products");
  revalidatePath("/");

  return NextResponse.json({ imported, skipped, errors });
}
