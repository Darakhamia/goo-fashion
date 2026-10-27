import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { loadPendingLook, redrawPendingLook } from "@/lib/server/ai-outfits/review";

/**
 * POST { style: "mannequin" | "flatlay" } — draws a queued look's picture
 * again and keeps the new one (Outfits → Pending → review → Regenerate
 * picture). About a minute: one picture, as in the builder.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiToken = process.env.REPLICATE_API_TOKEN?.trim();
  if (!apiToken) {
    return NextResponse.json({ error: "REPLICATE_API_TOKEN is not set, so pictures cannot be drawn." }, { status: 503 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const style = body?.style === "flatlay" ? "flatlay" : "mannequin";

  const loaded = await loadPendingLook(id);
  if ("error" in loaded) return NextResponse.json({ error: loaded.error }, { status: loaded.status });

  const result = await redrawPendingLook(loaded.look, loaded.products, style, admin.userId, apiToken);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ imageUrl: result.imageUrl, style, persisted: result.persisted });
}
