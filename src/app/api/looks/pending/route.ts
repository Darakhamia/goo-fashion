import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

// The admin Outfits page loads this queue as it opens, so it is read with the
// columns the page shows and a ceiling on rows: a queue someone had flooded
// with large submissions made the response too big to load, and then nobody
// could moderate anything. Approved or rejected looks leave the queue, so the
// ceiling moves on as the queue is worked through.
const QUEUE_LIMIT = 100;
const QUEUE_COLUMNS =
  "id, created_at, generated_image, generated_style, pieces, total_price, style_keywords, status";
// Migration 017 added these. A database a step behind still opens the queue;
// the page shows no name for those rows, as it did before the columns existed.
const DETAIL_COLUMNS = "name, description, occasion, season";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json([]);
  }

  const readQueue = (columns: string) =>
    supabase!
      .from("pending_looks")
      .select(columns)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(QUEUE_LIMIT);

  let { data, error } = await readQueue(`${QUEUE_COLUMNS}, ${DETAIL_COLUMNS}`);
  // 42703: undefined column.
  if (error?.code === "42703") ({ data, error } = await readQueue(QUEUE_COLUMNS));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
