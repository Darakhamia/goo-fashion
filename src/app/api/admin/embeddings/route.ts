import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { embedTextOrThrow } from "@/lib/server/replicate-ai";

// ── POST /api/admin/embeddings ────────────────────────────────────────────────
// Backfills semantic embeddings for products that don't have one yet. Processes
// a bounded batch per call so the request can't time out — call it repeatedly
// (or in a loop) until `remaining` reaches 0. Admin-only.
//
// Body (optional): { batchSize?: number }  — defaults to 25, capped at 100.

const DEFAULT_BATCH = 25;
const MAX_BATCH = 100;

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
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ error: "REPLICATE_API_TOKEN is missing." }, { status: 503 });
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
  let throttled = false;
  let retryAfter = 0;

  for (const row of rows) {
    try {
      const vec = await embedTextOrThrow(buildEmbedText(row));
      const { error: updErr } = await supabase
        .from("products")
        .update({ embedding: vec })
        .eq("id", row.id);
      if (updErr) throw new Error(`db update: ${updErr.message}`);
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Replicate throttles low-credit accounts hard (429). That's not a data
      // failure — stop the batch and tell the client how long to wait so the
      // already-embedded rows are kept and the run can resume.
      if (/\b429\b|too many requests|throttl/i.test(msg)) {
        throttled = true;
        retryAfter = parseRetryAfter(msg);
        break;
      }
      failed++;
      if (!firstError) firstError = msg;
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
    ...(throttled ? { throttled, retryAfter } : {}),
    ...(firstError ? { firstError } : {}),
  });
}

/** Pull a sane wait (seconds) out of a Replicate 429 message; default 5, cap 30. */
function parseRetryAfter(msg: string): number {
  const m =
    msg.match(/retry_after"?\s*[:=]\s*(\d+)/i) ||
    msg.match(/resets?\s+in\s+~?(\d+)\s*s/i);
  const n = m ? parseInt(m[1], 10) : 5;
  return Math.min(30, Math.max(1, n));
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
