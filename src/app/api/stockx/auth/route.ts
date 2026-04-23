import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { STOCKX_REDIRECT_URI } from "@/lib/server/stockx";

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
    redirect_uri: STOCKX_REDIRECT_URI,
    scope: "offline_access openid",
    audience: "gateway.stockx.com",
  });

  return NextResponse.redirect(
    `https://accounts.stockx.com/authorize?${params}`
  );
}
