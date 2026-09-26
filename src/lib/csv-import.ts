/**
 * Affiliate-feed CSV import (Awin, the Farfetch scraper's export): reading the
 * file and grouping its rows into products.
 *
 * This runs in the browser. A feed is routinely tens of megabytes — more than a
 * serverless function accepts in one request body — and reading it needs no
 * database, so only the grouped products travel to `/api/admin/csv-import`, a
 * batch at a time, where they are written through the parser's own pipeline
 * (`importParsedProduct`). The types here are shared with that route.
 */
import {
  cleanName,
  colorWordsIn,
  extractCurrencyFromDisplay,
  getBaseProductName,
  matchCategory,
  normalizeGtin,
  parsePrice,
  parseRetailCategory,
  storeNameFromUrl,
} from "@/lib/server/product-fields";
import type { Category, Gender } from "@/lib/types";

export interface CSVMappedRow {
  name: string;
  brand: string;
  merchant: string;
  category: Category;
  gender?: Gender;
  price: number;
  priceOriginal: number;
  currency: string;
  imageUrl: string;
  images: string[];
  referralUrl: string;
  colors: string[];
  sizes: string[];
  material: string;
  description: string;
  /** The item's GTIN (EAN/UPC) when the feed prints a valid one — how another store's row of it is recognised. */
  gtin?: string;
  /** The feed marks it out of stock: never created, but it updates a product we already carry. */
  soldOut: boolean;
  _valid: boolean;
  _issues: string[];
}

export interface MerchantSummary {
  name: string;
  count: number;
  validCount: number;
}

/** One product to write: the feed rows of one piece in one colour. */
export interface CSVImportGroup {
  /** The card's name — the base name when the piece comes in several colours. */
  name: string;
  rows: CSVMappedRow[];
  /** Feed links of the piece's other colours, so the import can group the swatches. */
  siblingUrls: string[];
}

/** Products per import request: each goes through photo mirroring and a duplicate search. */
export const IMPORT_BATCH_GROUPS = 10;
/** The route's ceiling on products per request. */
export const MAX_IMPORT_GROUPS = 25;
/** Links per "which of these do we already have" request. */
export const MAX_CHECK_URLS = 200;

// ── Simple CSV parser (handles quoted fields, tab / pipe separator fallback) ──

/**
 * Rows are keyed by the lower-cased, trimmed header, so a column is one lookup
 * rather than a scan of every header — a feed is tens of thousands of rows.
 */
export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

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
  const keys = headers.map((h) => h.toLowerCase().trim());
  const dataRows: Record<string, string>[] = [];

  for (let i = headerLine + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseRow(lines[i]);
    const row: Record<string, string> = {};
    // Two headers that differ only in case: the first one with a value wins.
    keys.forEach((k, idx) => { if (!row[k]) row[k] = vals[idx] ?? ""; });
    dataRows.push(row);
  }

  return { headers, rows: dataRows };
}

// ── Column resolver ───────────────────────────────────────────────────────────

/**
 * The first of these columns that has a value. An empty column falls through
 * to the next candidate: a feed that carries a `colour` header but leaves it
 * blank has not said the colour, and stopping there hid every later source.
 */
function resolve(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    const value = (row[c.toLowerCase()] ?? "").trim();
    if (value) return value;
  }
  return "";
}

// ── Boost AWIN proxy image resolution (200→800px) ────────────────────────────

function boostAwinkImageUrl(url: string): string {
  if (!url.includes("productserve.com") && !url.includes("awin1.com")) return url;
  return url.replace(/w=\d+/, "w=800").replace(/h=\d+/, "h=800");
}

// ── Parse JSON array field safely ─────────────────────────────────────────────

function parseJsonArray(raw: string): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[")) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch { /* ignore */ }
  return [];
}

// ── Collect all non-empty image URLs preserving quality order ─────────────────

function collectImages(row: Record<string, string>): string[] {
  const awImage = boostAwinkImageUrl(resolve(row, "aw_image_url"));
  const awThumb = boostAwinkImageUrl(resolve(row, "aw_thumb_url"));

  // Farfetch format: main_image + all_images JSON array
  const mainImage = resolve(row, "main_image");
  const allImagesParsed = parseJsonArray(resolve(row, "all_images"));

  const candidates = [
    mainImage,
    awImage,
    ...allImagesParsed,
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

// ── The colour a name carries after its base ──────────────────────────────────
// Awin names: "Polo Shirt - Blue - M" → size stripped → "Polo Shirt - Blue" →
// base "Polo Shirt", colour "Blue".

function nameVariantSuffix(name: string): string {
  const base = getBaseProductName(name);
  return base.length < name.length ? name.slice(base.length).replace(/^\s*-\s*/, "").trim() : "";
}

// ── Map one raw CSV row → CSVMappedRow ────────────────────────────────────────

export function mapCSVRow(row: Record<string, string>): CSVMappedRow {
  const issues: string[] = [];

  const rawName = resolve(row, "product_name", "name", "title", "product", "название");
  const name = cleanName(rawName);
  if (!name) issues.push("missing name");

  // Store/merchant: ONLY real store columns — never the brand. Feeds that omit
  // a merchant column (e.g. the Farfetch scraper) get their store derived from
  // the affiliate link host below, so "Where to buy" shows the store, not the
  // brand (which previously made rows read e.g. "Supreme" instead of "Farfetch").
  const merchantColumn = resolve(row, "merchant_name", "merchant", "advertiser", "program_name", "programmename");
  const brand = resolve(row, "brand_name", "brand", "manufacturer");

  // Farfetch: extract brand from available_sizes when brand column is empty
  // Sizes look like ["Brand Name | M", "Brand Name | S"]
  const brandFallback = brand || (() => {
    const first = parseJsonArray(resolve(row, "available_sizes"))[0] ?? "";
    const pipe = first.indexOf("|");
    return pipe > 0 ? first.slice(0, pipe).trim() : "";
  })();

  // Price: Farfetch uses current_price; AWIN uses search_price
  const priceRaw = resolve(row, "current_price", "search_price", "store_price", "display_price", "base_price", "price", "цена");
  const price = parsePrice(priceRaw);
  if (!price) issues.push("missing price");

  // RRP / original price for discount display
  const priceOriginal = parsePrice(resolve(row, "rrp_price", "product_price_old", "base_price"));

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

  // Affiliate link: AWIN uses aw_deep_link; Farfetch scraper provides product_url
  const referralUrl = resolve(row, "aw_deep_link", "product_url");
  // It becomes a shopper's "Buy" link, so only a web address will do.
  if (!/^https?:\/\//.test(referralUrl)) issues.push(referralUrl ? "bad affiliate link" : "no affiliate link");

  // Final store name: the merchant column when present, otherwise derived from
  // the link host (the brand is intentionally NOT used as a fallback here).
  const merchant = merchantColumn || storeNameFromUrl(referralUrl, "");

  // In-stock check
  const inStockRaw = resolve(row, "in_stock", "stock_status", "is_for_sale");
  const soldOut = inStockRaw === "0" || /sold.?out|out.?of.?stock/i.test(inStockRaw);
  if (soldOut) issues.push("out of stock");

  // Category + gender: Awin category_name → merchant_category → path
  const categoryRaw = resolve(row,
    "category_name", "merchant_category",
    "merchant_product_category_path", "product_type", "category",
  );
  // Take gender from the feed's category path, but resolve the category from the
  // strongest available signal: the feed category, then the product name, then
  // the fashion_type hint. This stops an uninformative feed category (e.g.
  // "New In", "SS24 Sale") from dumping an otherwise-recognisable garment into
  // "accessories" — the name is tried before we give up.
  const fashionTypeHint = resolve(row, "fashion_type", "fashion:category");
  let gender: Gender | undefined = categoryRaw ? parseRetailCategory(categoryRaw).gender : undefined;
  const category: Category =
    (categoryRaw ? matchCategory(categoryRaw) : null) ??
    matchCategory(name) ??
    matchCategory(fashionTypeHint) ??
    "accessories";

  // Farfetch: infer gender from input_url (e.g. /men/ or /women/)
  const inputUrl = resolve(row, "input_url");
  if (inputUrl && !gender) {
    if (/\/women\//.test(inputUrl)) gender = "women";
    else if (/\/men\//.test(inputUrl)) gender = "men";
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

  // The colour column first. The Farfetch scraper has none and often puts just
  // the colour word in its description — read only when there is no colour
  // column at all, because a feed that has one and left it blank has a real
  // description there, and "Organic cotton polo" is not a colour.
  const hasColourColumn = "colour" in row || "color" in row || "цвет" in row;
  const colorRaw = resolve(row, "colour", "color", "цвет") || (hasColourColumn ? "" : resolve(row, "description"));
  // Skip if description looks like actual text rather than a color word
  const isColorWord = colorRaw && colorRaw.split(/\s+/).length <= 4 && !/[.,]/.test(colorRaw);
  let colors = isColorWord ? [colorRaw] : [];
  // No colour column value: the name's own " - Blue", when it names a colour.
  // Without it two colours of one piece shared a group key and were merged
  // into one card with the first colour's photos.
  if (!colors.length) {
    const suffix = nameVariantSuffix(name);
    if (suffix && colorWordsIn(suffix, "field").length) colors = [suffix];
  }

  // Sizes: Farfetch available_sizes is a JSON array ["Brand | M", "Brand | S"]
  let sizes: string[] = [];
  const jsonSizes = parseJsonArray(resolve(row, "available_sizes"));
  if (jsonSizes.length > 0) {
    sizes = jsonSizes.map((s) => {
      const pipe = s.lastIndexOf("|");
      return pipe >= 0 ? s.slice(pipe + 1).trim() : s.trim();
    }).filter(Boolean);
  } else {
    const fashionSizeRaw = resolve(row, "fashion_size", "fashion:size", "sizes", "size");
    sizes = fashionSizeRaw
      ? fashionSizeRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
      : [];
  }

  // Description: Farfetch description is often just a color word — skip those.
  // Not `keywords`: with the text columns blank, a list of search terms would
  // become the product's description.
  const descRaw = resolve(row, "description", "product_short_description", "desc");
  const description = (descRaw && descRaw.split(/\s+/).length > 4) ? descRaw : "";

  // Material: the material columns first. Awin often puts fabric content in
  // `specifications`, so it is read — but only from a feed with no material
  // column: one that has it and left it blank keeps care notes and fit there.
  const materialColumns = ["fashion:material", "fashion_material", "material", "composition", "fabric"];
  const hasMaterialColumn = materialColumns.some((column) => column in row);
  const material =
    resolve(row, ...materialColumns) || (hasMaterialColumn ? "" : resolve(row, "specifications"));

  // The item's code, when the feed prints one that passes its check digit:
  // what lets a second merchant's row of the same piece join the product
  // rather than become a copy of it.
  const gtin = ["product_gtin", "ean", "gtin", "upc"]
    .map((column) => normalizeGtin(resolve(row, column)))
    .find(Boolean) ?? "";

  return {
    name,
    brand: brandFallback,
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
    ...(gtin ? { gtin } : {}),
    soldOut,
    _valid: issues.length === 0,
    _issues: issues,
  };
}

/** Rows per merchant, busiest first. */
export function summarizeMerchants(rows: CSVMappedRow[]): MerchantSummary[] {
  const merchantMap = new Map<string, { count: number; validCount: number }>();
  for (const row of rows) {
    const m = row.merchant || "Unknown";
    const existing = merchantMap.get(m) ?? { count: 0, validCount: 0 };
    existing.count++;
    if (row._valid) existing.validCount++;
    merchantMap.set(m, existing);
  }
  return Array.from(merchantMap.entries())
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count);
}

/**
 * A row whose only fault is being out of stock. It cannot create a product (a
 * sold-out card is no use to a shopper), but it can tell one we already carry
 * that this store has run out.
 */
export function canRefreshOnly(row: CSVMappedRow): boolean {
  return !row._valid && row.soldOut === true && row._issues.length === 1;
}

// ── Group keys for variant detection ─────────────────────────────────────────
// colorKey  = brand::baseName::color → same product same color (merge sizes + retailers)
// baseKey   = brand::baseName        → same product diff color (link as variants)

export function baseKeyOf(row: CSVMappedRow): string {
  const brand = (row.brand || row.merchant || "").toLowerCase();
  return `${brand}::${getBaseProductName(row.name).toLowerCase()}`;
}

export function colorKeyOf(row: CSVMappedRow): string {
  // The name's suffix stands in for an empty colour even when it is no colour
  // word ("- Organic"): it is what the base name dropped, so it is what tells
  // the two rows apart.
  const color = (row.colors[0] || nameVariantSuffix(row.name)).toLowerCase();
  return `${baseKeyOf(row)}::${color}`;
}

/** The group's feed links, in-stock rows first — the first is the one a new product is keyed by. */
export function groupUrls(rows: CSVMappedRow[]): string[] {
  const ordered = [...rows.filter((r) => !r.soldOut), ...rows.filter((r) => r.soldOut)];
  return [...new Set(ordered.map((r) => r.referralUrl).filter(Boolean))];
}

/**
 * The products these rows make: one per piece and colour, sizes and stores
 * merged. Decided over the whole selection before it is sent in batches, so a
 * piece whose colours land in different batches is still named and grouped as
 * one.
 */
export function buildImportGroups(rows: CSVMappedRow[]): CSVImportGroup[] {
  const byColor = new Map<string, CSVMappedRow[]>();
  const byBase = new Map<string, string[]>();
  for (const row of rows) {
    const colorKey = colorKeyOf(row);
    const list = byColor.get(colorKey);
    if (list) {
      list.push(row);
      continue;
    }
    byColor.set(colorKey, [row]);
    const baseKey = baseKeyOf(row);
    byBase.set(baseKey, [...(byBase.get(baseKey) ?? []), colorKey]);
  }

  const groups: CSVImportGroup[] = [];
  // A piece's colours stay next to each other, so they mostly share a batch.
  for (const colorKeys of byBase.values()) {
    // Only groups that carry a colour are colourways of one piece. A suffix that
    // names none ("Jeans - Slim", "Jeans - Regular") is a different product: it
    // keeps its full name and is not offered as a swatch of the others.
    const coloured = colorKeys.filter((k) => !!byColor.get(k)?.[0]?.colors[0]);
    for (const colorKey of colorKeys) {
      const groupRows = byColor.get(colorKey) ?? [];
      const multi = coloured.length > 1 && coloured.includes(colorKey);
      const siblings = multi
        ? coloured.filter((k) => k !== colorKey).map((k) => groupUrls(byColor.get(k) ?? []))
        : [];
      // Each sibling's own key link first, then the rest of its links.
      const siblingUrls = [
        ...siblings.map((urls) => urls[0]).filter(Boolean),
        ...siblings.flatMap((urls) => urls.slice(1)),
      ].slice(0, 20);
      groups.push({
        // When part of a variant group, the card shows the base name (no colour suffix).
        name: multi ? getBaseProductName(groupRows[0].name) : groupRows[0].name,
        rows: groupRows,
        siblingUrls,
      });
    }
  }
  return groups;
}
