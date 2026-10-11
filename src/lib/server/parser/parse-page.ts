/**
 * One collected page into one product — the pipeline behind the collect
 * extension's `ingest`.
 *
 *   rendered page → deterministic extract → store JSON → AI fallback →
 *   normalise → ParsedProduct
 *
 * Nothing here asks the store anything. The extension opened the page in the
 * admin's own Chrome — their address, their cookies, the anti-bot check their
 * browser already passed — and sent its markup, stripped, together with what
 * the rendered page showed (see `extension/snapshot.js`). That is also a better
 * source than a server fetch ever was: it is the RENDERED DOM, so a gallery
 * that lazy-loads on scroll is real `<img src>` by the time it arrives.
 */
import { mergeShopifyIntoRaw } from "./shopify";
import type { CategoryGroup } from "@/lib/categories";
import { extractProduct } from "./extract";
import { normalizeExtract } from "./normalize";
import { aiExtract, mergeAiIntoRaw, shouldUseAi } from "./ai-extract";
import { matchSiteConfig } from "./configs";
import type { PageEvidence, ParsedProduct, ParserAiSettings, ParserSiteConfig } from "./types";

export interface ParsePageResult {
  /** The page's product, or null when it neither names one nor shows a photo. */
  product: ParsedProduct | null;
  /** Fields the AI pass contributed, if it ran. */
  aiFields?: string[];
  /** Why AI did not run / failed, when relevant. */
  aiError?: string;
}

export interface ParsePageOptions {
  siteConfigs: ParserSiteConfig[];
  aiSettings: ParserAiSettings;
  /** Override the AI decision for this call. */
  useAi?: boolean;
  /** The page's markup, as the extension stripped it in the admin's browser. */
  html: string;
  /**
   * What the browser saw that its markup no longer says. The fields are
   * candidates, not answers — they enter the same extractor at the lowest
   * precedence, behind every structured source.
   */
  evidence?: PageEvidence;
  /**
   * The trailing text this store appends to every page title. Subtracted from
   * the product name — whatever is identical across twenty of a shop's pages
   * is the shop talking, not any one product's name.
   */
  titleSuffix?: string;
  /** The admin's category tree, so subcategories are the labels it actually has. */
  categoryTree?: CategoryGroup[];
}

export async function parsePage(url: string, opts: ParsePageOptions): Promise<ParsePageResult> {
  const matched = matchSiteConfig(url, opts.siteConfigs);

  // The extension only ever sends product pages: the plan picked them. So the
  // page is read as one product, never as a listing — reading it as one would
  // take the first JSON-LD card and discard everything the page itself showed.
  // `url` lets the extractor harvest the gallery out of the markup: relative
  // and protocol-relative image URLs need a base to resolve against.
  let raw = extractProduct(opts.html, matched, url, opts.evidence);
  if (opts.evidence?.shopify) {
    raw = mergeShopifyIntoRaw(raw, opts.evidence.shopify.product, url, opts.evidence.shopify.currency);
  }

  let aiFields: string[] | undefined;
  let aiError: string | undefined;
  const aiAllowed = opts.useAi ?? opts.aiSettings.enabled;
  const aiWanted = aiAllowed && (opts.aiSettings.mode === "always" || shouldUseAi(raw));
  if (aiWanted) {
    const result = await aiExtract(opts.html, url);
    if (result.error) {
      aiError = result.error;
    } else {
      const merged = mergeAiIntoRaw(raw, result.fields, url);
      raw = merged.raw;
      aiFields = merged.used;
    }
  }

  const product = normalizeExtract(raw, url, matched, { titleSuffix: opts.titleSuffix, tree: opts.categoryTree });
  return { product: product.name || product.imageUrl ? product : null, aiFields, aiError };
}
