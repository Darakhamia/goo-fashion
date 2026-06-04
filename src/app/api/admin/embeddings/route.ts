import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { embedTextsOrThrow } from "@/lib/server/embeddings";

// ── POST /api/admin/embeddings ────────────────────────────────────────────────
// Backfills semantic embeddings for products that don't have one yet. Each call
// embeds one batch in a single OpenAI request — call it repeatedly (or in a
// loop) until `remaining` reaches 0. Admin-only.
//
// Body (optional): { batchSize?: number }  — defaults to 100, capped at 200.

const DEFAULT_BATCH = 100;
const MAX_BATCH = 200;

interface ProductRow {
  id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  description: string | null;
  style_keywords: string[] | null;
}

function buildEmbedText(p: ProductRow): string {
  return [
    p.name,
    p.brand,
    p.category,
    p.description,
    (p.style_keywords ?? []).join(" "),
  ]
    .filter(Boolean)
    .join(" — ");
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { batchSize?: number };
  const batchSize = Math.min(
    MAX_BATCH,
    Math.max(1, Number(body?.batchSize) || DEFAULT_BATCH)
  );

  // Fetch a batch of products that still need an embedding.
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, description, style_keywords")
    .is("embedding", null)
    .limit(batchSize);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ProductRow[];
  let processed = 0;
  let failed = 0;
  let firstError: string | undefined;

  if (rows.length > 0) {
    try {
      // One OpenAI call embeds the whole batch, then persist row by row.
      const vectors = await embedTextsOrThrow(rows.map(buildEmbedText));
      for (let i = 0; i < rows.length; i++) {
        const { error: updErr } = await supabase
          .from("products")
          .update({ embedding: vectors[i] })
          .eq("id", rows[i].id);
        if (updErr) { failed++; if (!firstError) firstError = `db update: ${updErr.message}`; continue; }
        processed++;
      }
    } catch (err) {
      failed = rows.length;
      firstError = err instanceof Error ? err.message : String(err);
    }
  }

  // How many are still missing an embedding after this batch?
  const { count: remaining } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .is("embedding", null);

  return NextResponse.json({
    processed,
    failed,
    batchSize,
    remaining: remaining ?? null,
    done: (remaining ?? 0) === 0,
    ...(firstError ? { firstError } : {}),
  });
}

// ── GET /api/admin/embeddings ─────────────────────────────────────────────────
// Reports coverage: how many products have / lack an embedding. Admin-only.

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const [{ count: total }, { count: missing }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).is("embedding", null),
  ]);

  const totalN = total ?? 0;
  const missingN = missing ?? 0;
  return NextResponse.json({
    total: totalN,
    withEmbedding: totalN - missingN,
    missing: missingN,
    coverage: totalN > 0 ? Math.round(((totalN - missingN) / totalN) * 100) : 0,
  });
}
