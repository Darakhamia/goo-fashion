import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb } from "@/lib/data/db";
import type { Product, Category, Gender } from "@/lib/types";
import type { CSVMappedRow } from "@/app/admin/brightdata/page";

// ── Category inference ────────────────────────────────────────────────────────

function inferCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/jacket|coat|parka|anorak|windbreaker|bomber|trench|cape|куртка|пальто/.test(t)) return "outerwear";
  if (/blazer|блейзер/.test(t)) return "blazers";
  if (/sweater|knit|кардиган|джемпер|свитер|трикотаж/.test(t)) return "knitwear";
  if (/hoodie|sweatshirt|pullover|top\b|blouse|polo|футболка|топ/.test(t)) return "tops";
  if (/\bshirt\b|рубашка/.test(t)) return "shirts";
  if (/\bjeans?\b|denim(?! jacket)|джинсы/.test(t)) return "jeans";
  if (/trouser|pant|legging|jogger|брюки|штаны/.test(t)) return "bottoms";
  if (/\bshort\b|шорты/.test(t)) return "shorts";
  if (/skirt|юбка/.test(t)) return "skirts";
  if (/dress|gown|платье/.test(t)) return "dresses";
  if (/jumpsuit|overall|комбинезон/.test(t)) return "jumpsuits";
  if (/swimwear|bikini|купальник/.test(t)) return "swimwear";
  if (/sneaker|trainer|boot|shoe|sandal|loafer|pump|slipper|кроссовки|ботинки|туфли/.test(t)) return "footwear";
  if (/bag|backpack|tote|clutch|сумка|рюкзак/.test(t)) return "bags";
  return "accessories";
}

function inferGender(val: string): Gender | undefined {
  const t = val.toLowerCase().trim();
  if (/^(women|woman|female|femme|w|f|женщ|женский)/.test(t)) return "women";
  if (/^(men|man|male|homme|m|мужч|мужской)/.test(t)) return "men";
  if (/unisex/.test(t)) return "unisex";
  return undefined;
}

// ── Simple CSV parser (handles quoted fields) ─────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
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

  // Find first non-empty line as header
  let headerLine = 0;
  while (headerLine < lines.length && !lines[headerLine].trim()) headerLine++;
  if (headerLine >= lines.length) return { headers: [], rows: [] };

  const headers = parseRow(lines[headerLine]);
  const dataRows: Record<string, string>[] = [];

  for (let i = headerLine + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    dataRows.push(row);
  }

  return { headers, rows: dataRows };
}

// ── Column name resolver ──────────────────────────────────────────────────────

function resolve(row: Record<string, string>, ...candidates: string[]): string {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const found = keys.find((k) => k.toLowerCase().trim() === c.toLowerCase());
    if (found !== undefined) return (row[found] ?? "").trim();
  }
  return "";
}

// ── Map one CSV row to our schema ─────────────────────────────────────────────

function mapCSVRow(row: Record<string, string>): CSVMappedRow {
  const issues: string[] = [];

  const name = resolve(row, "name", "product_name", "title", "product", "название", "наименование");
  if (!name) issues.push("missing name");

  const brand = resolve(row, "brand", "brand_name", "merchant_name", "manufacturer", "бренд", "марка");

  // Awin feed uses search_price / store_price; generic feeds use price
  const priceRaw = resolve(row, "search_price", "store_price", "display_price", "base_price", "price", "цена", "стоимость");
  const price = priceRaw ? parseFloat(priceRaw.replace(/[^\d.,]/g, "").replace(",", ".")) : 0;
  if (!price) issues.push("missing price");

  const currency = resolve(row, "currency", "валюта") || "GBP";

  // Awin feed: merchant_image_url, aw_image_url, large_image; generic: image_url / image / photo
  const imageUrl = resolve(row,
    "large_image", "merchant_image_url", "aw_image_url", "merchant_thumb_url", "aw_thumb_url",
    "image_url", "image", "photo", "img", "picture", "фото", "изображение",
  );

  // Awin feed: aw_deep_link (affiliate link), merchant_deep_link (direct)
  const referralUrl = resolve(
    row,
    "aw_deep_link", "merchant_deep_link",
    "referral_url", "affiliate_url", "affiliate_link", "referral_link",
    "url", "link", "product_url", "ссылка", "реферальная_ссылка",
  );

  // Awin feed: category_name, merchant_category
  const categoryRaw = resolve(row, "category_name", "merchant_category", "merchant_product_category_path", "category", "product_type", "категория");
  const category: Category = categoryRaw
    ? (inferCategory(categoryRaw) || inferCategory(name))
    : inferCategory(name);

  const genderRaw = resolve(row, "gender", "sex", "пол");
  const gender = inferGender(genderRaw);

  const colorRaw = resolve(row, "color", "colour", "цвет");
  const colors = colorRaw ? [colorRaw] : [];

  const material = resolve(row, "material", "composition", "fabric", "материал", "состав");
  const description = resolve(row, "description", "desc", "описание");

  return {
    name,
    brand,
    category,
    gender,
    price,
    currency,
    imageUrl,
    referralUrl,
    colors,
    material,
    description,
    _valid: issues.length === 0,
    _issues: issues,
  };
}

// ── POST /api/admin/csv-import — parse & preview ──────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const text = await req.text().catch(() => "");
  if (!text.trim()) return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });

  const { headers, rows: csvRows } = parseCSV(text);
  if (!headers.length) return NextResponse.json({ error: "Could not parse CSV headers" }, { status: 400 });

  const rows = csvRows.map(mapCSVRow);
  return NextResponse.json({ columns: headers, rows });
}

// ── PUT /api/admin/csv-import — import selected rows ─────────────────────────

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
        brand: row.brand as Product["brand"],
        category: row.category,
        description: row.description || "",
        imageUrl: row.imageUrl,
        images: row.imageUrl ? [row.imageUrl] : [],
        colors: row.colors,
        sizes: [],
        material: row.material,
        priceMin: row.price,
        priceMax: row.price,
        currency: row.currency,
        isNew: true,
        isSaved: false,
        gender: row.gender,
        styleKeywords: [],
        retailers: row.referralUrl
          ? [
              {
                name: row.brand || "Store",
                url: row.referralUrl,
                price: row.price,
                currency: row.currency,
                availability: "in stock",
                isOfficial: true,
              },
            ]
          : [],
      };

      const dbRow = {
        ...productToDb(product),
        source_url: row.referralUrl || null,
      };

      if (row.referralUrl) {
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("source_url", row.referralUrl)
          .maybeSingle();

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
