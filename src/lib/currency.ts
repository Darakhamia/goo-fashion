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
