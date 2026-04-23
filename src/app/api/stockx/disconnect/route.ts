import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { clearStockXTokens } from "@/lib/server/stockx";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await clearStockXTokens();
  return NextResponse.json({ ok: true });
}
