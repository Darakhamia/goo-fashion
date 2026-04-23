import { NextResponse } from "next/server";
import { storeStockXTokens, STOCKX_APP_URL, STOCKX_REDIRECT_URI } from "@/lib/server/stockx";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const adminUrl = `${STOCKX_APP_URL}/admin/stockx`;

  if (error || !code) {
    return NextResponse.redirect(
      `${adminUrl}?stockx_error=${encodeURIComponent(error ?? "no_code")}`
    );
  }

  const res = await fetch("https://accounts.stockx.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.STOCKX_CLIENT_ID ?? "",
      client_secret: process.env.STOCKX_CLIENT_SECRET ?? "",
      redirect_uri: STOCKX_REDIRECT_URI,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("StockX token exchange failed:", text);
    return NextResponse.redirect(`${adminUrl}?stockx_error=token_exchange_failed`);
  }

  const data = await res.json();
  await storeStockXTokens(data);

  return NextResponse.redirect(`${adminUrl}?stockx_connected=1`);
}
