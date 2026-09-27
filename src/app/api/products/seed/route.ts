import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// GET /api/products/seed — check if Supabase is configured (no data change).
// The POST that imported the static demo catalog into the live table is gone:
// one click poured two dozen stock-photo products with made-up prices into
// the storefront.
export async function GET() {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ configured: false }, { status: 501 });
  }
  return NextResponse.json({ configured: true });
}
