"use client";

import { useCurrency } from "@/lib/context/currency-context";

interface PriceProps {
  amount: number;
  prefix?: string;
}

export default function Price({ amount, prefix }: PriceProps) {
  const { formatPrice } = useCurrency();
  return <>{prefix ? `${prefix}${formatPrice(amount)}` : formatPrice(amount)}</>;
}
