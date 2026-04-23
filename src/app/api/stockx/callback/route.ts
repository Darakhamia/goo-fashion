import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.goo-fashion.com";
const REDIRECT_URI = `${APP_URL}/api/stockx/callback`;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:2rem">
        <b>StockX auth error:</b> ${error ?? "no_code"}
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
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
      redirect_uri: REDIRECT_URI,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(
      `<html><body style="font-family:monospace;padding:2rem">
        <b>Token exchange failed (${res.status}):</b><pre>${text}</pre>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const data = await res.json();
  const refreshToken: string = data.refresh_token ?? "";

  return new NextResponse(
    `<html><body style="font-family:monospace;padding:2rem;max-width:700px">
      <h2 style="margin-top:0">StockX — one-time setup complete</h2>
      <p>Copy the value below and add it as <b>STOCKX_REFRESH_TOKEN</b> in your Railway environment variables. You will never need to do this again.</p>
      <textarea rows="4" style="width:100%;font-family:monospace;font-size:13px;padding:8px" onclick="this.select()">${refreshToken}</textarea>
      <p style="color:#888;font-size:12px">Once added to Railway, redeploy and the StockX import page will work automatically.</p>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
