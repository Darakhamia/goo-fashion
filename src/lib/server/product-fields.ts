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

// ── Shared category keyword table ─────────────────────────────────────────────
// One ordered rule list, used by BOTH retail-category parsing and product-name
// inference, so a garment is classified the same way whichever field it comes
// from. Rules are ordered **specific → general**: the first match wins, so
// compound terms resolve correctly ("dress shirt" → shirts before dresses,
// "swimsuit" → swimwear before the generic "suit" → blazers, "sweater vest" →
// knitwear before the generic vest → tops, "denim shirt" → shirts before jeans).
// Word boundaries (\b) keep e.g. "bootcut jeans" out of footwear and
// "laptop bag" out of tops. `matchCategory` returns null when nothing matches so
// callers can fall back to another signal instead of silently defaulting to the
// "accessories" junk drawer.
const CATEGORY_RULES: ReadonlyArray<readonly [RegExp, Category]> = [
  // Compound trap: a "dress shirt" is a shirt, not a dress.
  [/\bdress\s*shirt\b/, "shirts"],
  // Sneaker / shoe MODEL names that carry no generic garment word (e.g.
  // "Air Max 90", "Adidas Samba", "Nike Dunk"). Placed high so a model name wins
  // — including "Nike Blazer", which would otherwise read as the tailoring
  // "blazer". Brand names alone are intentionally excluded (brands also make
  // apparel: a "Vans tee" must stay a top).
  [/\b(air\s*max|air\s*force|af1|air\s*jordan|jordan\s*\d|nike\s*blazer|\bdunk\b|cortez|vapormax|pegasus|samba|gazelle|superstar|stan\s*smith|ozweego|adilette|ultra\s?boost|nmd|yeezy\s*(?:boost|slide|foam|\d)|new\s*balance\s*\d+|chuck\s*taylor|sk8-?hi|old\s*skool|birkenstock|crocs|uggs?)\b/, "footwear"],
  // Footwear is high-priority so a shoe word beats garment words elsewhere in the
  // name — "Bermuda Shoes" / "Denim Loafers" read as footwear, not shorts/jeans.
  // "boot" is guarded against "boot cut" (jeans); "shoe" against "shoe bag/box".
  [/\b(footwear|shoes?(?!\s*(?:bag|box|tree|horn|care|lace|rack))|boots?(?!\s*-?cut)|trainers?|sneakers?|sandals?|slides?|sliders?|loafers?|heels?|pumps?|espadrilles?|mules?|brogues?|derbys?|plimsolls?|hi-?tops?|high-?tops?|low-?tops?|slippers?|flip-?flops?|clogs?|moccasins?)\b/, "footwear"],
  // Shorts first — "swim/swimming/board/beach shorts" should read as shorts, not
  // swimwear. Require plural "shorts" (or a qualifier) to avoid "short sleeve".
  [/\b(shorts|bermudas?|(chino|cargo|denim|cycling|running|sweat|board|swim|swimming|beach)\s*shorts?)\b/, "shorts"],
  // True swimwear only (shorts already handled above).
  [/\b(swim(wear|suit|ming)?|bikini|beachwear|trunks|rash\s*guard)\b/, "swimwear"],
  // One-piece sets (before the generic "suit").
  [/\b(jumpsuit|playsuit|dungarees?|overalls?|boilersuit|catsuit|romper|onesie)\b/, "jumpsuits"],
  // Outerwear, incl. sleeveless outer layers (gilet / puffer vest).
  [/\b(jacket|coat|outerwear|parka|anorak|windbreaker|bomber|trench|puffer|raincoat|overcoat|peacoat|mackintosh|poncho|cape|gilet|(puffer|padded|quilted|down|shell)\s*vest)\b/, "outerwear"],
  // Tailoring / suiting. Bare "suit" is included but \b keeps it from matching
  // swimsuit / jumpsuit / tracksuit / bodysuit (all handled by earlier rules) and
  // from matching the verb "suits"/"suited".
  [/\b(blazer|waistcoat|tuxedo|suit)\b/, "blazers"],
  // Knitwear (before generic tops; catches sweater / knit vests too).
  [/\b(knitwear|knit|sweater|jumper|cardigan|turtleneck|rollneck|roll\s*neck|polo\s*neck|funnel\s*neck|pullover|(sweater|knit)\s*vest)\b/, "knitwear"],
  [/\b(skirt|kilt)\b/, "skirts"],
  [/\b(dress|gown|frock|sundress|kaftan|caftan)\b/, "dresses"],
  // Tees / tanks (before the generic "shirt", so "t-shirt" → tops not shirts).
  [/\b(t[-\s]?shirt|tee|tank(\s*top)?|camisole|cami|singlet|crop\s*top|vest\s*top)\b/, "tops"],
  [/\b(shirt|overshirt|shacket|oxford|flannel|chambray)\b/, "shirts"],
  // Remaining upper-body pieces.
  [/\b(hoodie|sweatshirt|blouse|polo|bodysuit|tunic|bralette|\btop\b|vest)\b/, "tops"],
  // Crewnecks described only as "crew" (e.g. "long-sleeve crew"); never "crew socks".
  [/\bcrew(?:neck)?\b(?!\s*socks?)|\bcrew[-\s]neck\b/, "tops"],
  [/\b(jeans?|denim)\b(?!\s*jacket)/, "jeans"],
  [/\b(trousers?|pants?(?!y)|chinos?|leggings?|joggers?|sweatpants?|tracksuit|culottes?|slacks)\b/, "bottoms"],
  [/\b(bag|backpack|rucksack|handbag|tote|clutch|satchel|holdall|luggage|suitcase|briefcase|crossbody|messenger\s*bag|duffel|pouch)\b/, "bags"],
  // Explicit accessories (so ties/belts/hats are matched, not just left to fall through).
  [/\b(belt|tie|bow\s*tie|scarf|scarves|hats?|caps?|beanie|gloves?|mittens?|socks?|sunglasses|jewellery|jewelry|necklace|bracelet|earrings?|watch|wallet|cardholder|purse|umbrella|keyring|headband|bandana|cufflinks?|suspenders?|braces)\b/, "accessories"],
];

// Russian-language keywords. Much of the catalog is named/described in Russian,
// which the English table above can't read. Cyrillic word boundaries aren't
// handled by \b, so these are plain stem substrings (matched on lowercased
// text), ordered specific → general and consulted ONLY when the English pass
// finds nothing — so they never override an English match. "шорт" is checked
// before swim/"купальн" so "купальные шорты" reads as shorts, mirroring English.
const CATEGORY_RULES_RU: ReadonlyArray<readonly [RegExp, Category]> = [
  [/шорт/, "shorts"],
  [/купальник|плавк|купальн|бикини/, "swimwear"],
  [/комбинезон/, "jumpsuits"],
  [/куртк|пальто|плащ|парк|пухов|ветровк|бомбер|тренч|дублёнк|дубленк|шуба|шубы|анорак|пончо|накидк/, "outerwear"],
  [/пиджак|блейзер|смокинг|жакет/, "blazers"],
  [/кофт|свитер|джемпер|кардиган|водолазк|пуловер/, "knitwear"],
  [/юбк/, "skirts"],
  [/плать|сарафан/, "dresses"],
  [/футболк|майк|блузк|худи|свитшот|толстовк|кроп.?топ/, "tops"],
  [/рубашк|сорочк/, "shirts"],
  [/джинс|деним/, "jeans"],
  [/брюк|штан|легинс|лосин|джоггер|чинос/, "bottoms"],
  [/обувь|ботинк|кроссовк|кросс|кеды|туфл|сапог|сандал|лофер|босонож|мокасин|балетк|слайд|\bугг/, "footwear"],
  [/сумк|рюкзак|клатч|портфель|чемодан|барсетк/, "bags"],
  [/ремень|ремни|галстук|шарф|платок|платк|шапк|кепк|берет|перчатк|варежк|носк|носок|очки|часы|кошел|бабочк|запонк|подтяжк|ободок/, "accessories"],
];

/** First matching category for a free-text string, or null if none matched. */
export function matchCategory(text: string): Category | null {
  const t = (text ?? "").toLowerCase();
  if (!t) return null;
  for (const [re, cat] of CATEGORY_RULES) if (re.test(t)) return cat;
  // Fall back to Russian keywords only when the English table matched nothing.
  for (const [re, cat] of CATEGORY_RULES_RU) if (re.test(t)) return cat;
  return null;
}

// ── Retail category path → { category, gender } ───────────────────────────────
// Works for AWIN `category_name`, Farfetch breadcrumbs, generic category strings.

export function parseRetailCategory(raw: string): { category: Category; gender?: Gender } {
  const t = (raw ?? "").toLowerCase();

  let gender: Gender | undefined;
  if (/^(women|girls|ladies|femme|woman)/.test(t)) gender = "women";
  else if (/^(men|boys|homme|man\b)/.test(t)) gender = "men";
  else if (/unisex/.test(t)) gender = "unisex";

  return { category: matchCategory(t) ?? "accessories", gender };
}

// ── Fallback category from a free-text product name ───────────────────────────

export function inferCategoryFromName(text: string): Category {
  return matchCategory(text) ?? "accessories";
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
// `upscaleImageUrl` now lives in `@/lib/image` so it can run client-side inside
// the image component, where a failed rewrite can fall back to the original URL.
export { upscaleImageUrl } from "@/lib/image";
