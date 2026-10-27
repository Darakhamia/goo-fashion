import { NextResponse, after } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { isSupabaseConfigured } from "@/lib/supabase";
import { normalizeStyleKeywords } from "@/lib/style-keywords";
import { getAllColorGroups, readAllProducts } from "@/lib/data/db";
import { executeRun, listRuns, readiness, startRun } from "@/lib/server/ai-outfits/store";
import { MAX_OUTFITS, type RunInput } from "@/lib/server/ai-outfits/run";

/**
 * The studio's AI outfit generator (Outfits → Pending → Generate with AI).
 *
 *   GET   the latest runs with their progress, and whether a run can start
 *         (an OpenAI key, a Replicate token, migration 031)
 *   POST  { count, styles[], colorGroupIds[], brands[], gender, imageStyle }
 *         starts a run and answers at once; the run continues in the
 *         background and its outfits arrive in Pending as they are drawn.
 *
 * Empty styles, colours and brands leave the choice to the model; colours and
 * brands are a preference, not a filter (CEO, 2026-10-27). See
 * AI_ARCHITECTURE.md, "AI outfits".
 */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ?options=1 adds what the form chooses from: the catalogue's brands (most
  // pieces first) and the colour groups. The studio polls without it.
  const withOptions = new URL(req.url).searchParams.get("options") === "1";
  const [{ runs, tableMissing, error }, ready, options] = await Promise.all([
    listRuns(5),
    readiness(),
    withOptions ? formOptions() : Promise.resolve(null),
  ]);
  return NextResponse.json({
    runs,
    ready: { ...ready, database: isSupabaseConfigured && !tableMissing },
    ...(options && { options }),
    ...(error && !tableMissing && { error }),
  });
}

async function formOptions() {
  const [{ products }, colorGroups] = await Promise.all([readAllProducts(), getAllColorGroups()]);
  const counts = new Map<string, number>();
  for (const p of products) if (p.brand) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  const brands = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
  return { brands, colorGroups, maxOutfits: MAX_OUTFITS };
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured) return NextResponse.json({ error: "Database not configured." }, { status: 503 });

  const ready = await readiness();
  if (!ready.openai) return NextResponse.json({ error: "No OpenAI key: add one in Settings → OpenAI API Key." }, { status: 503 });
  if (!ready.replicate) return NextResponse.json({ error: "REPLICATE_API_TOKEN is not set, so pictures cannot be drawn." }, { status: 503 });

  const body = await req.json().catch(() => null);
  const count = Number(body?.count);
  if (!Number.isFinite(count) || count < 1 || count > MAX_OUTFITS) {
    return NextResponse.json({ error: `Ask for 1 to ${MAX_OUTFITS} outfits.` }, { status: 400 });
  }
  const input: RunInput = {
    count: Math.round(count),
    styles: normalizeStyleKeywords(body?.styles ?? []),
    colorGroupIds: (Array.isArray(body?.colorGroupIds) ? body.colorGroupIds : [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n))
      .slice(0, 6),
    brands: (Array.isArray(body?.brands) ? body.brands : [])
      .map((b: unknown) => String(b ?? "").trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 10),
    gender: body?.gender === "women" || body?.gender === "men" ? body.gender : null,
    imageStyle: body?.imageStyle === "flatlay" ? "flatlay" : "mannequin",
  };

  const started = await startRun(admin.userId, input);
  if ("error" in started) return NextResponse.json({ error: started.error }, { status: started.status });

  await logAdminAction({
    admin_id: admin.userId,
    action: "looks.ai_generated",
    target_id: started.id,
    target_type: "ai_outfit_run",
    metadata: { count: input.count, styles: input.styles, colorGroupIds: input.colorGroupIds, brands: input.brands, gender: input.gender },
  });

  // The pictures take minutes; the studio follows the run through GET.
  after(() => executeRun(started.id, admin.userId, input));
  return NextResponse.json({ id: started.id }, { status: 202 });
}
