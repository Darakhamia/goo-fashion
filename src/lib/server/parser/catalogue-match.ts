/**
 * Which of a store's pages are pieces the catalogue already has — asked of the
 * page's address before the page is opened.
 *
 * A links-only run exists to add a second store's link to the cards we have.
 * It used to open the store's pages in the order its sitemap and its category
 * page list them, and ask each one only afterwards. On a store selling two
 * thousand things, a run of sixty opened sixty pages that were mostly never
 * ours, skipped every one of them, and never reached the few that were.
 *
 * A store names its pages after what they sell — `/products/nike-air-max-90`,
 * `/etnies-emerson-grey.html` — and a Shopify sitemap gives each one its title
 * besides. That is enough to look for our pieces first.
 *
 * Only an order and a first sieve. Whether a page IS one of our cards is still
 * decided once it is opened, by the importer's full rules (`same-item.ts`): a
 * page picked here that turns out to be another colour is still skipped. So
 * the sieve is generous — every word of a card's model somewhere in the
 * address — and it never drops a page whose address names nothing: it cannot
 * tell, and those are opened after the likely ones.
 */
import { articleCodes, namesModelAlone, pieceName } from "./piece-name";
import { foldBrand, makerNames } from "./brand-from-name";
import { listingKey, storeHost } from "./listing-url";

/** A card as the sieve needs it. */
export interface CataloguePiece {
  name: string;
  brand?: string | null;
  colors?: string[] | null;
  mpn?: string | null;
  /** The card's own page and its store links: pages already on it. */
  urls?: (string | null | undefined)[];
}

interface Piece {
  /** The model's words, every one of which an address must carry. */
  words: string[];
  /** Every spelling of its maker, spaced as a page's words would be. */
  brands: string[];
  /** The same spellings with letters and digits only, for a store's host. */
  hosts: string[];
  /** The model's words could be anyone's without the brand beside them. */
  loose: boolean;
}

export interface CatalogueIndex {
  /** Pieces by the rarest of their words, so each is checked only where it can match. */
  byWord: Map<string, Piece[]>;
  /** Pieces by article code, letters and digits only. */
  byCode: Set<string>;
  /** Every page already on a card, as `listingKey` spells it. */
  linked: Set<string>;
  /** Cards that could be looked for. */
  size: number;
}

/** What a sitemap or a category page lists that says nothing of the piece. */
const GENERIC_SEGMENTS = new Set([
  "products", "product", "p", "pd", "prod", "item", "items", "shop", "store", "catalog",
  "catalogue", "collections", "collection", "all", "goods", "detail", "details", "buy", "view",
  "produkt", "produit", "producto", "prodotto", "tovar", "tovary", "katalog",
]);

/** A folded text with punctuation as spaces: how a brand is looked for in a page's words. */
function spaced(value: string): string {
  return foldBrand(value)
    .replace(/['’`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const YEAR = /^(?:19|20)\d\d$/;

/** A code worth trusting on its own: letters and digits both, five or more. */
const isCode = (c: string) => c.length >= 5 && /\p{L}/u.test(c) && /\d/.test(c);

export function buildCatalogueIndex(rows: CataloguePiece[]): CatalogueIndex {
  const pieces: Piece[] = [];
  const byCode = new Set<string>();
  const linked = new Set<string>();
  let size = 0;

  for (const row of rows) {
    for (const url of row.urls ?? []) {
      const key = listingKey(url);
      if (key) linked.add(key);
    }
    const brand = (row.brand ?? "").trim();
    const spellings = brand ? makerNames(brand) : [];
    const name = pieceName(row.name ?? "", spellings, row.colors ?? []);
    const codes = articleCodes({ name: row.name ?? "", mpn: row.mpn }).filter(isCode);
    for (const code of codes) byCode.add(code);
    // The model without its garment word — "samba og shoes" is looked for as
    // "samba og" — and without a year a store's address rarely repeats.
    const words = (name.core || name.full).split(" ").filter((w) => w && !YEAR.test(w));
    if (words.length || codes.length) size++;
    if (!words.length) continue;
    pieces.push({
      words,
      brands: spellings.map(spaced).filter(Boolean),
      hosts: spellings.map((s) => spaced(s).replace(/ /g, "")).filter((h) => h.length >= 3),
      loose: !namesModelAlone(name),
    });
  }

  const count = new Map<string, number>();
  for (const p of pieces) for (const w of new Set(p.words)) count.set(w, (count.get(w) ?? 0) + 1);
  const byWord = new Map<string, Piece[]>();
  for (const p of pieces) {
    const rarest = p.words.reduce((a, b) => ((count.get(b) ?? 0) < (count.get(a) ?? 0) ? b : a));
    byWord.set(rarest, [...(byWord.get(rarest) ?? []), p]);
  }

  return { byWord, byCode, linked, size };
}

/** A page's words, as far as its address and its sitemap title tell them. */
function readPage(url: string, title?: string) {
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  try {
    path = decodeURIComponent(path);
  } catch {
    /* a malformed escape — read it as it is */
  }
  const segments = path
    .replace(/\.(?:html?|php|aspx?|jsp)$/i, "")
    .split("/")
    .filter((s) => s && !GENERIC_SEGMENTS.has(s.toLowerCase()) && !/^[a-z]{2}(?:[-_][a-z]{2})?$/i.test(s));
  const text = `${segments.join(" ").replace(/[-_+.]/g, " ")} ${title ?? ""}`;
  const name = pieceName(text, "", []);
  const words = new Set(name.full.split(" ").filter(Boolean));
  // An address like `/p/184223` or `/product/nike/9912` names no piece; the
  // sieve cannot rule such a page out, only put it after the likely ones.
  const named =
    !!title?.trim() || [...words].filter((w) => w.length >= 3 && /\p{L}/u.test(w)).length >= 2;
  return { words, codes: name.codes, plain: ` ${spaced(text)} `, named };
}

/** How sure the address is that the page is one of our pieces: 0 not at all. */
function score(url: string, index: CatalogueIndex, title?: string): { score: number; named: boolean } {
  const page = readPage(url, title);
  if (!page) return { score: 0, named: false };
  if (page.codes.some((c) => index.byCode.has(c))) return { score: 3, named: true };

  const labels = storeHost(url).split(".");
  let best = 0;
  for (const word of page.words) {
    for (const piece of index.byWord.get(word) ?? []) {
      if (!piece.words.every((w) => page.words.has(w))) continue;
      const branded = piece.brands.some((b) => page.plain.includes(` ${b} `));
      // The brand's own shop names the brand in its host, not in each address.
      const own = piece.hosts.some((h) => labels.some((l) => l === h || l.startsWith(h)));
      // "Emerson" or "Classic Logo" alone is any maker's; with the brand in the
      // address or the host, it is this one's.
      if (piece.loose && !branded && !own) continue;
      best = Math.max(best, branded || own ? 2 : 1);
      if (best === 2) return { score: best, named: true };
    }
  }
  return { score: best, named: page.named };
}

export interface LinksOnlyOrder {
  /** Addresses to open: likely pieces of ours first, then those that name nothing. */
  urls: string[];
  /** Pages whose address names a piece we have. */
  matched: number;
  /** Pages whose address names nothing, opened after the matches. */
  unnamed: number;
  /** Pages already on a card, opened last: only their price is refreshed. */
  linked: number;
  /** Pages that name something we do not have. Not opened. */
  other: number;
}

/**
 * The store's pages in the order a links-only run should open them: those
 * that name one of our pieces (a code first, then the brand and the model,
 * then the model alone), then those that name nothing at all, then the ones
 * already on a card. A page that names something else is not opened.
 */
export function orderForLinksOnly(
  urls: string[],
  index: CatalogueIndex,
  titleOf: (url: string) => string | undefined = () => undefined,
): LinksOnlyOrder {
  const matched: { url: string; score: number; at: number }[] = [];
  const unnamed: string[] = [];
  const linked: string[] = [];
  let other = 0;
  const seen = new Set<string>();

  urls.forEach((url, at) => {
    const key = listingKey(url);
    if (!key || seen.has(key)) return;
    seen.add(key);
    if (index.linked.has(key)) {
      linked.push(url);
      return;
    }
    const found = score(url, index, titleOf(url));
    if (found.score > 0) matched.push({ url, score: found.score, at });
    else if (!found.named) unnamed.push(url);
    else other++;
  });

  matched.sort((a, b) => b.score - a.score || a.at - b.at);
  return {
    urls: [...matched.map((m) => m.url), ...unnamed, ...linked],
    matched: matched.length,
    unnamed: unnamed.length,
    linked: linked.length,
    other,
  };
}
