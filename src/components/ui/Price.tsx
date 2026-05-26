"use client";

import { useCurrency } from "@/lib/context/currency-context";

interface PriceProps {
  amount: number;
  currency?: string;
  prefix?: string;
}

export default function Price({ amount, currency, prefix }: PriceProps) {
  const { formatPrice } = useCurrency();
  const formatted = formatPrice(amount, currency);
  return <>{prefix ? `${prefix}${formatted}` : formatted}</>;
}
