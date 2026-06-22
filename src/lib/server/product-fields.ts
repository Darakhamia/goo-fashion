/**
 * Shared, pure field-normalisation helpers for product ingestion.
 *
 * These are used by BOTH the CSV affiliate-feed importer
 * (`/api/admin/csv-import`) and the universal URL parser
 * (`/api/admin/parser/*`). Keep them dependency-free and side-effect-free so
 * they can run in any serverless route.
 */
import type { Category, Gender } from "@/lib/types";

// ── Strip trailing size suffix from a product name ────────────────────────────
// Affiliate names often look like "Polo Shirt - Blue - M" → strip " - M".

const SIZE_SUFFIXES =
  /\s+-\s+(one\s*size|one|os|xxs|xs|s|m|l|xl|xxl|2xl|3xl|4xl|\d{1,3}(?:\.\d)?)$/i;

export function cleanName(raw: string): string {
  return (raw ?? "").replace(SIZE_SUFFIXES, "").trim();
}

// ── Strip trailing color suffix from a size-cleaned name ──────────────────────
// "Polo Shirt - Blue" → "Polo Shirt". Used for variant grouping.

export function getBaseProductName(sizeCleanedName: string): string {
  return (sizeCleanedName ?? "").replace(/\s+-\s+[\w/]+$/, "").trim();
}

// ── Parse price handling "49.99", European "49,99", thousands-sep "1.267" ─────

export function parsePrice(raw: string): number {
  if (!raw) return 0;
  const stripped = String(raw).replace(/[^\d.,]/g, "");
  if (!stripped) return 0;
  const lastComma = stripped.lastIndexOf(",");
  const lastDot = stripped.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    // European decimal: "1.234,99" → "1234.99"
    normalized = stripped.replace(/\./g, "").replace(",", ".");
  } else {
    // European thousands separator: "1.267" (exactly 3 digits after a single dot)
    const thousandsSep = /^(\d{1,3})\.(\d{3})$/.test(stripped);
    normalized = thousandsSep ? stripped.replace(/\./g, "") : stripped.replace(/,/g, "");
  }
  const val = parseFloat(normalized) || 0;
  // Sanity check: prices above 500,000 are scraper artifacts
  return val > 500_000 ? 0 : val;
}

// ── Extract ISO currency code from a display price string ─────────────────────
// Handles: "£49.99", "GBP89.00", "€39,00", "USD 29.99"

export function extractCurrencyFromDisplay(raw: string): string {
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

// ── Retail category path → { category, gender } ───────────────────────────────
// Works for AWIN `category_name`, Farfetch breadcrumbs, generic category strings.

export function parseRetailCategory(raw: string): { category: Category; gender?: Gender } {
  const t = (raw ?? "").toLowerCase();

  let gender: Gender | undefined;
  if (/^(women|girls|ladies|femme|woman)/.test(t)) gender = "women";
  else if (/^(men|boys|homme|man\b)/.test(t)) gender = "men";
  else if (/unisex/.test(t)) gender = "unisex";

  let category: Category = "accessories";
  if (/trouser|pant(?!y)/.test(t))                                     category = "bottoms";
  else if (/footwear|shoe|boot|trainer|sneaker|sandal|loafer/.test(t)) category = "footwear";
  else if (/\bshirt\b/.test(t))                                        category = "shirts";
  else if (/knitwear|knit|sweater|jumper|cardigan/.test(t))            category = "knitwear";
  else if (/jacket|coat|outerwear|parka|anorak/.test(t))              category = "outerwear";
  else if (/\bshorts?\b/.test(t))                                      category = "shorts";
  else if (/skirt/.test(t))                                            category = "skirts";
  else if (/dress/.test(t))                                            category = "dresses";
  else if (/suit|blazer/.test(t))                                      category = "blazers";
  else if (/t-shirt|top\b|blouse|polo/.test(t))                       category = "tops";
  else if (/jeans|denim/.test(t))                                      category = "jeans";
  else if (/bag|backpack|luggage|handbag/.test(t))                    category = "bags";
  else if (/swim|bikini|beachwear/.test(t))                            category = "swimwear";
  else if (/jumpsuit|playsuit|overall/.test(t))                       category = "jumpsuits";

  return { category, gender };
}

// ── Fallback category from a free-text product name ───────────────────────────

export function inferCategoryFromName(text: string): Category {
  const t = (text ?? "").toLowerCase();
  if (/jacket|coat|parka|anorak|windbreaker|bomber|trench/.test(t)) return "outerwear";
  if (/blazer/.test(t)) return "blazers";
  if (/sweater|knit|cardigan|jumper/.test(t)) return "knitwear";
  if (/hoodie|sweatshirt|pullover|\btop\b|blouse|polo/.test(t)) return "tops";
  if (/\bshirt\b/.test(t)) return "shirts";
  if (/\bjeans?\b|denim(?! jacket)/.test(t)) return "jeans";
  if (/trouser|pant|legging|jogger/.test(t)) return "bottoms";
  if (/\bshorts?\b/.test(t)) return "shorts";
  if (/skirt/.test(t)) return "skirts";
  if (/dress|gown/.test(t)) return "dresses";
  if (/jumpsuit|overall/.test(t)) return "jumpsuits";
  if (/swimwear|bikini/.test(t)) return "swimwear";
  if (/sneaker|trainer|boot|shoe|sandal|loafer|pump/.test(t)) return "footwear";
  if (/\bbag\b|backpack|tote|clutch/.test(t)) return "bags";
  return "accessories";
}

// ── Infer gender from free text (suitable-for field, URL segment, etc.) ───────

export function inferGenderFromText(text: string): Gender | undefined {
  const t = (text ?? "").toLowerCase();
  if (!t) return undefined;
  if (/\bwomen\b|\bwomens\b|female|ladies|\bgirl|femme|\/women\//.test(t)) return "women";
  if (/\bmen\b|\bmens\b|\bmale\b|\bboy|homme|\/men\//.test(t)) return "men";
  if (/unisex/.test(t)) return "unisex";
  return undefined;
}

// ── Map color name → hex for variant swatches ─────────────────────────────────

export const COLOR_HEX: Record<string, string> = {
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

export function colorToHex(colorName: string): string {
  const key = (colorName ?? "").toLowerCase().trim();
  return COLOR_HEX[key] ?? "#888888";
}

// ── Resolve the *store* name a product is sold at from its source URL ─────────
// The store is where you buy it (e.g. a Farfetch link → "Farfetch"), which is
// NOT the same as the brand. Affiliate feeds sometimes omit a merchant column,
// and falling back to the brand makes the "Where to buy" row show the brand as
// if it were the store — so we derive the store from the link host instead.

// Pretty display names for common multi-brand retailers, so the resolved store
// name matches the admin store library (and its logo) rather than a raw domain.
const KNOWN_STORES: Record<string, string> = {
  farfetch: "Farfetch",
  ssense: "SSENSE",
  mrporter: "Mr Porter",
  "net-a-porter": "Net-A-Porter",
  netaporter: "Net-A-Porter",
  endclothing: "END.",
  matchesfashion: "Matches",
  mytheresa: "Mytheresa",
  nordstrom: "Nordstrom",
  selfridges: "Selfridges",
  zalando: "Zalando",
  asos: "ASOS",
};

// Affiliate-network tracker domains: a link host here is a redirect, not the
// actual store, so we can't name the store from it — fall back to the caller's
// fallback instead of showing e.g. "Awin1".
const AFFILIATE_TRACKERS = new Set([
  "awin1", "productserve", "prf", "zenaps", "webgains", "tradedoubler",
  "linksynergy", "go", "click", "redirectingat", "dpbolvw", "anrdoezrs",
  "jdoqocy", "kqzyfj", "tkqlhce",
]);

export function storeNameFromUrl(url: string, fallback = ""): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const root = (host.split(".").slice(-2, -1)[0] ?? host).toLowerCase();
    if (!root || AFFILIATE_TRACKERS.has(root)) return fallback || "Store";
    if (KNOWN_STORES[root]) return KNOWN_STORES[root];
    return root.charAt(0).toUpperCase() + root.slice(1);
  } catch {
    return fallback || "Store";
  }
}

// True only when the source link is the brand's own website (host contains the
// brand slug), e.g. versace.com for Versace — never a multi-brand marketplace.
export function isOfficialStore(url: string, brand: string): boolean {
  const b = (brand ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (b.length < 3) return false;
  try {
    const host = new URL(url).hostname
      .replace(/^www\./, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    return host.includes(b);
  } catch {
    return false;
  }
}

// ── Request a higher-resolution variant of a product image URL ─────────────────
// Many CDNs encode the width in the URL. og:image / JSON-LD thumbnails are often
// small; bumping the obvious size token to ~1000px yields a sharper catalog image.
// Heuristic and reversible — the admin can always edit the URL in the preview.

const MIN_WIDTH = 1000;

export function upscaleImageUrl(url: string): string {
  if (!url || !/^https?:\/\//.test(url)) return url;
  let out = url;

  // Width-style query params: ?w=300, &width=200, &sw=150, &imwidth=250, &wid=…
  // (sw/dw = Salesforce/Demandware, wid = Adobe Scene7, imwidth = Farfetch)
  out = out.replace(
    /([?&](?:w|width|sw|dw|wid|imwidth|mw|maxwidth|fit-width)=)(\d{2,4})\b/gi,
    (_m, prefix: string, n: string) => prefix + Math.max(Number(n), MIN_WIDTH),
  );

  // Height-style query params (sh/dh = Demandware, hei = Scene7). Bumped in
  // lock-step with width so square-cropped CDNs don't return a tiny image.
  out = out.replace(
    /([?&](?:h|height|sh|dh|hei|imheight|mh|maxheight|fit-height)=)(\d{2,4})\b/gi,
    (_m, prefix: string, n: string) => prefix + Math.max(Number(n), MIN_WIDTH),
  );

  // Cloudinary / imgix-style transform tokens in the path: .../w_100,h_100/...
  // or .../w_100/... — bump any width/height token that's below the target.
  out = out.replace(
    /([,/](?:w|h)_)(\d{2,4})\b/gi,
    (m, prefix: string, n: string) => (Number(n) < MIN_WIDTH ? prefix + MIN_WIDTH : m),
  );

  // Path-segment dimensions: .../300x400/..., .../300x/... (Thumbor, many shops).
  out = out.replace(
    /\/(\d{2,4})x(\d{0,4})\//g,
    (m, w: string, h: string) =>
      Number(w) < MIN_WIDTH ? `/${MIN_WIDTH}x${h ? MIN_WIDTH : ""}/` : m,
  );

  // Shopify-style numeric size suffix before the extension: _100x.jpg,
  // _100x100.jpg, _100x150_crop_center.jpg → request the large variant.
  out = out.replace(
    /_(\d{2,4})x(\d{0,4})((?:_[a-z_]+)?\.(?:jpg|jpeg|png|webp|avif))(?=$|\?)/i,
    (m, w: string, h: string, tail: string) =>
      Number(w) < MIN_WIDTH ? `_${MIN_WIDTH}x${h ? MIN_WIDTH : ""}${tail}` : m,
  );

  // Named size suffixes (Shopify presets + common thumbnail tokens):
  // _small.jpg, _medium.jpg, _large.jpg, _grande.jpg, _thumb.jpg, _tiny.jpg…
  out = out.replace(
    /_(pico|icon|thumb|thumbnail|tiny|mini|small|compact|medium|large|grande|preview)(\.(?:jpg|jpeg|png|webp|avif))(?=$|\?)/i,
    (_m, _size: string, ext: string) => `_${MIN_WIDTH}x${ext}`,
  );

  // Farfetch CDN encodes width as a trailing _NNN before the extension.
  if (/farfetch/i.test(out)) {
    out = out.replace(
      /_(\d{2,4})\.(jpg|jpeg|png|webp)(?=$|\?)/i,
      (m, n: string, ext: string) => (Number(n) < MIN_WIDTH ? `_${MIN_WIDTH}.${ext}` : m),
    );
  }

  // AWIN / productserve proxy uses w=/h= params (kept square).
  if (/productserve\.com|awin1\.com/i.test(out)) {
    out = out.replace(/([?&]w=)\d+/i, `$1${MIN_WIDTH}`).replace(/([?&]h=)\d+/i, `$1${MIN_WIDTH}`);
  }

  return out;
}
