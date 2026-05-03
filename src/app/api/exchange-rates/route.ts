import { NextResponse } from "next/server";

const CODES = ["EUR", "GBP", "RUB", "AED", "JPY", "TRY"];
const FALLBACK = { EUR: 0.85, GBP: 0.74, RUB: 75, AED: 3.67, JPY: 157, TRY: 45 };

export async function GET() {
  try {
    const res = await fetch(
      "https://open.er-api.com/v6/latest/USD",
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`${res.status}`);
    const data: { result: string; rates: Record<string, number> } = await res.json();
    if (data.result !== "success") throw new Error("bad response");
    const rates = Object.fromEntries(
      CODES.map((c) => [c, data.rates[c]]).filter(([, v]) => v != null)
    );
    return NextResponse.json(rates, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json(FALLBACK, {
      headers: { "Cache-Control": "public, s-maxage=300" },
    });
  }
}
