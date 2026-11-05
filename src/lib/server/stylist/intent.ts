/**
 * What a shopper's message asks the AI stylist for: which garments, for whom,
 * and on what budget.
 *
 * The stylist recommends only from a short list of candidates fetched for each
 * turn (`stylist_candidates`, migration 033). That list is only as good as what
 * we read out of the message. Until 2026-11 the chat read it with a word list
 * of its own that had drifted from the catalogue — "jeans" pointed at `bottoms`
 * while jeans live in `jeans`, "hoodie" at `knitwear` while hoodies are `tops` —
 * knew no Ukrainian or European words, and read neither gender nor budget from
 * the message. So "jeans, a hoodie and sneakers" came back as "jeans and hoodies
 * are unavailable", and a men's boot went to a woman with a 6 000 ₴ budget.
 *
 * Garments come from the shared garment dictionary (`lib/taxonomy/garments`,
 * English, Russian, Ukrainian — the one the importer files products with), plus
 * a short list of everyday garment words in the European languages the site is
 * read in, translated to English first.
 */
import { garmentsIn, type GarmentType } from "@/lib/taxonomy/garments";
import { parsePrice } from "@/lib/server/product-fields";
import { toUsd } from "@/lib/server/fx";

export type StylistGender = "women" | "men";

export interface StylistBudget {
  /** As the shopper wrote it. */
  amount: number;
  currency: string;
  /** On the catalogue's comparable scale (`price_min_usd`). */
  usd: number;
}

export interface StylistIntent {
  /** Garment type ids, in the order the message names them. */
  garments: string[];
  /** Catalogue categories those garments are filed under. */
  categories: string[];
  /** Tree labels to put first within those categories ("Hoodies", "Jeans"). */
  subcategories: string[];
  /** English words for the garments, for full-text search. */
  terms: string[];
  gender: StylistGender | null;
  budget: StylistBudget | null;
}

// ── Garments in European languages ──────────────────────────────────────────

/**
 * Everyday garment words in German, French, Spanish, Italian, Polish, Dutch and
 * Swedish → the English word the garment dictionary knows. Each is a stem
 * matched at the start of a word (Polish and Italian decline and pluralise:
 * "płaszcza", "pantaloni"); more specific stems come before the shorter ones
 * they start with ("koszulk" before "koszul", "strickjacke" before "jacke").
 */
const EUROPEAN_GARMENTS: ReadonlyArray<readonly [string, string]> = [
  // German
  ["strickjacke", "cardigan"], ["kapuzenpullover", "hoodie"], ["turnschuh", "sneakers"],
  ["kleid", "dress"], ["hemd", "shirt"], ["bluse", "blouse"], ["hose", "trousers"],
  ["jacke", "jacket"], ["mantel", "coat"], ["anzug", "suit"], ["sakko", "blazer"],
  ["schuh", "shoes"], ["stiefel", "boots"], ["tasche", "bag"], ["mütze", "hat"],
  // French
  ["chemisier", "blouse"], ["chemise", "shirt"], ["robe", "dress"], ["pantalon", "trousers"],
  ["jupe", "skirt"], ["veste", "jacket"], ["manteau", "coat"], ["costume", "suit"],
  ["chaussure", "shoes"], ["basket", "sneakers"], ["bottine", "boots"], ["botte", "boots"],
  ["escarpin", "heels"], ["écharpe", "scarf"], ["echarpe", "scarf"], ["pull", "sweater"],
  // Spanish
  ["vestido", "dress"], ["camiseta", "t-shirt"], ["camisa", "shirt"], ["blusa", "blouse"],
  ["vaquero", "jeans"], ["falda", "skirt"], ["chaqueta", "jacket"], ["cazadora", "jacket"],
  ["abrigo", "coat"], ["sudadera", "hoodie"], ["jersey", "sweater"], ["traje", "suit"],
  ["americana", "blazer"], ["zapatilla", "sneakers"], ["zapato", "shoes"], ["bota", "boots"],
  ["bolso", "bag"], ["bufanda", "scarf"],
  // Italian
  ["vestito", "dress"], ["camicetta", "blouse"], ["camicia", "shirt"], ["maglietta", "t-shirt"],
  ["pantaloni", "trousers"], ["gonna", "skirt"], ["giacca", "jacket"], ["giubbotto", "jacket"],
  ["cappotto", "coat"], ["maglion", "sweater"], ["felpa", "hoodie"], ["scarpe", "shoes"],
  ["stival", "boots"], ["borsa", "bag"], ["sciarpa", "scarf"], ["tacchi", "heels"],
  // Polish
  ["sukien", "dress"], ["koszulk", "t-shirt"], ["koszul", "shirt"], ["bluzk", "blouse"],
  ["bluz", "sweatshirt"], ["spodni", "trousers"], ["dżins", "jeans"], ["dzins", "jeans"],
  ["spódnic", "skirt"], ["spodnic", "skirt"], ["kurtk", "jacket"], ["płaszcz", "coat"],
  ["plaszcz", "coat"], ["sweter", "sweater"], ["garnitur", "suit"], ["marynark", "blazer"],
  ["butów", "shoes"], ["butow", "shoes"], ["buty", "shoes"], ["botki", "boots"],
  ["kozak", "boots"], ["trampk", "sneakers"], ["torebk", "bag"], ["szalik", "scarf"],
  // Dutch
  ["overhemd", "shirt"], ["jurk", "dress"], ["broek", "trousers"], ["jasje", "jacket"],
  ["trui", "sweater"], ["schoen", "shoes"], ["laarz", "boots"],
  // Swedish
  ["klänning", "dress"], ["skjorta", "shirt"], ["byxor", "trousers"], ["kjol", "skirt"],
  ["jacka", "jacket"], ["kappa", "coat"], ["tröja", "sweater"], ["stövl", "boots"],
];

function wordsOf(text: string): string[] {
  return (text ?? "").toLowerCase().split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
}

/** The English garment words a European-language message names. */
function europeanGarmentWords(text: string): string[] {
  const out: string[] = [];
  for (const word of wordsOf(text)) {
    if (word.length < 4) continue;
    const hit = EUROPEAN_GARMENTS.find(([stem]) => word.startsWith(stem));
    if (hit) out.push(hit[1]);
  }
  return out;
}

/** The English term a garment type is searched by: its first Latin, strong term. */
function englishTerm(terms: readonly (string | RegExp)[]): string | undefined {
  for (const t of terms) {
    if (typeof t === "string" && !t.startsWith("~") && !/[Ѐ-ӿ]/.test(t)) return t;
  }
  return undefined;
}

// ── Who it is for ───────────────────────────────────────────────────────────

/**
 * Words a shopper uses to say who the clothes are for. Unlike the product-side
 * `readGender`, the singular counts here: "I'm a 47 year old man", "for a
 * woman", "я хлопець" are statements about the wearer. Latin words are whole
 * words; Cyrillic ones are stems.
 */
const WOMEN_WORDS = [
  "woman", "women", "womens", "womenswear", "female", "girl", "girls", "lady", "ladies",
  "wife", "femme", "femmes", "fille", "mujer", "chica", "donna", "ragazza",
  "frau", "damen", "kobieta", "kobiety", "damski", "damska", "dziewczyna", "vrouw", "dames", "kvinna",
];
const WOMEN_STEMS = [
  "женщин", "женск", "девушк", "девочк", "жінк", "жінц", "жіноч", "дівчин", "дівчат",
  "после родов", "після полог", "беременн", "вагітн",
  "вчительк", "учительниц", "юристк", "школярк", "школьниц", "студентк", "пенсіонерк", "пенсионерк",
  "femminil", "féminin", "feminin", "femenin", "kobiet",
];
const MEN_WORDS = [
  "man", "men", "mens", "menswear", "male", "guy", "guys", "husband",
  "homme", "hommes", "hombre", "uomo", "ragazzo", "mann", "herren", "mezczyzna", "mężczyzna",
  "facet", "chłopak", "meski", "męski", "heren", "herr",
];
const MEN_STEMS = [
  "мужчин", "мужск", "парень", "парн", "хлопець", "хлопц", "чоловік", "чоловіч", "мужик",
];

function hasWord(hay: string, words: string[]): boolean {
  return words.some((w) => hay.includes(` ${w} `));
}

function hasStem(hay: string, stems: string[]): boolean {
  return stems.some((s) => hay.includes(` ${s}`));
}

function readGender(text: string): StylistGender | null {
  const hay = ` ${(text ?? "").toLowerCase().replace(/['’`]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  const women = hasWord(hay, WOMEN_WORDS) || hasStem(hay, WOMEN_STEMS);
  const men = hasWord(hay, MEN_WORDS) || hasStem(hay, MEN_STEMS);
  if (women === men) return null; // neither, or both ("for me and my husband")
  return women ? "women" : "men";
}

// ── Budget ──────────────────────────────────────────────────────────────────

const CURRENCY_MARKERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(₴|грн\.?|грив\p{L}*|uah|hrn)$/u, "UAH"],
  [/^(\$|usd|dollars?|bucks?|долл?ар\p{L}*|бакс\p{L}*)$/u, "USD"],
  [/^(€|eur|euros?|евро|євро)$/u, "EUR"],
  [/^(£|gbp|pounds?|quid|фунт\p{L}*)$/u, "GBP"],
  [/^(zł|zl|pln|złot\p{L}*|zlot\p{L}*)$/u, "PLN"],
  [/^(sek|kr|kronor)$/u, "SEK"],
  [/^(chf)$/u, "CHF"],
  [/^(czk|kč)$/u, "CZK"],
  [/^(dkk)$/u, "DKK"],
  [/^(nok)$/u, "NOK"],
];

function currencyOf(token: string | undefined): string | null {
  if (!token) return null;
  const t = token.toLowerCase().replace(/[.,]+$/, "");
  for (const [re, code] of CURRENCY_MARKERS) if (re.test(t)) return code;
  return null;
}

/**
 * An amount with a currency next to it: "до 6000 грн", "€300", "300 €",
 * "maximal 400 Euro", "1 500 zł", "$250", "6к грн". A number with no currency
 * ("size 54", "47 years old", "Air Jordan 4") is not a budget. Several amounts
 * ("from 100 to 200 euros") → the largest, which is the limit.
 */
const AMOUNT =
  /(₴|\$|€|£)?\s?(\d{1,3}(?:[ \u00a0.,]\d{3})+|\d+(?:[.,]\d{1,2})?)(?:\s?(k|к|тыс\.?|тис\.?)(?!\p{L}))?\s?(₴|\$|€|£|\p{L}+\.?)?/giu;

function readBudgetAmount(text: string): { amount: number; currency: string } | null {
  let best: { amount: number; currency: string } | null = null;
  for (const m of (text ?? "").matchAll(AMOUNT)) {
    const currency = currencyOf(m[1]) ?? currencyOf(m[4]);
    if (!currency) continue;
    let amount = parsePrice(m[2].replace(/[ \u00a0]/g, ""));
    if (m[3]) amount *= 1000;
    if (!(amount >= 5)) continue;
    if (!best || amount > best.amount) best = { amount, currency };
  }
  return best;
}

// ── The whole request ───────────────────────────────────────────────────────

export async function readStylistIntent(text: string): Promise<StylistIntent> {
  const european = europeanGarmentWords(text);
  // Each translated word on its own: joined, "dress" + "shoes" would read as
  // the phrase "dress shoes".
  const types: GarmentType[] = [];
  for (const type of [...garmentsIn(text), ...european.flatMap((w) => garmentsIn(w))]) {
    if (!types.some((t) => t.id === type.id)) types.push(type);
  }

  const categories: string[] = [];
  const subcategories: string[] = [];
  const terms: string[] = [];
  for (const type of types) {
    if (!categories.includes(type.category)) categories.push(type.category);
    for (const label of type.labels) if (!subcategories.includes(label)) subcategories.push(label);
    const term = englishTerm(type.terms);
    if (term && !terms.includes(term)) terms.push(term);
  }
  for (const word of european) if (!terms.includes(word)) terms.push(word);

  let budget: StylistBudget | null = null;
  const raw = readBudgetAmount(text);
  if (raw) {
    const usd = await toUsd(raw.amount, raw.currency);
    if (usd) budget = { amount: raw.amount, currency: raw.currency, usd: Math.round(usd.usd) };
  }

  return {
    garments: types.map((t) => t.id),
    categories,
    subcategories,
    terms,
    gender: readGender(text),
    budget,
  };
}
