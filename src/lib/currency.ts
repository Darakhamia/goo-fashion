/**
 * The currencies prices are shown in: code, sign, and which side of the amount
 * the sign goes.
 *
 * One table for the currency switcher (client), the meta-tag and JSON-LD prices
 * (server) and the plan labels. Plain data and pure functions — no React, no
 * server imports — so any of them can import it.
 */

export type CurrencyCode = "USD" | "EUR" | "GBP" | "UAH" | "CZK" | "JPY" | "TRY";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  position: "prefix" | "suffix";
  name: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$",  position: "prefix", name: "US Dollar" },
  { code: "EUR", symbol: "€",  position: "suffix", name: "Euro" },
  { code: "GBP", symbol: "£",  position: "prefix", name: "Pound" },
  { code: "UAH", symbol: "₴",  position: "suffix", name: "Hryvnia" },
  { code: "CZK", symbol: "Kč", position: "suffix", name: "Koruna" },
  { code: "JPY", symbol: "¥",  position: "prefix", name: "Yen" },
  { code: "TRY", symbol: "₺",  position: "suffix", name: "Lira" },
];

/**
 * Approximate rates, USD base (units per 1 USD), that the storefront prices with
 * until the browser has fetched live ones — and for good where it cannot: the
 * server render and a crawler, for which /api/ is closed in robots.txt. So the
 * dollar figure in the page's first HTML is always amount ÷ these, which is
 * also what product JSON-LD states (lib/seo) to match it.
 *
 * Server-side imports convert with their own, larger table (lib/server/fx).
 */
export const DISPLAY_FALLBACK_RATES: Record<string, number> = {
  EUR: 0.85, GBP: 0.74, UAH: 44, CZK: 21, JPY: 157, TRY: 45,
};

/** The table's entry for an exact ISO code, or undefined for one it does not list. */
export function currencyInfo(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

/** The sign of a listed currency: "₴" for "UAH". */
export function currencySymbol(code: CurrencyCode): string {
  return currencyInfo(code)?.symbol ?? code;
}

/**
 * An already-formatted amount with the currency's sign in its conventional
 * place: "$120" before, "120 €" after (with a space).
 */
export function withCurrencySymbol(amount: string, currency: Pick<CurrencyInfo, "symbol" | "position">): string {
  return currency.position === "prefix" ? `${currency.symbol}${amount}` : `${amount} ${currency.symbol}`;
}
