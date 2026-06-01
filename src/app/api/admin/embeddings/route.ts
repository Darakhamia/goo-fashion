/**
 * POST /api/admin/embeddings
 *
 * Generates and stores vector embeddings for all products that don't have one yet.
 * Safe to re-run — skips products that already have an embedding.
 * Requires admin auth.
 *
 * Response: { processed: number, skipped: number, errors: number }
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { embedText, productToEmbedText, EMBEDDING_DIMS } from "@/lib/server/replicate-ai";
import type { DbProduct } from "@/lib/supabase";

const BATCH_SIZE = 10; // embed 10 products at a time to avoid rate limits

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  // Fetch all products without an embedding
  const { data, error } = await supabase
    .from("products")
    .select("id, name, brand, category, description, style_keywords, price_min")
    .is("embedding", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Pick<
    DbProduct,
    "id" | "name" | "brand" | "category" | "description" | "style_keywords" | "price_min"
  >[];

  let processed = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (row) => {
        try {
          const text = productToEmbedText({
            name: row.name,
            brand: row.brand,
            category: row.category,
            description: row.description ?? undefined,
            styleKeywords: (row.style_keywords as string[]) ?? [],
            priceMin: row.price_min,
          });

          const embedding = await embedText(text);

          if (embedding.length !== EMBEDDING_DIMS) {
            throw new Error(`Expected ${EMBEDDING_DIMS} dims, got ${embedding.length}`);
          }

          const { error: updateError } = await supabase!
            .from("products")
            .update({ embedding: `[${embedding.join(",")}]` })
            .eq("id", row.id);

          if (updateError) throw updateError;
          processed++;
        } catch (err) {
          console.error(`[embeddings] Failed for product ${row.id}:`, err);
          errors++;
        }
      })
    );
  }

  return NextResponse.json({
    processed,
    skipped: 0,
    errors,
    total: rows.length,
  });
}

/**
 * GET /api/admin/embeddings
 * Returns count of products with/without embeddings.
 */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 500 });
  }

  const [{ count: total }, { count: embedded }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).not("embedding", "is", null),
  ]);

  return NextResponse.json({
    total: total ?? 0,
    embedded: embedded ?? 0,
    missing: (total ?? 0) - (embedded ?? 0),
  });
}
