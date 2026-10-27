/**
 * Prices written into an outfit's own words, in the reader's currency.
 *
 * A look's suggested description ends "complete from $2,035 across leading
 * retailers", and it used to be written in the currency of whoever saved the
 * look: a shopper who reads prices in hryvnias stored "from 89,540 ₴", and
 * every reader of the catalogue then saw hryvnias, whatever they had chosen.
 * Names and descriptions people type themselves can carry a price too.
 *
 * So the text keeps the price as it was written, and the page that shows it
 * converts it to the reader's currency at the moment it is shown — the same
 * way every other price on the site is shown. This module finds the amounts
 * and leaves the formatting to the caller (the currency context's
 * `formatPrice`), so a converted price reads exactly like the prices around it.
 *
 * It recognises an amount with a sign or a code on either side of it — "$2,035",
 * "US$ 2,035", "2 035 €", "€1.870,50", "89,540 ₴", "1 200 грн", "USD 2035",
 * "2035 UAH" — and a dollar range, "$100–$200". A number with nothing beside
 * it ("3 pieces", "Y-3") is not money and stays as it is.
 */
import type { CurrencyCode } from "@/lib/currency";

/** Signs written before an amount, and the currency each one means. */
const PREFIX_SIGNS: Record<string, CurrencyCode> = {
  "US$": "USD", $: "USD", "£": "GBP", "€": "EUR", "¥": "JPY", "₴": "UAH", "₺": "TRY",
};

/** Signs and words written after an amount. */
const SUFFIX_SIGNS: Record<string, CurrencyCode> = {
  "€": "EUR", "₴": "UAH", "₺": "TRY", "Kč": "CZK", "£": "GBP", $: "USD", "грн": "UAH", "грн.": "UAH",
};

const CODES: readonly CurrencyCode[] = ["USD", "EUR", "GBP", "UAH", "CZK", "JPY", "TRY"];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Longest first, so "US$" is not read as "$" and "грн." not as "грн".
const alternation = (list: string[]) => [...list].sort((a, b) => b.length - a.length).map(escape).join("|");

/** An amount: 2035, 2,035, 2 035, 2.035, 1,870.50, 1 870,50. */
const NUM = String.raw`\d{1,3}(?:[,.   ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const CODE = CODES.join("|");
const BEFORE = `(?<![\\p{L}\\p{N}$])`;
const AFTER = `(?![\\p{L}\\p{N}])`;

const MONEY = new RegExp(
  [
    // A sign or a code before: "$2,035", "USD 2,035", "$100–$200", "$2,035 USD".
    `${BEFORE}(?<pre>${alternation(Object.keys(PREFIX_SIGNS))}|(?:${CODE})(?=[\\s\\u00a0]?\\d))[\\s\\u00a0]?(?<a>${NUM})` +
      `(?:[\\s\\u00a0]?[–—-][\\s\\u00a0]?(?:\\k<pre>)?[\\s\\u00a0]?(?<b>${NUM}))?` +
      `(?:[\\s\\u00a0](?<preCode>${CODE})${AFTER})?`,
    // A sign, word or code after: "2 035 €", "89,540 ₴", "1 200 грн", "2035 UAH".
    `${BEFORE}(?<c>${NUM})[\\s\\u00a0]?(?<post>${alternation(Object.keys(SUFFIX_SIGNS))}|${CODE})${AFTER}`,
  ].join("|"),
  "gu",
);

/** "2,035" → 2035, "1 870,50" → 1870.5, "1.870" → 1870: a trailing group of three is thousands. */
export function parseAmount(raw: string): number {
  const s = raw.replace(/[\s  ]/g, "");
  const decimal = /[.,](\d{1,2})$/.exec(s);
  const whole = (decimal ? s.slice(0, decimal.index) : s).replace(/[.,]/g, "");
  return Number(`${whole}${decimal ? `.${decimal[1]}` : ""}`);
}

function currencyOf(sign: string | undefined): CurrencyCode | undefined {
  if (!sign) return undefined;
  if ((CODES as readonly string[]).includes(sign)) return sign as CurrencyCode;
  return PREFIX_SIGNS[sign] ?? SUFFIX_SIGNS[sign];
}

/**
 * `text` with every amount in it written again by `format`, which gets the
 * amount and the currency it was written in. An amount already in `keep` —
 * the reader's own currency — stays exactly as typed, so "$29.90" is not
 * rounded to "$30" for someone who reads dollars anyway.
 */
export function localizeMoney(
  text: string,
  format: (amount: number, sourceCurrency: CurrencyCode) => string,
  keep?: CurrencyCode,
): string {
  if (!text || !/\d/.test(text)) return text;
  return text.replace(MONEY, (match, ...args) => {
    const g = args[args.length - 1] as Record<string, string | undefined>;
    const raw = g.a ?? g.c;
    const currency = currencyOf(g.preCode) ?? currencyOf(g.pre ?? g.post);
    if (!raw || !currency || currency === keep) return match;
    const first = parseAmount(raw);
    if (!Number.isFinite(first)) return match;
    const second = g.b ? parseAmount(g.b) : NaN;
    return Number.isFinite(second)
      ? `${format(first, currency)}–${format(second, currency)}`
      : format(first, currency);
  });
}
