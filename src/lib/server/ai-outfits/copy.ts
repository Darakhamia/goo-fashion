/**
 * The words of a generated outfit: kept, tidied, or replaced.
 *
 * The model is told the house style (Prompts → AI outfits → Names and
 * descriptions), and mostly follows it. What it gets wrong in practice is
 * known from the copy the site already shows: prices that go stale the day a
 * store changes one, a brand that is not in the outfit, "Casual Look", blurbs
 * that could describe any outfit, the odd emoji. So every name and
 * description is read again here:
 *
 *   tidied    quotes around it, emoji, hashtags, "!" — fixed in place;
 *   replaced  a price, another brand, Russian text, nothing about the pieces,
 *             too short or too long, a generic or duplicate name — standard
 *             wording built from the pieces and their colours is used instead
 *             ("Beige Coat, Black Trousers");
 *   noted     a superlative, the outfit's own brand in its name — kept, and
 *             shown to the moderator.
 *
 * Every replacement and note is stored with the look (`ai_meta.copy`), so the
 * review dialog says what was changed and why, and a pattern of replacements
 * says what the house style should tell the model next.
 */
import type { Season, StyleKeyword } from "@/lib/types";
import { containsMoney } from "@/lib/money-text";
import { isGenericName } from "@/lib/seo";
import { suggestLookDescription } from "@/lib/look-copy";
import { seasonsPhrase } from "@/lib/seasons";
import type { Candidate } from "./candidates";
import type { CheckedOutfit } from "./validate";

export interface CopyNote {
  field: "name" | "description";
  action: "replaced" | "tidied" | "noted";
  problem: string;
  /** What the model wrote, when it was changed. */
  original?: string;
}

export interface CheckedCopy {
  name: string;
  description: string;
  notes: CopyNote[];
}

export const NAME_MAX = 48;
export const NAME_MIN = 4;
export const DESCRIPTION_MIN = 60;
export const DESCRIPTION_MAX = 320;

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️]/gu;
const HASHTAG = /(^|\s)#[\p{L}\d_]+/gu;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const URL = /\bhttps?:\/\/|\bwww\./i;
/** Words that sell instead of describe. */
const SUPERLATIVES = /\b(perfect|must-have|ultimate|effortless(?:ly)?|iconic|stunning|flawless|you'?ll love)\b/i;
/** A name made only of these says nothing about the outfit. */
const GENERIC_WORDS = new Set([
  "casual", "minimal", "classic", "streetwear", "sporty", "everyday", "stylish", "chic", "cool", "smart",
  "modern", "simple", "basic", "new", "the", "a", "my", "look", "looks", "outfit", "outfits", "style", "fit", "fits",
  "vibe", "vibes", "edit", "set", "ai",
]);
/** Words that name no piece and no colour, left out when looking for one. */
const NOT_PIECE_WORDS = new Set(["look", "outfit", "style", "with", "and", "the", "for", "item", "piece", "pieces", "other", "unisex"]);

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const unquote = (s: string) => s.replace(/^["“”'‘’«»]+|["“”'‘’«»]+$/g, "").trim();

/** Brands named in `text` (exact spelling, whole word) that are not the outfit's. */
function otherBrands(text: string, outfitBrands: Set<string>, knownBrands: string[]): string[] {
  const out: string[] = [];
  for (const brand of knownBrands) {
    if (brand.length < 3 || outfitBrands.has(brand.toLowerCase())) continue;
    const re = new RegExp(`(^|[^\\p{L}\\d])${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^\\p{L}\\d])`, "u");
    if (re.test(text)) out.push(brand);
    if (out.length >= 3) break;
  }
  return out;
}

/** Words that name the outfit's pieces and colours: "coat", "jeans", "camel", "black". */
function pieceWords(outfit: CheckedOutfit): string[] {
  const words = new Set<string>();
  const add = (text: string | undefined) => {
    for (const w of (text ?? "").toLowerCase().split(/[^\p{L}]+/u)) {
      if (w.length >= 4 && !NOT_PIECE_WORDS.has(w)) words.add(w.endsWith("s") ? w.slice(0, -1) : w);
    }
  };
  for (const p of outfit.pieces) {
    const brandWords = new Set(p.product.brand.toLowerCase().split(/\s+/));
    add(p.product.subcategory);
    add(p.product.category);
    add(p.product.name.split(/\s+/).filter((w) => !brandWords.has(w.toLowerCase())).join(" "));
    for (const c of p.product.colors ?? []) add(c);
    for (const f of p.families) words.add(f);
  }
  for (const c of outfit.palette) add(c);
  return [...words];
}

export interface CopyContext {
  /** Every brand spelling in the catalogue, for "names another brand". */
  knownBrands: string[];
  /** Names taken by the catalogue, the queue and this batch, lower case. */
  takenNames: Set<string>;
}

// ── The standard wording, when the model's is not used ──────────────────────
//
// Built from the pieces themselves, so it is always true and always about this
// outfit: "Beige Coat, Black Trousers" and "A beige coat, a black blouse,
// black trousers and black loafers — a minimal outfit for autumn." The
// builder's suggestion (lib/look-copy) names brands and a price instead,
// which is right for a shopper's own look but not for the house style.

/** Garment words that are plural for one item. */
const PLURAL_ITEMS = new Set([
  "trousers", "jeans", "shorts", "pants", "leggings", "chinos", "joggers", "sweatpants", "tights",
  "sneakers", "shoes", "loafers", "boots", "sandals", "trainers", "heels", "mules", "flats", "slippers", "sunglasses",
]);

/** What a piece is, in one or two words: "coat", "trousers", "slip dress". */
function kindOf(c: Candidate): string {
  const raw = (c.product.subcategory || c.product.category || "piece").toLowerCase().trim();
  const last = raw.split(/\s+/).pop() ?? raw;
  if (PLURAL_ITEMS.has(last)) return raw;
  if (/sses$/.test(raw)) return raw.slice(0, -2);
  return raw.replace(/s$/, "");
}

const isPlural = (kind: string) => PLURAL_ITEMS.has(kind.split(/\s+/).pop() ?? kind);
const title = (s: string) => s.replace(/(^|[\s-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());

/** A piece as a phrase: "a beige coat", "black trousers", "an orange scarf". */
function phraseOf(c: Candidate, article: boolean): string {
  const colour = c.families.find((f) => f !== "multicolor") ?? (c.families.includes("multicolor") ? "multicolour" : "");
  const words = [colour, kindOf(c)].filter(Boolean).join(" ");
  if (!article || isPlural(kindOf(c))) return words;
  return `${/^[aeiou]/.test(words) ? "an" : "a"} ${words}`;
}

/** The pieces a sentence names: the main ones, accessories only in a short outfit. */
function namedPieces(outfit: CheckedOutfit): Candidate[] {
  const main = outfit.pieces.filter((p) => p.slot !== "accessory");
  return (main.length >= 4 ? main : outfit.pieces).slice(0, 4);
}

function fallbackName(outfit: CheckedOutfit, taken: Set<string>): string {
  const hero = outfit.pieces.find((p) => p.slot === "outerwear" || p.slot === "one_piece") ?? outfit.pieces.find((p) => p.slot === "top");
  const second = outfit.pieces.find((p) => p !== hero && (p.slot === "bottom" || p.slot === "top" || p.slot === "shoes"));
  const base = [hero, second].filter((p): p is Candidate => Boolean(p)).map((p) => title(phraseOf(p, false))).join(", ");
  const style = outfit.styles[0] ? title(outfit.styles[0]) : "";
  const tries = [base, style ? `${base}, ${style}` : base].filter((t) => t.length <= NAME_MAX);
  for (const t of tries) if (t && !taken.has(t.toLowerCase())) return t;
  const root = tries[0] || "Outfit";
  for (let n = 2; ; n++) if (!taken.has(`${root} ${n}`.toLowerCase())) return `${root} ${n}`;
}

function fallbackDescription(outfit: CheckedOutfit): string {
  const phrases = namedPieces(outfit).map((p) => phraseOf(p, true));
  const list = phrases.length > 1 ? `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}` : phrases[0] ?? "";
  const style = outfit.styles[0] ?? "";
  const when = seasonsPhrase(outfit.seasons as Season[]);
  const tail = `${/^[aeiou]/.test(style) ? "an" : "a"} ${[style, "outfit"].filter(Boolean).join(" ")}${when ? ` for ${when}` : " for every season"}`;
  const sentence = `${list.charAt(0).toUpperCase()}${list.slice(1)} — ${tail}.`;
  return sentence.length >= DESCRIPTION_MIN
    ? sentence
    : suggestLookDescription({
        brands: outfit.pieces.map((p) => p.product.brand),
        styleKeywords: outfit.styles as StyleKeyword[],
        pieceCount: outfit.pieces.length,
        seasons: outfit.seasons as Season[],
      });
}

/** Tidies what can be tidied; says what is wrong with the rest. */
function tidy(text: string, field: CopyNote["field"], notes: CopyNote[]): string {
  let out = collapse(unquote(collapse(text)));
  const before = out;
  out = collapse(out.replace(EMOJI, "").replace(HASHTAG, "$1"));
  out = out.replace(/!+/g, ".").replace(/\.{2,}/g, ".");
  if (field === "name") out = out.replace(/[.\s]+$/, "");
  if (out !== before) notes.push({ field, action: "tidied", problem: "quotes, emoji, hashtags or exclamation marks removed", original: before });
  return out;
}

export function checkCopy(outfit: CheckedOutfit, ctx: CopyContext): CheckedCopy {
  const notes: CopyNote[] = [];
  const outfitBrands = new Set(outfit.pieces.map((p) => p.product.brand.toLowerCase()));

  // ── Name ──
  const rawName = outfit.name ?? "";
  let name = tidy(rawName, "name", notes);
  const nameProblem = (() => {
    if (!name) return "empty";
    if (name.length > NAME_MAX) return `longer than ${NAME_MAX} characters`;
    if (name.length < NAME_MIN) return "too short";
    if (CYRILLIC.test(name)) return "not in English";
    if (containsMoney(name)) return "names a price";
    if (URL.test(name)) return "contains a link";
    if (/\bAI\b/.test(name)) return "says AI";
    const words = name.toLowerCase().split(/[^\p{L}\d]+/u).filter(Boolean);
    if (isGenericName(name) || words.every((w) => GENERIC_WORDS.has(w) || /^\d+$/.test(w))) return "generic";
    const others = otherBrands(name, outfitBrands, ctx.knownBrands);
    if (others.length) return `names a brand that is not in the outfit (${others.join(", ")})`;
    if (ctx.takenNames.has(name.toLowerCase())) return "same name as another outfit";
    return null;
  })();
  if (nameProblem) {
    notes.push({ field: "name", action: "replaced", problem: nameProblem, original: rawName });
    name = fallbackName(outfit, ctx.takenNames);
  } else {
    const own = [...outfitBrands].filter((b) => name.toLowerCase().includes(b));
    if (own.length) notes.push({ field: "name", action: "noted", problem: "names a brand (the house style says not to)" });
  }

  // ── Description ──
  const rawDescription = outfit.description ?? "";
  let description = tidy(rawDescription, "description", notes);
  const descriptionProblem = (() => {
    if (description.length < DESCRIPTION_MIN) return "too short";
    if (description.length > DESCRIPTION_MAX) return `longer than ${DESCRIPTION_MAX} characters`;
    if (CYRILLIC.test(description)) return "not in English";
    if (containsMoney(description)) return "names a price (it goes stale when a store changes one)";
    if (URL.test(description)) return "contains a link";
    const others = otherBrands(description, outfitBrands, ctx.knownBrands);
    if (others.length) return `names a brand that is not in the outfit (${others.join(", ")})`;
    const lower = description.toLowerCase();
    if (!pieceWords(outfit).some((w) => lower.includes(w))) return "says nothing about the pieces or their colours";
    return null;
  })();
  if (descriptionProblem) {
    notes.push({ field: "description", action: "replaced", problem: descriptionProblem, original: rawDescription });
    description = fallbackDescription(outfit);
  } else if (SUPERLATIVES.test(description)) {
    notes.push({ field: "description", action: "noted", problem: `a selling word ("${SUPERLATIVES.exec(description)![0]}")` });
  }

  return { name, description, notes };
}
