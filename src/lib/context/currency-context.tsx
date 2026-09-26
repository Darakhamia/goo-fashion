"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CURRENCIES, withCurrencySymbol, type CurrencyCode } from "@/lib/currency";

// ── Supported currencies ───────────────────────────────────────────────────
// The table lives in lib/currency, where the server's meta prices read it too;
// re-exported for the components that import it from here.
export { CURRENCIES, type CurrencyCode, type CurrencyInfo } from "@/lib/currency";

// ── Format helper ──────────────────────────────────────────────────────────
// amount     – price in sourceCurrency (default "USD")
// currency   – target display currency
// rates      – USD-based rates: rates["GBP"] = 0.74 means 1 USD = 0.74 GBP
export function applyFormat(
  amount: number,
  currency: CurrencyCode,
  rates: Record<string, number>,
  sourceCurrency = "USD",
): string {
  const info = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];

  // Step 1: convert source → USD
  let usdAmount = amount;
  const src = sourceCurrency.toUpperCase();
  if (src !== "USD") {
    const srcRate = rates[src];
    if (srcRate && srcRate > 0) usdAmount = amount / srcRate;
  }

  // Step 2: convert USD → target
  const rate = currency === "USD" ? 1 : (rates[currency] ?? 1);
  const value = Math.round(usdAmount * rate);
  const numStr = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  return withCurrencySymbol(numStr, info);
}

// ── Cache keys ─────────────────────────────────────────────────────────────
const RATES_CACHE_KEY = "goo-exchange-rates";
const CURRENCY_KEY    = "goo-currency";
const CACHE_TTL       = 3_600_000; // 1 h

interface RateCache { rates: Record<string, number>; ts: number }

// Approximate fallback rates (USD base)
const FALLBACK_RATES: Record<string, number> = {
  EUR: 0.85, GBP: 0.74, UAH: 44, CZK: 21, JPY: 157, TRY: 45,
};

// ── Context ────────────────────────────────────────────────────────────────
interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  /** Format a price for display. Pass sourceCurrency when the amount is not in USD. */
  formatPrice: (amount: number, sourceCurrency?: string) => string;
  /** Normalize any amount to USD using current rates (useful for summing mixed-currency totals). */
  convertToUsd: (amount: number, sourceCurrency: string) => number;
  /**
   * Whether `convertToUsd` actually knows this currency. For one it does not,
   * that function hands the amount back unchanged — fine for summing a cart,
   * wrong for writing a catalogue price, which is where ₴4 000 becomes $4 000.
   */
  canConvert: (sourceCurrency: string) => boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency:      "USD",
  setCurrency:   () => {},
  formatPrice:   (n) => `$${n.toLocaleString()}`,
  convertToUsd:  (n) => n,
  canConvert:    (c) => c.toUpperCase() === "USD",
});

// ── Provider ───────────────────────────────────────────────────────────────
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [rates, setRates]           = useState<Record<string, number>>(FALLBACK_RATES);

  // Restore saved currency preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CURRENCY_KEY) as CurrencyCode | null;
      if (saved && CURRENCIES.some((c) => c.code === saved)) {
        setCurrencyState(saved);
      }
    } catch { /* ignore */ }
  }, []);

  // Fetch live rates (base USD), cache 1 h
  useEffect(() => {
    const load = async () => {
      try {
        const cached = localStorage.getItem(RATES_CACHE_KEY);
        if (cached) {
          const parsed: RateCache = JSON.parse(cached);
          if (Date.now() - parsed.ts < CACHE_TTL) {
            setRates(parsed.rates);
            return;
          }
        }
      } catch { /* ignore stale cache */ }

      try {
        const res = await fetch("/api/exchange-rates");
        if (!res.ok) throw new Error("rate fetch failed");
        const rates: Record<string, number> = await res.json();
        setRates(rates);
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates, ts: Date.now() } satisfies RateCache));
      } catch {
        setRates(FALLBACK_RATES);
      }
    };
    load();
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    try { localStorage.setItem(CURRENCY_KEY, c); } catch { /* ignore */ }
  }, []);

  const convertToUsd = useCallback(
    (amount: number, sourceCurrency: string): number => {
      const src = sourceCurrency.toUpperCase();
      if (src === "USD") return amount;
      const srcRate = rates[src];
      if (!srcRate || srcRate <= 0) return amount;
      return amount / srcRate;
    },
    [rates],
  );

  const canConvert = useCallback(
    (sourceCurrency: string): boolean => {
      const src = sourceCurrency.toUpperCase();
      return src === "USD" || (rates[src] ?? 0) > 0;
    },
    [rates],
  );

  const formatPrice = useCallback(
    (amount: number, sourceCurrency?: string) =>
      applyFormat(amount, currency, rates, sourceCurrency ?? "USD"),
    [currency, rates],
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, convertToUsd, canConvert }}>
      {children}
    </CurrencyContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useCurrency() {
  return useContext(CurrencyContext);
}
