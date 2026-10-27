"use client";

import { useCallback } from "react";
import { useCurrency } from "@/lib/context/currency-context";
import { localizeMoney } from "@/lib/money-text";

/**
 * Text with any price written into it shown in the reader's currency
 * (lib/money-text): for outfit and look names and descriptions, which carry
 * the price in whatever currency they were written in.
 *
 * The server and the first client render both read dollars, like every other
 * price on the site, so the two agree; the reader's own currency follows a
 * moment later, when the currency context has read it.
 */
export function useMoneyText(): (text: string) => string {
  const { currency, formatPrice } = useCurrency();
  return useCallback((text: string) => localizeMoney(text, formatPrice, currency), [currency, formatPrice]);
}

export default function MoneyText({ text }: { text: string }) {
  return <>{useMoneyText()(text)}</>;
}
