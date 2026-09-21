/**
 * Server-side currency normalisation for stored prices.
 *
 * Why this exists at all: a price is only comparable to another price when both
 * are on one scale. The catalogue holds prices in whatever the store charges in,
 * which is correct and must stay that way — a hryvnia price shown as dollars is
 * a lie about the product. But filtering, sorting and the stylist's budget all
 * need a single scale, so every row also carries `price_usd`.
 *
 * Why the rate is recorded rather than looked up at read time: a rate read later
 * makes yesterday's number change today, so the same query gives different
 * answers on different days and nothing in the catalogue is reproducible. The
 * rate used and the day it came from are written next to the converted amount,
 * so a number can always be explained.
 *
 * Why this is server-side and not in the extension: the extension runs on an
 * admin's machine. A rate fetched there would be that admin's rate at that
 * moment, so two admins importing the same store would write different USD
 * numbers for the same product. The extension reports what a page says; the
 * scale is decided here, once.
 */

/** How long a fetched rate table is reused. Rates move far slower than this. */
const TTL_MS = 3_600_000;

/**
 * Last-resort rates, USD base: `FALLBACK[X]` is how many X make one USD.
 *
 * Deliberately wider than the display currency list in `currency-context.tsx`:
 * a store may price in a currency we cannot yet *show*, and such a product
 * should still be filterable and sortable rather than silently mis-scaled.
 * Approximate by nature — the recorded `fxDate` is what tells a reader the
 * number came from a fallback rather than a live rate.
 */
const FALLBACK_RATES: Record<string, number> = {
  EUR: 0.85,
  GBP: 0.74,
  UAH: 44,
  CZK: 21,
  JPY: 157,
  TRY: 45,
  PLN: 3.6,
  SEK: 9.6,
  CHF: 0.79,
  CAD: 1.35,
  AUD: 1.48,
  DKK: 6.4,
  NOK: 10.5,
  RON: 4.3,
  HUF: 330,
  BGN: 1.66,
};

interface RateTable {
  rates: Record<string, number>;
  /** ISO date (YYYY-MM-DD) the table is attributed to. */
  date: string;
  /** True when the upstream call failed and `FALLBACK_RATES` is in use. */
  fallback: boolean;
  ts: number;
}

let cache: RateTable | null = null;
/** In-flight fetch, so a burst of imports makes one upstream call, not twenty. */
let inFlight: Promise<RateTable> | null = null;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fallbackTable(): RateTable {
  return { rates: FALLBACK_RATES, date: today(), fallback: true, ts: Date.now() };
}

async function fetchRates(): Promise<RateTable> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(String(res.status));
    const data: { result?: string; rates?: Record<string, number>; time_last_update_utc?: string } =
      await res.json();
    if (data.result !== "success" || !data.rates) throw new Error("bad response");
    // Prefer the day the upstream itself attributes the table to, so the stored
    // `fx_date` matches the rate rather than the moment we happened to ask.
    const stamped = data.time_last_update_utc ? Date.parse(data.time_last_update_utc) : NaN;
    const date = Number.isNaN(stamped) ? today() : new Date(stamped).toISOString().slice(0, 10);
    return { rates: data.rates, date, fallback: false, ts: Date.now() };
  } catch {
    return fallbackTable();
  }
}

async function rateTable(): Promise<RateTable> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache;
  if (!inFlight) {
    inFlight = fetchRates().then((t) => {
      cache = t;
      inFlight = null;
      return t;
    });
  }
  return inFlight;
}

export interface UsdPrice {
  /** The amount on the USD scale, rounded to cents. */
  priceUsd: number;
  /** Units of the source currency per one USD. Exactly 1 for USD itself. */
  fxRate: number;
  /** ISO date the rate is attributed to. */
  fxDate: string;
  /** True when a live rate was unavailable and an approximate one was used. */
  fallback: boolean;
}

/**
 * Put an amount on the USD scale, reporting the rate used so the result can be
 * stored and later explained.
 *
 * An unknown currency code is NOT silently treated as USD — that is the exact
 * failure this module exists to end (a 4 000 ₴ jacket entering the catalogue as
 * $4 000). Callers get `null` and must decide; the import path flags the product
 * for review rather than inventing a scale for it.
 */
export async function toUsd(amount: number, currency: string): Promise<UsdPrice | null> {
  const code = (currency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;

  const table = await rateTable();
  if (code === "USD") {
    return { priceUsd: round2(amount), fxRate: 1, fxDate: table.date, fallback: table.fallback };
  }

  const rate = table.rates[code];
  if (!rate || !(rate > 0)) return null;

  return {
    priceUsd: round2(amount / rate),
    fxRate: rate,
    fxDate: table.date,
    fallback: table.fallback,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Test seam: drop the cached table so a test can control what is fetched. */
export function __resetFxCache(): void {
  cache = null;
  inFlight = null;
}
