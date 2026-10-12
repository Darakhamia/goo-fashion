// Shim for src/lib/context/currency-context.tsx. The app fetches live exchange
// rates; the video shows US dollars only, formatted exactly as the app's
// applyFormat() formats USD: rounded to whole dollars, en-US grouping.
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatPrice(amount: number, _sourceCurrency?: string): string {
  return `$${fmt.format(Math.round(amount))}`;
}

const value = {
  currency: "USD" as const,
  setCurrency: () => {},
  formatPrice: (amount: number, sourceCurrency?: string) => formatPrice(amount, sourceCurrency),
  convertToUsd: (amount: number) => amount,
  canConvert: (c: string) => c.toUpperCase() === "USD",
};

export function useCurrency() {
  return value;
}
