import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { searchStockX } from "@/lib/server/stockx";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") ?? "40", 10);

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter q" }, { status: 400 });
  }

  if (!process.env.STOCKX_CLIENT_ID) {
    return NextResponse.json({ error: "StockX API not configured" }, { status: 503 });
  }

  try {
    const result = await searchStockX(query, page, pageSize);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("StockX search error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
