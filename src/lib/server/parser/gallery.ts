/**
 * Gallery harvesting — find every photo of the product, not just the one the
 * page advertises.
 *
 * Structured data is reliable but thin: OpenGraph carries a single `og:image`,
 * and plenty of stores ship JSON-LD with one photo even when the page shows
 * eight. Measured on a live Allbirds product page, JSON-LD/OG yielded 1 image
 * while the HTML contained the full gallery in plain `<img>` tags.
 *
 * The catalog wants all of them, so this module scrapes the markup — and the
 * whole difficulty is that a retail page is full of images that are NOT this
 * product: a recommendations carousel of other products, nav banners, material
 * icons, payment badges, customer review photos on a third-party host. Adding
 * those is worse than missing a photo, because a wrong image lands in the
 * catalog looking correct.
 *
 * So harvesting is deliberately conservative. A candidate is kept only when it
 * demonstrably belongs to the same product as an image we already trust (from
 * JSON-LD/OpenGraph): same host, and a filename sharing a long prefix with a
 * trusted one. On the Allbirds page that keeps the four real gallery shots
 * (`All-birds_0017/0029/0014/0028` next to the trusted `All-birds_0010`) and
 * rejects all four other-product shots, the sale banner and the material icons.
 */

/** Query parameters that only ask for a smaller rendition. */
const SIZE_PARAMS = ["width", "height", "w", "h", "quality", "q", "size", "sw", "sh", "fit", "crop"];

/**
 * Shopify (and friends) append a rendition suffix right before the extension:
 *   photo_1024x.jpg · photo_600x600_crop_center.jpg · photo_grande.jpg
 * Stripping it yields the original, full-resolution file. Anchored to the end
 * so a size that is genuinely part of the name (`..._PDP_LEFT-2000x2000_ab12`)
 * is left alone.
 */
const RENDITION_SUFFIX =
  /_(?:\d{1,5}x\d{0,5}(?:_crop_[a-z]+)?|pico|icon|thumb|small|compact|medium|large|grande|master|original)(?=\.[a-z0-9]+$)/i;

const IMAGE_EXT = /\.(?:jpe?g|png|webp|avif)$/i;

/**
 * Filename fragments that mark furniture rather than product photography.
 * Matched against the path, so a product genuinely called "Logo Tee" is only at
 * risk if its *filename* says logo — and it would still need to fail the
 * stem test below to be dropped.
 */
const NOISE = /(?:sprite|placeholder|transparent|blank|pixel|spacer|logo|favicon|icon[-_.]|badge|payment|visa|mastercard|paypal|klarna|afterpay|social|instagram|facebook|tiktok|banner|nav[-_.]|menu|header|footer|newsletter|review|rating|star|flag|loader|spinner|swatch|材质)/i;

/** Resolve, upgrade to full resolution, and drop tracking/size noise. */
export function upgradeImageUrl(src: string, baseUrl: string): string | null {
  if (!src) return null;
  let u: URL;
  try {
    u = new URL(src.trim().replace(/&amp;/g, "&"), baseUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  // Ask the CDN for the original rather than the thumbnail the page happened
  // to request. Without this a gallery scraped from `?width=300` markup would
  // be mirrored into our storage at 300px — technically "all the images", and
  // useless for a fashion catalog.
  for (const p of SIZE_PARAMS) u.searchParams.delete(p);
  u.pathname = u.pathname.replace(RENDITION_SUFFIX, "");

  if (!IMAGE_EXT.test(u.pathname)) return null;
  return u.toString();
}

/** Identity of a photo irrespective of rendition — the dedupe key. */
export function imageKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.replace(RENDITION_SUFFIX, "").toLowerCase()}`;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Filename reduced to comparable characters: lowercase alphanumerics only.
 * A trailing 32-character hex run is a CDN de-duplication UUID (Shopify appends
 * one when two uploads share a name) and says nothing about the product, so it
 * is removed — otherwise `All-birds_0014_e70e39f1-…` would not read as a
 * sibling of `All-birds_0010`.
 */
function stem(url: string): string {
  try {
    const file = new URL(url).pathname.split("/").pop() ?? "";
    return file
      .replace(IMAGE_EXT, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .replace(/[0-9a-f]{32}$/, "");
  } catch {
    return "";
  }
}

/**
 * Does the filename name this product? Stores that label assets after the
 * product ("…_EasyTote_Cappuccino_Hero") give this signal, and it survives the
 * house template that defeats prefix matching.
 *
 * Matching runs on the name's WORDS, and demands two of them. A sliding
 * character window is too loose: "Men's Cruiser — Shadow Blue (Natural White
 * Sole)" and a different shoe's `Allbirds-Slide-Natural-Black` share the run
 * "enatural", which was enough to pull a stranger's photo into the gallery.
 * Colour and material words recur across a catalog; a product is identified by
 * the combination, not by any single word.
 */
const NAME_TOKEN_MIN = 4;

/**
 * The name's ADJACENT word pairs ("Classic Easy Tote" → classiceasy, easytote).
 * Adjacency is what makes the match a product identity rather than a bag of
 * words: "Classic Easy Tote" and the separate "Classic Tote Insert" accessory
 * share both `classic` and `tote`, so scattered-word matching filed the
 * insert's photos under the tote. No pair of adjacent words collides.
 */
function namePhrases(name: string): string[] {
  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= NAME_TOKEN_MIN);
  if (words.length === 0) return [];
  // A one-word name ("Cruiser") has no pair — use the word, if it is long
  // enough to identify something on its own.
  if (words.length === 1) return words[0].length >= 6 ? words : [];
  const phrases: string[] = [];
  for (let i = 0; i + 1 < words.length; i++) phrases.push(words[i] + words[i + 1]);
  return [...new Set(phrases)];
}

function matchesProductName(candidateStem: string, phrases: string[]): boolean {
  return phrases.some((p) => candidateStem.includes(p));
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/**
 * How much of a filename must match a trusted image's filename before we
 * believe it is the same product. Ten characters is long enough that
 * `allbirds0010` and `allbirds0029` agree while `allbirds0010` and
 * `a1265026q1allbirdsslide` (a different shoe) do not.
 */
const STEM_MATCH_MIN = 10;

/**
 * A shared prefix only proves kinship when what follows it is a frame number,
 * not another product. Some stores name every asset to a template — Cuyana
 * ships `PDP_2000x2500_<season>_<product>_<colour>_<n>` — so a plain prefix
 * test matched the tote against pouches and charms, which agree for thirteen
 * characters of boilerplate. Requiring the remainder to be short keeps
 * `All-birds_0010` → `All-birds_0017` and rejects
 * `…SU22_EasyTote…` → `…SP26_SystemOrganizerPouch…`.
 */
const STEM_TAIL_MAX = 12;

/** Pull every image reference out of the markup, in document order. */
function collectCandidates(html: string): string[] {
  const out: string[] = [];

  // <img src> / data-src / data-original — lazy-loading libraries use all three.
  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    for (const attr of ["src", "data-src", "data-original", "data-lazy", "data-image"]) {
      const a = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, "i"));
      if (a) out.push(a[1]);
    }
  }

  // srcset on <img> and <source>: take every candidate; the largest wins after
  // the rendition suffix and size params are stripped, so order is irrelevant.
  const srcsetRe = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html))) {
    for (const part of m[1].split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url) out.push(url);
    }
  }

  // <link rel="preload" as="image"> — browsers preload the gallery's hero shots.
  const preloadRe = /<link\b[^>]*\bas=["']image["'][^>]*>/gi;
  while ((m = preloadRe.exec(html))) {
    const href = m[0].match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (href) out.push(href[1]);
    const imagesrcset = m[0].match(/\bimagesrcset\s*=\s*["']([^"']+)["']/i);
    if (imagesrcset) {
      for (const part of imagesrcset[1].split(",")) {
        const url = part.trim().split(/\s+/)[0];
        if (url) out.push(url);
      }
    }
  }

  // Inline JSON blobs (Shopify/Next hydration payloads) reference the gallery
  // as escaped URLs the tag scanners above never see.
  const jsonUrlRe = /(?:https?:)?\\?\/\\?\/[^"'\s\\)>]+?\.(?:jpe?g|png|webp|avif)(?:\?[^"'\s\\)>]*)?/gi;
  while ((m = jsonUrlRe.exec(html))) out.push(m[0].replace(/\\\//g, "/"));

  return out;
}

/**
 * Find additional photos of the same product.
 *
 * `trusted` are the images structured data already gave us — they anchor the
 * search, and are also what a candidate must resemble to be accepted. Returns
 * only the NEW images, in document order; the caller keeps the trusted ones
 * first so the primary photo never changes.
 */
export function harvestGalleryImages(
  html: string,
  baseUrl: string,
  trusted: string[],
  productName = "",
): string[] {
  const trustedUrls = trusted
    .map((u) => upgradeImageUrl(u, baseUrl))
    .filter((u): u is string => !!u);
  if (trustedUrls.length === 0) return [];

  const trustedHosts = new Set<string>();
  const trustedStems: string[] = [];
  for (const u of trustedUrls) {
    try {
      trustedHosts.add(new URL(u).hostname.replace(/^www\./, ""));
    } catch {
      /* skip */
    }
    const s = stem(u);
    if (s) trustedStems.push(s);
  }

  const phrases = namePhrases(productName);
  const seen = new Set(trustedUrls.map(imageKey));
  const out: string[] = [];

  const candidates = collectCandidates(html)
    .map((raw) => upgradeImageUrl(raw, baseUrl))
    .filter((u): u is string => !!u);

  for (const url of candidates) {
    const key = imageKey(url);
    if (seen.has(key)) continue;

    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    // A different host is someone else's imagery — review photos, ad pixels,
    // partner badges. The product's own gallery is served where its main photo is.
    if (!trustedHosts.has(host)) continue;

    const path = (() => {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    })();
    if (NOISE.test(path)) continue;

    // The decisive test: does this photo belong to the same product? Two
    // independent signals, either of which is enough — stores name their assets
    // one way or the other, and neither convention alone covers both.
    const s = stem(url);
    if (!s) continue;
    const isSibling =
      // (1) the filename carries the product's name
      matchesProductName(s, phrases) ||
      // (2) it is a numbered frame beside a photo we trust
      trustedStems.some(
        (t) => commonPrefixLength(t, s) >= STEM_MATCH_MIN &&
          s.length - commonPrefixLength(t, s) <= STEM_TAIL_MAX,
      );
    if (!isSibling) continue;

    seen.add(key);
    out.push(url);
  }

  return out;
}
