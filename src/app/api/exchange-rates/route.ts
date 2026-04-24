import { NextResponse } from "next/server";

const CODES = "EUR,GBP,RUB,AED,JPY,TRY";
const FALLBACK = { EUR: 0.92, GBP: 0.79, RUB: 92, AED: 3.67, JPY: 156, TRY: 32 };

export async function GET() {
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=USD&to=${CODES}`,
      { next: { revalidate: 3600 } }   // cache 1 h on the server
    );
    if (!res.ok) throw new Error(`${res.status}`);
    const data: { rates: Record<string, number> } = await res.json();
    return NextResponse.json(data.rates, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
    });
  } catch {
    return NextResponse.json(FALLBACK, {
      headers: { "Cache-Control": "public, s-maxage=300" },
    });
  }
}
