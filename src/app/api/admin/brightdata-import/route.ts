import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { productToDb } from "@/lib/data/db";
import type { Product, Category, Gender } from "@/lib/types";

// ── Category inference (Spanish product names from BrightData) ────────────────

function inferCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/chaqueta|abrigo|parka|anorak|cortaviento|bomber|trench|capa\b/.test(t)) return "outerwear";
  if (/blazer/.test(t)) return "blazers";
  if (/jersey|punto|cárdigan|cardigan|\bknit\b/.test(t)) return "knitwear";
  if (/sudadera|hoodie|sweatshirt|crewneck|pullover|polar|camiseta|blusa|polo|top\b/.test(t)) return "tops";
  if (/\bcamisa\b/.test(t)) return "shirts";
  if (/\bvaqueros?\b|\bjeans?\b|denim(?! jacket)/.test(t)) return "jeans";
  if (/pantalon|pantalón|chino|legging|jogging/.test(t)) return "bottoms";
  if (/\bshort\b|\bcorto\b/.test(t)) return "shorts";
  if (/\bfalda\b/.test(t)) return "skirts";
  if (/\bvestido\b|\bgown\b/.test(t)) return "dresses";
  if (/mono\b|jumpsuit|overall/.test(t)) return "jumpsuits";
  if (/traje baño|bañador|bikini|swimwear/.test(t)) return "swimwear";
  if (/zapatilla|deportiva|bota|zapato|sandalia|mocasín|loafer|sneaker|trainer|runner|slide|mule|tacón|pump|slipper|derby|oxford/.test(t)) return "footwear";
  if (/\bbolso\b|\bbolsa\b|mochila|tote|clutch|cartera|monedero|satchel/.test(t)) return "bags";
  return "accessories";
}

function inferGenderFromUrl(url: string): Gender | undefined {
  const t = url.toLowerCase();
  if (/\/women\/|\/mujer\//.test(t)) return "women";
  if (/\/men\/|\/hombre\//.test(t)) return "men";
  return undefined;
}

// ── Upgrade 300px Farfetch thumbnails to 1000px ───────────────────────────────

function upgrade300(url: string): string {
  return url.replace(/_300\.jpg/, "_1000.jpg");
}

// ── BrightData record shape ───────────────────────────────────────────────────

interface BDPrice {
  value?: number | string;
  currency?: string;
  symbol?: string;
}

interface BDRecord {
  // Error records
  error?: string;
  // Product fields
  product_name?: string;
  brand?: string;
  price?: BDPrice;
  product_features?: string[];
  farfetch_id?: string | number;
  brand_id?: string;
  composition?: string;
  care_instructions?: string;
  product_images?: string[];
  main_image?: string;
  input?: { url?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface BDMappedRow {
  name: string;
  brand: string;
  category: Category;
  gender?: Gender;
  price: number;
  currency: string;
  imageUrl: string;
  images: string[];
  colors: string[];
  material: string;
  sourceUrl: string;
  farfetchId: string;
  // validation
  _valid: boolean;
  _issues: string[];
}

// ── Map one BrightData record to our schema ───────────────────────────────────

export function mapBDRecord(rec: BDRecord): BDMappedRow {
  const issues: string[] = [];

  if (rec.error) {
    return {
      name: "", brand: "", category: "accessories", price: 0, currency: "EUR",
      imageUrl: "", images: [], colors: [], material: "", sourceUrl: "", farfetchId: "",
      _valid: false, _issues: [`BrightData error: ${rec.error}`],
    };
  }

  const name = (rec.product_name ?? "").trim();
  if (!name) issues.push("missing product_name");

  const brand = (rec.brand ?? "").trim();
  if (!brand) issues.push("missing brand");

  // Price: BrightData sometimes uses "." as thousands separator (e.g. 1.373 = 1373 EUR)
  let price = 0;
  let currency = "EUR";
  if (rec.price?.value !== undefined && rec.price.value !== null && rec.price.value !== "") {
    const raw = Number(rec.price.value);
    // Heuristic: if value < 10 but looks like hundreds (e.g. 1.373), multiply by 1000
    // More reliably: if decimal part has exactly 3 digits, treat dot as thousands separator
    const str = String(rec.price.value);
    const dotIdx = str.indexOf(".");
    if (dotIdx !== -1 && str.length - dotIdx - 1 === 3) {
      price = raw * 1000;
    } else {
      price = raw;
    }
    currency = (rec.price.currency ?? "EUR").trim();
  } else {
    issues.push("missing price");
  }

  const farfetchId = String(rec.farfetch_id ?? "").trim();
  if (!farfetchId) issues.push("missing farfetch_id");

  const gender = inferGenderFromUrl(rec.input?.url ?? "");
  const category = inferCategory(name);

  // Images: upgrade thumbnails to 1000px
  const rawImages: string[] = (rec.product_images ?? []).map(upgrade300).filter(Boolean);
  const mainImage = rec.main_image ? upgrade300(rec.main_image) : rawImages[0] ?? "";

  // De-dupe: mainImage first, then the rest
  const seen = new Set<string>();
  const images: string[] = [];
  for (const img of [mainImage, ...rawImages]) {
    if (img && !seen.has(img)) { seen.add(img); images.push(img); }
  }

  // Color: first product_feature is usually the color name
  const colors: string[] = [];
  if (rec.product_features?.length) {
    colors.push(rec.product_features[0]);
  }

  const material = (rec.composition ?? "").trim();

  const sourceUrl = farfetchId
    ? `https://www.farfetch.com/shopping/${gender ?? "men"}/item-${farfetchId}.aspx`
    : "";

  return {
    name,
    brand,
    category,
    gender,
    price,
    currency,
    imageUrl: mainImage,
    images,
    colors,
    material,
    sourceUrl,
    farfetchId,
    _valid: issues.length === 0,
    _issues: issues,
  };
}

// ── POST /api/admin/brightdata-import ────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);

  // preview=true: just parse and return mapped rows without inserting
  const preview: boolean = body?.preview === true;
  const rawRecords: BDRecord[] = Array.isArray(body?.records) ? body.records : [];

  if (!rawRecords.length) {
    return NextResponse.json({ error: "records array is required" }, { status: 400 });
  }

  const mapped = rawRecords.map(mapBDRecord);

  if (preview) {
    return NextResponse.json({ rows: mapped });
  }

  // Import selected rows (indices passed by client, or all valid if not specified)
  const indices: number[] | null = Array.isArray(body?.indices) ? body.indices : null;
  const toImport = indices
    ? indices.map((i: number) => mapped[i]).filter(Boolean)
    : mapped.filter((r) => r._valid);

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
        description: "",
        imageUrl: row.imageUrl,
        images: row.images,
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
        retailers: [
          {
            name: "Farfetch",
            url: row.sourceUrl,
            price: row.price,
            currency: row.currency,
            availability: "in stock",
            isOfficial: true,
          },
        ],
      };

      const dbRow = {
        ...productToDb(product),
        source_url: row.sourceUrl,
      };

      // Upsert by source_url to avoid duplicates
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("source_url", row.sourceUrl)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("products").update(dbRow).eq("id", existing.id);
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
