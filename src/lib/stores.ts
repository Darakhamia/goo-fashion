/**
 * The multi-brand retailers we integrate with ("stores we have an API for").
 * This is the single source of truth for the stores an admin can attach to the
 * homepage "Where to buy" showcase. Each store resolves its logo from its
 * favicon and its link from its homepage — no manual logo/URL upload needed.
 *
 * Keep names in sync with KNOWN_STORES in `@/lib/server/product-fields` (which
 * resolves a store name from a product link).
 */
export interface SupportedStore {
  name: string;
  /** Bare domain, e.g. "farfetch.com" — used for both the favicon and the link. */
  domain: string;
}

export const SUPPORTED_STORES: SupportedStore[] = [
  { name: "Farfetch", domain: "farfetch.com" },
  { name: "SSENSE", domain: "ssense.com" },
  { name: "Mr Porter", domain: "mrporter.com" },
  { name: "Net-A-Porter", domain: "net-a-porter.com" },
  { name: "END.", domain: "endclothing.com" },
  { name: "Matches", domain: "matchesfashion.com" },
  { name: "Mytheresa", domain: "mytheresa.com" },
  { name: "Nordstrom", domain: "nordstrom.com" },
  { name: "Selfridges", domain: "selfridges.com" },
  { name: "Zalando", domain: "zalando.com" },
  { name: "ASOS", domain: "asos.com" },
];

/**
 * `rel` for every link that sends a shopper to a store. Many of them are
 * affiliate links (Awin and others), and Google's link-spam policy wants paid
 * and affiliate links marked `sponsored`; `nofollow` covers the plain store
 * links the same way, so one value fits them all. `noreferrer` keeps the
 * shopper's path private — drop it only if partners ask for the referrer
 * (docs/SEO_PLAN.md, Р-7).
 */
export const RETAILER_LINK_REL = "sponsored nofollow noopener noreferrer";

/** Store homepage link — the "Where to buy" redirect target. */
export function storeHomepageUrl(domain: string): string {
  return `https://www.${domain}`;
}

/** Store logo via the site favicon (no upload needed). */
export function storeFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

/** Look up a supported store by (case-insensitive) name. */
export function findSupportedStore(name: string): SupportedStore | undefined {
  const n = name.trim().toLowerCase();
  return SUPPORTED_STORES.find((s) => s.name.toLowerCase() === n);
}

/** True when a name matches one of the supported stores. */
export function isSupportedStore(name: string): boolean {
  return findSupportedStore(name) !== undefined;
}
