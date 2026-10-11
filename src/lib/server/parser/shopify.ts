/**
 * Shopify's own JSON for a collected page.
 *
 * Every Shopify storefront answers `/products/<handle>.json` with the product
 * in full: *every* photo in `images[]`, every variant with its price and
 * compare-at price, and the option sets — colour and size — as data rather
 * than as markup. That is the whole job of `extract.ts` + `gallery.ts` done
 * exactly, with no identity tests and no guessing about which `<img>` belongs
 * to the product.
 *
 * The server never asks for it. The extension fetches it from the page's own
 * origin, in the admin's browser (see `extension/snapshot.js`), and sends it
 * with the page; this module checks its shape and folds it into what the page
 * said.
 */
import { stripTags } from "./extract";
import { compositionFromText } from "@/lib/server/product-fields";
import type { RawExtract } from "./types";

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Option names that mean colour or size, in the languages a European
 * storefront actually ships them in.
 */
const SIZE_OPTION = /^(?:size|sizes|talla|taille|größe|grosse|taglia|розмір|размер)$/i;
const COLOR_OPTION = /^(?:colou?r|couleur|farbe|colore|color\s*way|колір|цвет)$/i;

interface ShopifyImage {
  src?: string;
  position?: number;
}

interface ShopifyVariant {
  price?: string | number;
  compare_at_price?: string | number | null;
  option1?: string | null;
  option2?: string | null;
  option3?: string | null;
  available?: boolean;
}

interface ShopifyOption {
  name?: string;
  values?: string[];
}

export interface ShopifyProduct {
  title?: string;
  handle?: string;
  vendor?: string;
  body_html?: string;
  product_type?: string;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
  options?: ShopifyOption[];
}

/**
 * Is this a Shopify product node rather than some other JSON that happened to
 * come back? A handle plus either photos or variants is unmistakable, and no
 * other endpoint we might hit by accident answers in that shape.
 */
export function isShopifyProduct(v: unknown): v is ShopifyProduct {
  if (!isObj(v)) return false;
  if (typeof v.handle !== "string" || !v.handle) return false;
  return Array.isArray(v.images) || Array.isArray(v.variants);
}

/** Lowest variant price, and the highest compare-at above it. */
function priceRange(variants: ShopifyVariant[]): { price?: string; priceOriginal?: string } {
  let min = Infinity;
  let was = 0;
  for (const v of variants) {
    const p = Number(v.price);
    if (Number.isFinite(p) && p > 0) min = Math.min(min, p);
    const c = Number(v.compare_at_price);
    if (Number.isFinite(c) && c > 0) was = Math.max(was, c);
  }
  const price = min === Infinity ? undefined : String(min);
  return { price, priceOriginal: was > (min === Infinity ? 0 : min) ? String(was) : undefined };
}

function optionValues(options: ShopifyOption[], match: RegExp): string[] {
  for (const o of options) {
    if (typeof o?.name === "string" && match.test(o.name.trim())) {
      return (o.values ?? []).map((v) => String(v).trim()).filter(Boolean);
    }
  }
  return [];
}

/**
 * Turn one Shopify product node into the same RawExtract the HTML path
 * produces, so everything downstream — normalisation, colour, import — is
 * shared and cannot drift.
 */
function rawFromShopifyProduct(
  product: ShopifyProduct,
  sourceUrl: string,
  currency?: string,
): RawExtract {
  const images = [...(product.images ?? [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((i) => (typeof i?.src === "string" ? i.src.trim() : ""))
    .filter(Boolean);

  const { price, priceOriginal } = priceRange(product.variants ?? []);
  const options = product.options ?? [];

  return {
    name: product.title?.trim() || undefined,
    brand: product.vendor?.trim() || undefined,
    price,
    priceOriginal,
    currency,
    image: images[0],
    images,
    // Shopify splits colourways into separate products far more often than it
    // puts them on one, so the first value is this product's colour rather than
    // a list to choose from. When there is no colour option the field stays
    // empty and the normalizer reads the title, exactly as on any other store.
    color: optionValues(options, COLOR_OPTION)[0],
    sizes: optionValues(options, SIZE_OPTION),
    material: undefined,
    description: product.body_html ? stripTags(product.body_html).slice(0, 5_000) : undefined,
    url: sourceUrl,
    strategies: ["shopify-json"],
  };
}

/**
 * A collected page read together with the store's own JSON for it.
 *
 * The extension sends the JSON it fetched from the page's origin (see
 * `snapshot.js`); a collected page is never fetched by the server. The JSON
 * wins where it states something: the name (a store whose h1 is its
 * logo named a leather jacket "MOWALOLA"), the brand, the price in the store's
 * own currency, every photo, the sizes and the colour option. The page keeps
 * what the JSON has no field for: the breadcrumbs, the spec rows, the material,
 * a description the theme rendered in full. The product type ("Jackets") is
 * added to the trail, where the category and subcategory are read from when
 * the name says nothing.
 */
export function mergeShopifyIntoRaw(raw: RawExtract, product: unknown, pageUrl: string, currency?: string): RawExtract {
  if (!isShopifyProduct(product)) return raw;
  const shop = rawFromShopifyProduct(product, pageUrl, currency);
  // The store's own list of this product's photos is the gallery. Adding what
  // the page showed brought in the "you may also like" rail — other products
  // on the same CDN, named in the same house style — and each photo a second
  // time under the store's /cdn/shop/ address.
  const images = shop.images?.length ? shop.images : (raw.images ?? []);
  const type = typeof product.product_type === "string" ? product.product_type.trim() : "";
  const trail = raw.breadcrumbs ?? [];
  const priced = !!shop.price && !!shop.currency;
  return {
    ...raw,
    name: shop.name || raw.name,
    brand: shop.brand || raw.brand,
    // The JSON's prices are in the store's base currency, known only from
    // `/meta.json`; without it the page's own price and currency stay, rather
    // than a hryvnia page being read in pounds.
    price: priced ? shop.price : raw.price,
    priceOriginal: priced ? shop.priceOriginal : raw.priceOriginal,
    currency: priced ? shop.currency : raw.currency,
    image: shop.image || raw.image,
    images,
    sizes: shop.sizes?.length ? shop.sizes : raw.sizes,
    color: raw.color || shop.color,
    description: raw.description || shop.description,
    // The page's own spec rows and prose were read first; the JSON's
    // description is the store's copy, and its composition line is the
    // material when the page had none.
    material: raw.material || compositionFromText(shop.description ?? "") || undefined,
    breadcrumbs: type && !trail.some((c) => c.toLowerCase() === type.toLowerCase()) ? [...trail, type] : trail,
    strategies: [...new Set([...(raw.strategies ?? []), "shopify-json"])],
  };
}
