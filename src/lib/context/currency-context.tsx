"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// ── Supported currencies ───────────────────────────────────────────────────
export type CurrencyCode = "USD" | "EUR" | "GBP" | "RUB" | "AED" | "JPY" | "TRY";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  position: "prefix" | "suffix";
  name: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$",   position: "prefix", name: "US Dollar" },
  { code: "EUR", symbol: "€",   position: "suffix", name: "Euro" },
  { code: "GBP", symbol: "£",   position: "prefix", name: "Pound" },
  { code: "RUB", symbol: "₽",   position: "suffix", name: "Ruble" },
  { code: "AED", symbol: "AED", position: "suffix", name: "Dirham" },
  { code: "JPY", symbol: "¥",   position: "prefix", name: "Yen" },
  { code: "TRY", symbol: "₺",   position: "suffix", name: "Lira" },
];

// ── Format helper — dots as thousands separator (European style) ────────────
export function applyFormat(usdAmount: number, currency: CurrencyCode, rates: Record<string, number>): string {
  const info = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
  const rate  = currency === "USD" ? 1 : (rates[currency] ?? 1);
  const value = Math.round(usdAmount * rate);
  // de-DE locale: 1.234.567 (dots thousands, comma decimal)
  const numStr = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
  return info.position === "prefix"
    ? `${info.symbol}${numStr}`
    : `${numStr} ${info.symbol}`;
}

// ── Cache keys ─────────────────────────────────────────────────────────────
const RATES_CACHE_KEY = "goo-exchange-rates";
const CURRENCY_KEY    = "goo-currency";
const CACHE_TTL       = 3_600_000; // 1 h

interface RateCache { rates: Record<string, number>; ts: number }

// Approximate fallback rates (USD base)
const FALLBACK_RATES: Record<string, number> = {
  EUR: 0.92, GBP: 0.79, RUB: 92, AED: 3.67, JPY: 156, TRY: 32,
};

// ── Context ────────────────────────────────────────────────────────────────
interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  formatPrice: (usdAmount: number) => string;
  ratesLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency:     "USD",
  setCurrency:  () => {},
  formatPrice:  (n) => `$${n.toLocaleString()}`,
  ratesLoading: false,
});

// ── Provider ───────────────────────────────────────────────────────────────
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");
  const [rates, setRates]           = useState<Record<string, number>>(FALLBACK_RATES);
  const [ratesLoading, setRatesLoading] = useState(false);

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

      setRatesLoading(true);
      try {
        const res = await fetch("/api/exchange-rates");
        if (!res.ok) throw new Error("rate fetch failed");
        const rates: Record<string, number> = await res.json();
        setRates(rates);
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates, ts: Date.now() } satisfies RateCache));
      } catch {
        setRates(FALLBACK_RATES);
      } finally {
        setRatesLoading(false);
      }
    };
    load();
  }, []);

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c);
    try { localStorage.setItem(CURRENCY_KEY, c); } catch { /* ignore */ }
  }, []);

  const formatPrice = useCallback(
    (usdAmount: number) => applyFormat(usdAmount, currency, rates),
    [currency, rates],
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice, ratesLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useCurrency() {
  return useContext(CurrencyContext);
}
