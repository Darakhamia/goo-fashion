/**
 * How the AI stylist reads a turn's request into a catalogue search: the text
 * to search with, whether it asks for a whole look, and the parameters for
 * `stylist_candidates` (migration 033).
 *
 * Kept apart from the chat route so the same reading can be checked against
 * real requests without a running server (a route file may export only its
 * handlers). What the request asks for — garments, gender, budget — is read in
 * `./intent`.
 */
import type { StylistIntent } from "./intent";

// ── RU→EN keyword mapping for multilingual FTS ───────────────────────────────

export const RU_TO_EN: Record<string, string> = {
  // brands
  адидас: "adidas", найк: "nike", гуччи: "gucci", прада: "prada",
  зара: "zara", шанель: "chanel", версаче: "versace", балансиага: "balenciaga",
  луивиттон: "louis vuitton", дольче: "dolce", армани: "armani", бурберри: "burberry",
  // clothing
  кроссовки: "sneakers", кеды: "sneakers", ботинки: "boots", туфли: "shoes",
  сапоги: "boots", лоферы: "loafers", мокасины: "moccasins",
  брюки: "pants", джинсы: "jeans", шорты: "shorts",
  рубашка: "shirt", блузка: "blouse", топ: "top",
  пальто: "coat", куртка: "jacket", плащ: "trench coat",
  свитер: "sweater", худи: "hoodie", толстовка: "hoodie", кардиган: "cardigan",
  платье: "dress", юбка: "skirt", футболка: "t-shirt",
  пиджак: "blazer", костюм: "suit", жилет: "vest",
  шарф: "scarf", шапка: "hat", перчатки: "gloves", сумка: "bag",
  // style
  спортивный: "sporty", классический: "classic", повседневный: "casual",
  элегантный: "elegant", минималистичный: "minimal", уличный: "streetwear",
};

// Occasion / intent → style vocabulary. Many requests name an occasion ("на
// свидание", "for the office") rather than a garment, so full-text search has
// nothing to match. We translate the intent into style terms that DO appear in
// product descriptions / keywords, which also gives the embedding query useful
// signal. Keyed by stem so declensions and EN/RU both hit.
export const OCCASION_STEMS: Array<{ stem: string; terms: string }> = [
  { stem: "свидан",   terms: "elegant romantic evening date" },
  { stem: "date",     terms: "elegant romantic evening" },
  { stem: "офис",     terms: "classic minimal tailored blazer office" },
  { stem: "работ",    terms: "classic minimal tailored office" },
  { stem: "office",   terms: "classic minimal tailored blazer" },
  { stem: "work",     terms: "classic minimal tailored" },
  { stem: "собесед",  terms: "classic professional tailored formal" },
  { stem: "interview",terms: "classic professional tailored formal" },
  { stem: "вечеринк",  terms: "statement bold evening party" },
  { stem: "party",    terms: "statement bold evening" },
  { stem: "спорт",    terms: "sporty athletic activewear" },
  { stem: "трениров", terms: "sporty athletic activewear gym" },
  { stem: "gym",      terms: "sporty athletic activewear" },
  { stem: "workout",  terms: "sporty athletic activewear" },
  { stem: "пляж",     terms: "coastal linen summer beach" },
  { stem: "отпуск",   terms: "coastal linen summer vacation" },
  { stem: "vacation", terms: "coastal linen summer" },
  { stem: "beach",    terms: "coastal linen summer" },
  { stem: "свадьб",   terms: "formal elegant suit dress wedding" },
  { stem: "wedding",  terms: "formal elegant suit dress" },
  { stem: "casual",   terms: "casual relaxed everyday" },
  { stem: "повседнев",terms: "casual relaxed everyday" },
  { stem: "зим",      terms: "warm coat knitwear winter" },
  { stem: "winter",   terms: "warm coat knitwear" },
  { stem: "лет",      terms: "light linen breathable summer" },
  { stem: "summer",   terms: "light linen breathable" },
  // Ukrainian
  { stem: "побачен",  terms: "elegant romantic evening date" },
  { stem: "співбесід",terms: "classic professional tailored formal" },
  { stem: "весілл",   terms: "formal elegant suit dress wedding" },
  { stem: "офіс",     terms: "classic minimal tailored blazer office" },
  { stem: "робот",    terms: "classic minimal tailored office" },
  { stem: "осін",     terms: "autumn coat jacket knitwear boots" },
  { stem: "осен",     terms: "autumn coat jacket knitwear boots" },
  { stem: "autumn",   terms: "coat jacket knitwear boots" },
  { stem: "літн",     terms: "light linen breathable summer" },
  { stem: "літо",     terms: "light linen breathable summer" },
  // Occasions without a garment word in any language
  { stem: "smart",    terms: "tailored classic minimal" },
  { stem: "reception",terms: "formal elegant tailored evening suit" },
  { stem: "embassy",  terms: "formal elegant tailored evening suit" },
  { stem: "gala",     terms: "formal elegant evening" },
  { stem: "cocktail", terms: "elegant evening" },
  { stem: "weekend",  terms: "casual relaxed everyday" },
  // German, French, Spanish, Italian, Polish, Dutch, Swedish
  { stem: "vorstellungsgespr", terms: "classic professional tailored formal" },
  { stem: "entretien",  terms: "classic professional tailored formal" },
  { stem: "entrevista", terms: "classic professional tailored formal" },
  { stem: "colloquio",  terms: "classic professional tailored formal" },
  { stem: "rozmow",     terms: "classic professional tailored formal" },
  { stem: "hochzeit",   terms: "formal elegant suit dress wedding" },
  { stem: "mariage",    terms: "formal elegant suit dress wedding" },
  { stem: "boda",       terms: "formal elegant suit dress wedding" },
  { stem: "matrimonio", terms: "formal elegant suit dress wedding" },
  { stem: "wesel",      terms: "formal elegant suit dress wedding" },
  { stem: "ślub",       terms: "formal elegant suit dress wedding" },
  { stem: "bruiloft",   terms: "formal elegant suit dress wedding" },
  { stem: "bröllop",    terms: "formal elegant suit dress wedding" },
  { stem: "büro",       terms: "classic minimal tailored blazer office" },
  { stem: "bureau",     terms: "classic minimal tailored blazer office" },
  { stem: "oficina",    terms: "classic minimal tailored blazer office" },
  { stem: "ufficio",    terms: "classic minimal tailored blazer office" },
  { stem: "biur",       terms: "classic minimal tailored blazer office" },
  { stem: "kantoor",    terms: "classic minimal tailored blazer office" },
  { stem: "aperitiv",   terms: "elegant evening minimal" },
  { stem: "apéro",      terms: "elegant evening minimal" },
  { stem: "abendessen", terms: "elegant evening" },
  { stem: "hiver",      terms: "warm coat knitwear winter" },
  { stem: "invierno",   terms: "warm coat knitwear winter" },
  { stem: "inverno",    terms: "warm coat knitwear winter" },
  { stem: "zim",        terms: "warm coat knitwear winter" },
  { stem: "wochenend",  terms: "casual relaxed everyday" },
];

export function augmentQuery(msg: string): string {
  const words = msg.toLowerCase().split(/[\s,.!?]+/);
  const extras: string[] = [];
  const seen = new Set<string>();
  for (const w of words) {
    const en = RU_TO_EN[w];
    if (en) extras.push(en);
    if (w.length < 3) continue;
    for (const { stem, terms } of OCCASION_STEMS) {
      if (w.startsWith(stem) && !seen.has(stem)) {
        seen.add(stem);
        extras.push(terms);
        break;
      }
    }
  }
  return extras.length > 0 ? `${msg} ${extras.join(" ")}` : msg;
}

// "Build me a look" intent — stems in several languages. When detected we fetch a balanced
// set across all core categories so the model has a top, bottom AND shoes to
// pick from, instead of whatever the keyword search happened to return.
export const LOOK_INTENT_STEMS = [
  "лук", "образ", "аутфит", "комплект", "собер", "собр", "ансамбл", "капсул",
  "look", "outfit", "complete", "build", "ensemble", "capsule",
  // "what should I wear": RU, UA, EN, DE; a look in FR, ES, PL
  "надеть", "одеть", "вдягн", "одягн", "wear", "anzieh", "tenue", "conjunto", "stylizac", "zestaw",
];

export function wantsFullLook(msg: string): boolean {
  const words = msg.toLowerCase().split(/[\s,.!?]+/);
  return words.some((w) => w.length >= 3 && LOOK_INTENT_STEMS.some((s) => w.startsWith(s)));
}

/**
 * The categories a whole look is made of, as the catalogue files them, for
 * stylist_candidates: jeans, shirts, skirts, blazers and bags are categories of
 * their own, and the older CORE_LOOK_CATEGORIES in the chat route (kept for the
 * fallback path) never asked for them.
 */
export const LOOK_CATEGORIES = [
  "tops", "shirts", "knitwear", "bottoms", "jeans", "skirts", "dresses",
  "footwear", "outerwear", "blazers", "bags", "accessories",
];

/**
 * The text a turn's request is read from: the message itself, or — for a short
 * follow-up that names no garment and no budget — the user's last two turns
 * with it, so "а подешевле?" still knows it was about a coat for €300.
 */
export function requestText(
  userMessage: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  hasOwnSignal: boolean
): string {
  if (hasOwnSignal || userMessage.length > 60) return userMessage;
  const prevUserTurns = history
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content.slice(0, 160));
  if (prevUserTurns.length === 0) return userMessage;
  return [...prevUserTurns, userMessage].join(" ");
}

/**
 * Words that say how the shopper asks, not what for. Full-text search ORs every
 * word of the request, so "look", "budget" or "need" would rank any product
 * that happens to have them in its name. Gender words are left out too: gender
 * is a filter, not something a product name should match on.
 */
export const SEARCH_NOISE = new Set([
  "look", "looks", "outfit", "outfits", "need", "want", "wanna", "show", "something", "anything",
  "help", "please", "budget", "total", "max", "maximum", "around", "under", "about", "cheap",
  "wear", "wearing", "clothes", "clothing", "style", "ideas", "idea", "recommend", "suggest",
  "euro", "euros", "eur", "dollar", "dollars", "usd", "uah", "pln", "gbp",
  "man", "men", "mens", "menswear", "woman", "women", "womens", "womenswear", "guy", "girl", "lady",
  "year", "years", "old", "size",
]);

export function ftsText(query: string): string {
  return query
    .split(/[^\p{L}\p{N}'-]+/u)
    .filter((w) => w && !/\d/.test(w) && !SEARCH_NOISE.has(w.toLowerCase()))
    .join(" ");
}

export interface CandidateParams {
  query_text: string;
  match_count: number;
  filter_categories: string[] | null;
  prefer_subcategories: string[] | null;
  max_price_usd: number | null;
  filter_gender: string | null;
  per_category: number;
  per_brand: number;
}

/**
 * The `stylist_candidates` arguments for one turn. Named garments narrow the
 * list to their categories; a request for a whole look adds every category a
 * look is made of; a request that names neither ("what's in fashion for a
 * woman of 62?") gets every category in turn.
 */
export function candidateParams(
  searchQuery: string,
  intent: StylistIntent,
  fullLook: boolean,
  gender: string | null
): CandidateParams {
  let categories: string[] | null = intent.categories.length ? [...intent.categories] : null;
  if (fullLook) {
    categories = [...new Set([...(categories ?? []), ...LOOK_CATEGORIES])];
  }
  const narrow = categories !== null && !fullLook;
  return {
    query_text: ftsText(searchQuery),
    match_count: fullLook ? 60 : 48,
    filter_categories: categories,
    prefer_subcategories: intent.subcategories.length ? intent.subcategories : null,
    max_price_usd: intent.budget?.usd ?? null,
    filter_gender: gender,
    per_category: narrow ? 12 : 5,
    per_brand: 3,
  };
}
