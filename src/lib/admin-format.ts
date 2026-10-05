/*
 * Dates, money and counts in goo-studio, one format for all (GS4-6).
 *
 * - A date: "Oct 5, 2026" ("5 окт. 2026 г." in Russian). Always with the year.
 * - When something happened: relative within a week ("22h ago", "yesterday"),
 *   the date after that.
 * - Money: thousands grouped, cents only when the amount is not round
 *   ("$3,731", "$898.10"), three places under ten cents (AI costs: "$0.021"),
 *   the currency where the language puts it ("₴399", "399 ₴").
 * - A range: one value when both ends are the same ("$898.10", never
 *   "$898.1–$898.1").
 *
 * The locale follows the admin's language switcher. Pages call these through
 * `useFormat()` from `goo-studio/_i18n`, which passes the current language.
 * The site's own `formatPrice` (currency-context) is a different thing: it
 * converts into the visitor's currency, and is not used here.
 */

export type FormatLang = "en" | "ru";

const LOCALE: Record<FormatLang, string> = { en: "en-US", ru: "ru-RU" };

type DateInput = Date | string | number | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Oct 5, 2026"; "—" for no date. */
export function formatDate(value: DateInput, lang: FormatLang = "en"): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short", year: "numeric" });
}

/** "Oct 5, 2026, 2:20 PM" — for a log line or a run that happened at a moment. */
export function formatDateTime(value: DateInput, lang: FormatLang = "en"): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString(LOCALE[lang], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const WEEK = 7 * 86_400_000;

/**
 * When something happened: "now", "5m ago", "22h ago", "yesterday", "3d ago",
 * and the date once it is a week old. `never` for no date at all.
 */
export function formatWhen(value: DateInput, lang: FormatLang = "en", never = "—", now = Date.now()): string {
  const d = toDate(value);
  if (!d) return never;
  const diff = now - d.getTime();
  if (diff >= WEEK || diff < -60_000) return formatDate(d, lang);
  // Narrow English ("22h ago") reads well; narrow Russian is "-22 ч", so short there.
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: "auto", style: lang === "en" ? "narrow" : "short" });
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return rtf.format(0, "second");
  if (mins < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(diff / 3_600_000);
  if (hours < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(diff / 86_400_000), "day");
}

/** Places after the point: three under ten cents (an AI run's cost), else cents unless round. */
function moneyDigits(amount: number): number {
  if (amount !== 0 && Math.abs(amount) < 0.1) return 3;
  return Math.round(amount * 100) % 100 === 0 ? 0 : 2;
}

function money(amount: number, currency: string, lang: FormatLang, digits: number): string {
  try {
    return new Intl.NumberFormat(LOCALE[lang], {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    // A currency code Intl does not know, from a feed: the number and the code as they came.
    return `${amount.toLocaleString(LOCALE[lang], { maximumFractionDigits: digits })} ${currency}`;
  }
}

/** "$3,731", "$898.10", "$0.021", "₴399"; "—" for no amount. */
export function formatMoney(amount: number | null | undefined, currency = "USD", lang: FormatLang = "en"): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "—";
  return money(amount, currency, lang, moneyDigits(amount));
}

/**
 * "$216", "$898–$1,391", "$12.50–$40.00": one value when both ends are the
 * same, and both ends with cents when either has them.
 */
export function formatMoneyRange(min: number, max: number, currency = "USD", lang: FormatLang = "en"): string {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return formatMoney(Number.isFinite(min) ? min : max, currency, lang);
  const digits = Math.max(moneyDigits(min), moneyDigits(max));
  const a = money(min, currency, lang, digits);
  const b = money(max, currency, lang, digits);
  return a === b ? a : `${a}–${b}`;
}

/** "1,224" ("1 224" in Russian). */
export function formatNumber(n: number | null | undefined, lang: FormatLang = "en"): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(LOCALE[lang]);
}
