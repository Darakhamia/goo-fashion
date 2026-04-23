import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getStockXConnectionStatus } from "@/lib/server/stockx";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getStockXConnectionStatus();
  return NextResponse.json(status);
}
