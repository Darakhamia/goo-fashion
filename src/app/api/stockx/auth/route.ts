import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";

const APP_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.goo-fashion.com";
const REDIRECT_URI = `${APP_URL}/api/stockx/callback`;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.STOCKX_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "STOCKX_CLIENT_ID not configured" }, { status: 503 });
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: "offline_access openid",
    audience: "gateway.stockx.com",
  });

  return NextResponse.redirect(`https://accounts.stockx.com/authorize?${params}`);
}
