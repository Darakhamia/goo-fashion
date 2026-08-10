/**
 * Universal product-field extraction from raw HTML.
 *
 * Strategy, highest precedence first:
 *   1. Per-site recipe regex rules (admin-defined overrides)
 *   2. JSON-LD  (schema.org Product — Farfetch, SSENSE, most luxury e-comm)
 *   3. OpenGraph / product / twitter meta tags
 *   4. Microdata (itemprop=…)
 *
 * No DOM library — pure regex/JSON parsing so it runs in any serverless route.
 */
import type { ParserSiteConfig, RawExtract, ParserRuleField } from "./types";
import { harvestGalleryImages } from "./gallery";

// ── HTML entity decoding (the handful that show up in product copy) ───────────

export function decodeEntities(input: string): string {
  if (!input) return "";
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&euro;/g, "€")
    .replace(/&pound;/g, "£")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .trim();
}

function stripTags(input: string): string {
  return decodeEntities(
    (input ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s+([.,;:!?])/g, "$1"),
  );
}

// ── Meta tags ─────────────────────────────────────────────────────────────────

type MetaMap = Map<string, string>;

/** Parse every <meta> tag into a { property|name → content } map. */
function parseMetaTags(html: string): MetaMap {
  const map: MetaMap = new Map();
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs: Record<string, string> = {};
    const attrRe = /([a-zA-Z_:][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(tag))) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
    }
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    const content = attrs.content;
    if (key && content && !map.has(key)) map.set(key, content);
  }
  return map;
}

/** All values for a repeatable meta key (e.g. multiple og:image). */
function allMeta(html: string, key: string): string[] {
  const out: string[] = [];
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs: Record<string, string> = {};
    const attrRe = /([a-zA-Z_:][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(tag))) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? "";
    const k = (attrs.property || attrs.name || "").toLowerCase();
    if (k === key.toLowerCase() && attrs.content) out.push(attrs.content);
  }
  return out;
}

// ── JSON-LD ───────────────────────────────────────────────────────────────────

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function parseJsonLdBlocks(html: string): JsonObject[] {
  const blocks: JsonObject[] = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as JsonValue;
      if (Array.isArray(parsed)) parsed.forEach((p) => isObj(p) && blocks.push(p));
      else if (isObj(parsed)) blocks.push(parsed);
    } catch {
      // Some sites embed multiple concatenated objects or trailing commas — skip.
    }
  }
  return blocks;
}

function isObj(v: unknown): v is JsonObject {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function typeIncludes(node: JsonObject, type: string): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t.toLowerCase() === type.toLowerCase();
  if (Array.isArray(t)) return t.some((x) => typeof x === "string" && x.toLowerCase() === type.toLowerCase());
  return false;
}

/**
 * Breadth-first search across blocks (incl. @graph and ItemList) collecting
 * every Product node in document order. ItemList → itemListElement → item is
 * expanded so listing/category pages yield one node per card.
 */
function findAllProductNodes(blocks: JsonObject[]): JsonObject[] {
  const out: JsonObject[] = [];
  const seen = new Set<JsonObject>();
  const queue: JsonObject[] = [...blocks];
  while (queue.length) {
    const node = queue.shift()!;
    if (seen.has(node)) continue;
    seen.add(node);

    if (typeIncludes(node, "Product")) out.push(node);

    // ItemList / ItemPage → itemListElement entries (often { item: Product } or { url })
    const els = node.itemListElement;
    if (Array.isArray(els)) {
      for (const el of els) {
        if (!isObj(el)) continue;
        if (isObj(el.item)) queue.push(el.item);
        else queue.push(el);
      }
    }

    const graph = node["@graph"];
    if (Array.isArray(graph)) graph.forEach((g) => isObj(g) && queue.push(g));
    for (const v of Object.values(node)) {
      if (isObj(v)) queue.push(v);
      else if (Array.isArray(v)) v.forEach((x) => isObj(x) && queue.push(x));
    }
  }
  return out;
}

/**
 * Split Product nodes into the page's own product(s) vs. products that live
 * inside an ItemList (e.g. "you may also like" / "recently viewed" carousels).
 * This lets a product page stay in single-product mode even when it embeds
 * related-product lists — otherwise we'd misread it as a listing.
 */
function partitionProductNodes(blocks: JsonObject[]): { standalone: JsonObject[]; listItems: JsonObject[] } {
  const standalone: JsonObject[] = [];
  const listItems: JsonObject[] = [];
  const seen = new Set<JsonObject>();
  const queue: { node: JsonObject; underList: boolean }[] = blocks.map((b) => ({ node: b, underList: false }));
  while (queue.length) {
    const { node, underList } = queue.shift()!;
    if (seen.has(node)) continue;
    seen.add(node);

    if (typeIncludes(node, "Product")) (underList ? listItems : standalone).push(node);

    const els = node.itemListElement;
    if (Array.isArray(els)) {
      for (const el of els) {
        if (!isObj(el)) continue;
        queue.push({ node: isObj(el.item) ? el.item : el, underList: true });
      }
    }

    const graph = node["@graph"];
    if (Array.isArray(graph)) graph.forEach((g) => isObj(g) && queue.push({ node: g, underList }));
    for (const [k, v] of Object.entries(node)) {
      if (k === "itemListElement") continue;
      if (isObj(v)) queue.push({ node: v, underList });
      else if (Array.isArray(v)) v.forEach((x) => isObj(x) && queue.push({ node: x, underList }));
    }
  }
  return { standalone, listItems };
}

function asString(v: JsonValue | undefined): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  return undefined;
}

/** brand can be a string, { name }, or { @type:"Brand", name }. */
function brandName(v: JsonValue | undefined): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (isObj(v)) return asString(v.name);
  return undefined;
}

/** image can be a string, string[], { url }, or an array of those. */
function imageList(v: JsonValue | undefined): string[] {
  const out: string[] = [];
  const push = (x: JsonValue) => {
    if (typeof x === "string" && x.trim()) out.push(x.trim());
    else if (isObj(x)) {
      const u = asString(x.url) ?? asString(x.contentUrl);
      if (u) out.push(u);
    }
  };
  if (Array.isArray(v)) v.forEach(push);
  else if (v !== undefined) push(v);
  return [...new Set(out)];
}

interface OfferInfo {
  price?: string;
  priceOriginal?: string;
  currency?: string;
}

/** Pull price/currency from Offer | AggregateOffer | Offer[]. */
function offerInfo(v: JsonValue | undefined): OfferInfo {
  const collect = (node: JsonObject): { price?: number; currency?: string; high?: number } => {
    const currency = asString(node.priceCurrency);
    const priceStr =
      asString(node.price) ??
      asString(node.lowPrice) ??
      (isObj(node.priceSpecification) ? asString(node.priceSpecification.price) : undefined);
    const high = asString(node.highPrice);
    return {
      price: priceStr !== undefined ? Number(priceStr) : undefined,
      currency,
      high: high !== undefined ? Number(high) : undefined,
    };
  };

  const nodes: JsonObject[] = [];
  if (Array.isArray(v)) v.forEach((x) => isObj(x) && nodes.push(x));
  else if (isObj(v)) nodes.push(v);
  if (!nodes.length) return {};

  let min = Infinity;
  let max = 0;
  let currency: string | undefined;
  for (const n of nodes) {
    const { price, currency: c, high } = collect(n);
    if (c && !currency) currency = c;
    if (typeof price === "number" && !Number.isNaN(price) && price > 0) {
      min = Math.min(min, price);
      max = Math.max(max, price);
    }
    if (typeof high === "number" && !Number.isNaN(high)) max = Math.max(max, high);
  }
  const result: OfferInfo = { currency };
  if (min !== Infinity) result.price = String(min);
  if (max > 0 && max > (min === Infinity ? 0 : min)) result.priceOriginal = String(max);
  return result;
}

/** Extract raw fields from a single schema.org Product node. */
function rawFromProductNode(node: JsonObject): Partial<RawExtract> & { found: boolean } {
  const offers = offerInfo(node.offers);
  const images = imageList(node.image);
  const color = asString(node.color);
  const material = asString(node.material);
  const description = asString(node.description);
  const url =
    asString(node.url) ??
    asString(node["@id"]) ??
    (isObj(node.offers) ? asString((node.offers as JsonObject).url) : undefined);

  return {
    found: true,
    name: asString(node.name),
    brand: brandName(node.brand),
    price: offers.price,
    priceOriginal: offers.priceOriginal,
    currency: offers.currency,
    image: images[0],
    images,
    color: color ? decodeEntities(color) : undefined,
    material: material ? decodeEntities(material) : undefined,
    // descriptions are sometimes HTML — strip tags so the catalog stays clean
    description: description ? stripTags(description) : undefined,
    url: url && /^https?:\/\//.test(url) ? url : undefined,
    sizes: [],
  };
}

/** A full RawExtract from a single Product node (json-ld only, no meta merge). */
function nodeToRaw(node: JsonObject): RawExtract {
  const r = rawFromProductNode(node);
  return {
    name: r.name,
    brand: r.brand,
    price: r.price,
    priceOriginal: r.priceOriginal,
    currency: r.currency,
    image: r.image,
    images: r.images ?? [],
    sizes: [],
    color: r.color,
    material: r.material,
    description: r.description,
    url: r.url,
    strategies: ["json-ld"],
  };
}

/** Keep only product-like extracts, deduped by name + url/image. */
function dedupeRaw(list: RawExtract[]): RawExtract[] {
  const out: RawExtract[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    const hasData = !!r.name || (!!r.price && !!r.image);
    if (!hasData) continue;
    const key = `${(r.name ?? "").toLowerCase()}::${r.url ?? r.image ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function fromJsonLd(html: string): Partial<RawExtract> & { found: boolean } {
  const { standalone, listItems } = partitionProductNodes(parseJsonLdBlocks(html));
  // Prefer the page's own product; fall back to the first list item.
  const node = standalone[0] ?? listItems[0];
  if (!node) return { found: false, images: [], sizes: [] };
  return rawFromProductNode(node);
}

function fromMeta(html: string): Partial<RawExtract> {
  const meta = parseMetaTags(html);
  const get = (k: string) => meta.get(k.toLowerCase());
  const images = [...new Set([...allMeta(html, "og:image"), ...allMeta(html, "twitter:image")])].filter(Boolean);
  const title = get("og:title");
  return {
    name: title ? decodeEntities(title) : undefined,
    brand: get("product:brand") || get("og:brand"),
    price: get("product:price:amount") || get("og:price:amount"),
    currency: get("product:price:currency") || get("og:price:currency"),
    image: images[0],
    images,
    description: (() => {
      const d = get("og:description") || get("description");
      return d ? decodeEntities(d) : undefined;
    })(),
  };
}

function fromMicrodata(html: string): Partial<RawExtract> {
  const prop = (name: string): string | undefined => {
    // <span itemprop="price" content="49.99"> or text content
    const contentRe = new RegExp(
      `<[^>]*itemprop=["']${name}["'][^>]*\\bcontent=["']([^"']+)["']`,
      "i",
    );
    const cm = html.match(contentRe);
    if (cm) return decodeEntities(cm[1]);
    const textRe = new RegExp(
      `<([a-z0-9]+)[^>]*itemprop=["']${name}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
      "i",
    );
    const tm = html.match(textRe);
    if (tm) {
      const v = stripTags(tm[2]);
      if (v) return v;
    }
    return undefined;
  };
  return {
    name: prop("name"),
    brand: prop("brand"),
    price: prop("price"),
    currency: prop("priceCurrency"),
  };
}

/** Apply a single recipe regex rule against the raw HTML. */
function applyRule(html: string, regex: string | undefined): string | undefined {
  if (!regex) return undefined;
  try {
    const re = new RegExp(regex, "i");
    const m = html.match(re);
    if (m) return decodeEntities(m[1] ?? m[0]);
  } catch {
    // Invalid recipe regex — ignore, fall back to generic extraction.
  }
  return undefined;
}

/**
 * Run every strategy and merge with the documented precedence.
 * `config` is the matched per-site recipe (optional).
 */
export function extractProduct(
  html: string,
  config?: ParserSiteConfig | null,
  baseUrl?: string,
): RawExtract {
  const strategies: string[] = [];
  const jsonld = fromJsonLd(html);
  if (jsonld.found) strategies.push("json-ld");
  const meta = fromMeta(html);
  if (meta.name || meta.price || (meta.images?.length ?? 0) > 0) strategies.push("opengraph");
  const micro = fromMicrodata(html);
  if (micro.name || micro.price) strategies.push("microdata");

  // Recipe regex overrides (highest precedence)
  const ruleVal = (field: ParserRuleField): string | undefined =>
    applyRule(html, config?.rules?.[field]?.regex);
  if (config?.rules && Object.keys(config.rules).length) strategies.push(`recipe:${config.name}`);

  const pick = (...vals: (string | undefined)[]): string | undefined =>
    vals.find((v) => v !== undefined && v !== "");

  const images = [...new Set([...(jsonld.images ?? []), ...(meta.images ?? [])])].filter(Boolean);

  // sizes only come from recipe rules today (split on comma / pipe / semicolon)
  const sizeRaw = ruleVal("sizes");
  const sizes = sizeRaw
    ? sizeRaw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
    : [];

  const image = pick(ruleVal("image"), jsonld.image, meta.image, images[0]);

  // Structured data routinely advertises a single photo for a page that shows
  // a full gallery (an OpenGraph-only page always does — there is one og:image).
  // Harvest the rest from the markup, anchored to what we already trust so the
  // recommendations carousel and page furniture stay out. Trusted images keep
  // their position, so the primary photo never changes.
  let galleryImages: string[] = [];
  if (baseUrl) {
    const anchor = image ? [image, ...images] : images;
    const productName = pick(ruleVal("name"), jsonld.name, meta.name, micro.name) ?? "";
    galleryImages = harvestGalleryImages(html, baseUrl, anchor, productName);
    if (galleryImages.length) strategies.push("gallery");
  }

  return {
    name: pick(ruleVal("name"), jsonld.name, meta.name, micro.name),
    brand: pick(ruleVal("brand"), jsonld.brand, meta.brand, micro.brand),
    price: pick(ruleVal("price"), jsonld.price, meta.price, micro.price),
    priceOriginal: jsonld.priceOriginal,
    currency: pick(ruleVal("currency"), jsonld.currency, meta.currency, micro.currency),
    image,
    images: [
      ...(image && !images.includes(image) ? [image, ...images] : images),
      ...galleryImages,
    ],
    sizes,
    color: pick(ruleVal("color"), jsonld.color),
    material: pick(ruleVal("material"), jsonld.material),
    description: pick(ruleVal("description"), jsonld.description, meta.description),
    strategies,
  };
}

export interface PageProducts {
  /** Number of standalone (non-list) Product nodes — 1 means a product page. */
  standaloneCount: number;
  /** The page's own product(s). */
  standaloneItems: RawExtract[];
  /** Products embedded in an ItemList (listing cards / related products). */
  listItems: RawExtract[];
}

/**
 * Analyse a page: separate its own product(s) from any embedded ItemList. The
 * parse route uses this to choose single-product vs listing mode robustly —
 * a product page with a "related products" carousel stays single.
 */
export function partitionProducts(html: string): PageProducts {
  const { standalone, listItems } = partitionProductNodes(parseJsonLdBlocks(html));
  return {
    standaloneCount: standalone.length,
    standaloneItems: dedupeRaw(standalone.map(nodeToRaw)),
    listItems: dedupeRaw(listItems.map(nodeToRaw)),
  };
}

/**
 * Extract EVERY product embedded in the page (listing / category pages).
 * Returns one RawExtract per schema.org Product node found. A node is kept only
 * if it carries enough to be a real product card (a name, or a price+image).
 */
export function extractProductNodes(html: string): RawExtract[] {
  return dedupeRaw(findAllProductNodes(parseJsonLdBlocks(html)).map(nodeToRaw));
}

/**
 * Discover product-page URLs on a listing page. Combines schema.org ItemList
 * URLs with same-host anchors that look like product links — used to "parse
 * each" when the listing doesn't embed full product data.
 */
export function extractProductLinks(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  let host = "";
  try { host = new URL(baseUrl).hostname.replace(/^www\./, ""); } catch { /* ignore */ }

  // 1. ItemList element urls from JSON-LD
  for (const node of findAllProductNodes(parseJsonLdBlocks(html))) {
    const u = (typeof node.url === "string" && node.url) || (typeof node["@id"] === "string" && node["@id"]);
    if (typeof u === "string" && /^https?:\/\//.test(u)) urls.add(u.split("#")[0]);
  }

  // 2. Anchors that look like product pages on the same host
  const PRODUCT_PATH = /\/(product|products|item|items|pd|prod|shopping|p)\/|-item-|\/[\w-]+-\d{5,}|\.aspx/i;
  const anchorRe = /<a\b[^>]*\bhref=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    let abs: URL;
    try { abs = new URL(m[1], baseUrl); } catch { continue; }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
    if (host && abs.hostname.replace(/^www\./, "") !== host) continue;
    if (!PRODUCT_PATH.test(abs.pathname)) continue;
    urls.add(`${abs.origin}${abs.pathname}`);
    if (urls.size >= 60) break;
  }

  return [...urls].slice(0, 60);
}
