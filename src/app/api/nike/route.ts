import { NextResponse } from "next/server";

const RAPIDAPI_HOST = "nike-api.p.rapidapi.com";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const page = searchParams.get("page") || "1";

  const apiKey = process.env.RAPIDAPI_NIKE_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RAPIDAPI_NIKE_KEY not set in environment" },
      { status: 503 }
    );
  }

  try {
    // Build URL — try search if query provided, otherwise fetch all products
    const url = query
      ? `https://${RAPIDAPI_HOST}/nike/products/search?query=${encodeURIComponent(query)}&page=${page}`
      : `https://${RAPIDAPI_HOST}/nike/products?page=${page}`;

    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": RAPIDAPI_HOST,
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Nike API error ${res.status}:`, text);
      return NextResponse.json(
        { error: `Nike API returned ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Nike API fetch error:", err);
    return NextResponse.json(
      { error: "Failed to reach Nike API" },
      { status: 500 }
    );
  }
}
