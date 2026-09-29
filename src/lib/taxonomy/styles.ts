/**
 * The style dictionary: the words a product page uses that say what manner of
 * piece it is.
 *
 * The importer wrote `styleKeywords: []` for every product it had ever created:
 * the vocabulary existed, the pickers used it, and nothing filled it from a
 * page. The stylist reads these tags, so an empty column means a catalogue the
 * stylist cannot reason about beyond category and colour. `inferStyleKeywords`
 * fills it from the words a page already gives — the product's name, its
 * description, its material and the label the tree filed it under.
 *
 * Five styles, the whole vocabulary since 2026-09-29: casual, minimal, classic,
 * streetwear, sporty (`lib/style-keywords`). The eight dropped that day took
 * their words with them; a cargo pant or a lace blouse is simply not read as
 * any style now, rather than being forced into one of the five.
 *
 * Deliberately narrow. A style tag is a soft signal (a filter, a hint to the
 * stylist), so a missing one costs little and a wrong one teaches the stylist
 * something false about the piece. Words that name a garment rather than a
 * manner — "jacket", "dress", "hoodie", "jeans" — are not here, and neither are
 * colours: black is not a style. A garment word is here only where the garment
 * *is* the style: a tracksuit is sporty, a tuxedo classic. Casual in particular
 * is read only from words that say so ("casual", "everyday", "loungewear"): half
 * the catalogue could be called casual by its garment alone, and a tag every
 * piece carries filters nothing.
 *
 * Also left out on purpose: brand lines that borrow a style word ("Heritage",
 * "Classic" as a model name is kept — the old rules had it and it is usually
 * right), and words that are a style in one sentence and a fit note in the
 * next ("basic", "simple", "smart", "urban", "breathable", "relaxed").
 *
 * ── Term syntax ── the garment dictionary's, so one reading serves both:
 *
 *   English  words compared whole, hyphens and punctuation read as spaces; the
 *            last word may carry a plural "s"/"es" unless it ends in "!".
 *   Cyrillic each word is a stem matched at the start of a word ("повседневн"
 *            is повседневный, повседневная, повседневные); "!" makes it exact.
 *   RegExp   run against the same normalised text (lowercase, "ё" → "е",
 *            non-letters → single spaces, padded with a space at each end).
 *
 * Every term is word-bounded. The rules this replaces were one regex per style
 * with `\b` only at the two ends of a long alternation, so "lace" matched
 * "necklace", "shoe laces" and the brand Palace.
 */
import type { StyleKeyword } from "@/lib/types";
import { STYLE_KEYWORD_LIST } from "@/lib/style-keywords";
import { escapeRegExp, isCyrillic, normalize } from "@/lib/text";

type Term = string | RegExp;

export const STYLE_TERMS: Record<StyleKeyword, readonly Term[]> = {
  casual: [
    "casual", "casualwear", "casual wear", "everyday", "everyday wear", "daywear", "day wear",
    "off duty", "laid back", "easygoing", "easy going", "weekend", "leisure", "leisurewear",
    "lounge", "loungewear", "lounge wear", "relaxed style", "relaxed look",
    "кэжуал", "кежуал", "повседневн", "на каждый день", "на выходн", "для отдыха",
    "расслабленн стил", "домашн одежд",
    "повсякденн", "на кожен день", "на вихідн", "для відпочинку",
  ],
  minimal: [
    "minimal", "minimalist", "minimalism", "minimalistic", "understated", "clean line", "clean lines",
    "essential", "essentials", "pared back", "sleek", "no logo", "logo free", "logoless", "unbranded",
    "monochrome", "monochromatic", "streamlined", "scandi", "scandinavian", "japandi",
    "capsule wardrobe", "unadorned", "stripped back", "clean design", "clean silhouette",
    "minimal design", "quiet design", "without logo",
    "минимализ", "минималист", "лаконичн", "без лишн", "сдержанн",
    "скандинавск", "без логотип", "монохром", "чистый силуэт", "чистые линии",
    "мінімаліз", "мінімаліст", "лаконічн", "стриман", "скандинавськ",
  ],
  classic: [
    "classic", "timeless", "tailored", "tailoring", "refined", "elegant", "elegance",
    "trench", "loafer", "double breasted", "single breasted", "pocket square", "cufflink",
    "chesterfield", "sophisticated", "formal", "formalwear", "black tie", "tuxedo",
    "dinner jacket", "savile row", "bespoke", "made to measure", "old money", "quiet luxury",
    "gentleman", "gentlemen", "evening wear", "eveningwear", "wardrobe staple",
    "классическ", "классика!", "вне времени", "элегантн", "изысканн", "утонченн", "строг стил", "делов", "двубортн", "однобортн", "тренч", "лофер", "смокинг", "вечерн",
    "олд мани", "тихая роскош", "тихой роскош",
    "класичн", "класика!", "елегантн", "вишукан", "ділов", "двобортн", "смокінг", "вечірн",
  ],
  streetwear: [
    "streetwear", "street wear", "street style", "streetstyle", "skate", "skater", "skateboard",
    "skateboarding", "skatewear", "graffiti", "graphic tee", "graphic print", "graphic t shirt",
    "graphic hoodie", "hype", "hypebeast", "box logo", "puff print", "hip hop", "rap tee",
    "oversized graphic", "streetwise", "sneakerhead", "bmx",
    "стритвир", "стрит стайл", "уличн стил", "уличн мод", "скейт", "граффити", "хип хоп", "хайп",
    "вуличн стил", "вуличн мод", "графіті",
  ],
  sporty: [
    "sport", "sporty", "sportswear", "sports wear", "athletic", "athleisure", "performance",
    "running", "training", "track suit", "tracksuit", "track top",
    "track jacket", "track pant", "track trouser", "activewear", "active wear", "gym", "workout",
    "basketball", "football", "soccer", "tennis", "golf", "yoga", "pilates", "jogging", "jogger",
    "moisture wicking", "sweat wicking", "wicking", "dri fit", "drifit", "climalite", "aeroready",
    "heat rdy", "compression", "racing", "cycling", "marathon", "sweatband", "warm up", "sideline",
    "team kit", "matchday", "fitness", "crossfit", "hiit", "trail running", "ski", "skiing",
    "snowboard", "snowboarding", "swim training", "baseball", "volleyball", "badminton", "boxing",
    "martial art", "retro sport",
    "спорт", "спортивн", "атлетич", "атлетическ", "бегов", "для бега", "тренировоч", "фитнес", "пилатес", "баскетбол", "футбольн", "теннисн", "волейбол", "велосипедн",
    "велосипедк", "лыжн", "сноуборд", "для зала", "спорткостюм", "олимпийк", "компрессион", "йога!", "йоги!", "йогу!", "для йоги", "бокса!", "для бокса",
    "біг!", "бігов", "тренуван", "фітнес", "тенісн", "лижн",
  ],
};

// ── Matching ─────────────────────────────────────────────────────────────────

function compileWordTerm(raw: string): string {
  const cyrillic = isCyrillic(raw);

  const words: { text: string; exact: boolean }[] = [];
  for (const token of raw.toLowerCase().replace(/ё/g, "е").split(/\s+/).filter(Boolean)) {
    const exact = token.endsWith("!");
    const parts = (exact ? token.slice(0, -1) : token)
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
    parts.forEach((text, i) => words.push({ text, exact: exact && i === parts.length - 1 }));
  }

  const pattern = words.map(({ text, exact }, i) => {
    const word = escapeRegExp(text);
    if (cyrillic) return exact ? word : `${word}\\p{L}*`;
    return i === words.length - 1 && !exact ? `${word}(?:e?s)?` : word;
  });
  return ` ${pattern.join(" ")}(?= )`;
}

/**
 * One expression per style, its terms as alternatives: five passes over a
 * description instead of several hundred. The catalogue profile reads every
 * product's description with these, and did so in two seconds per three
 * thousand products one term at a time.
 */
const COMPILED: [StyleKeyword, RegExp][] = (Object.entries(STYLE_TERMS) as [StyleKeyword, readonly Term[]][])
  .map(([style, terms]) => {
    const alternatives = terms.map((term) => (term instanceof RegExp ? term.source : compileWordTerm(term)));
    return [style, new RegExp(`(?:${alternatives.join("|")})`, "u")];
  });

/** The first term of each style found in `text` — for "why was this tagged" answers. */
export function styleEvidence(text: string): Partial<Record<StyleKeyword, string>> {
  const hay = normalize(text);
  const out: Partial<Record<StyleKeyword, string>> = {};
  for (const [style, re] of COMPILED) {
    if (out[style]) continue;
    const m = re.exec(hay);
    if (m) out[style] = m[0].trim();
  }
  return out;
}

/**
 * The styles a product's own words imply, at most `max` of them.
 *
 * Returned in the vocabulary's order rather than the order they were found, so
 * two products tagged with the same pair read the same way — the same rule
 * `normalizeStyleKeywords` follows.
 */
export function inferStyleKeywords(text: string, max = 3): StyleKeyword[] {
  if ((text ?? "").trim().length < 3) return [];
  const found = new Set(Object.keys(styleEvidence(text)) as StyleKeyword[]);
  if (!found.size) return [];
  return STYLE_KEYWORD_LIST.filter((k) => found.has(k)).slice(0, max);
}
