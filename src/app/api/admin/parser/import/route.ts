import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { clerkClient } from "@clerk/nextjs/server";
import { importParsedProduct } from "@/lib/server/parser/import-product";
import { getAiSettings } from "@/lib/server/parser/configs";

export const maxDuration = 60;

// POST { product, sourceUrl, mirrorImages? } — insert/update one parsed product
// (dedupe by source_url). Photos are mirrored into our storage by default.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const p = body?.product;
  if (!p || typeof p !== "object") {
    return NextResponse.json({ error: "product is required" }, { status: 400 });
  }

  const aiSettings = await getAiSettings();
  const mirrorImages =
    typeof body?.mirrorImages === "boolean" ? body.mirrorImages : aiSettings.downloadImages;

  const result = await importParsedProduct(p, body?.sourceUrl, { mirrorImages });

  if (!result.ok) {
    const status = result.error === "Database not configured" ? 501
      : result.error === "Product name is required" ? 400
      : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  try {
    const cc = await clerkClient();
    const adminUser = await cc.users.getUser(admin.userId);
    void logAdminAction({
      admin_id: admin.userId,
      admin_email: adminUser.emailAddresses[0]?.emailAddress,
      action: "parser.product_imported",
      target_id: result.productId ?? undefined,
      target_type: "product",
      metadata: {
        sourceUrl: body?.sourceUrl ?? null,
        updated: result.updated,
        name: String(p.name ?? ""),
        imagesMirrored: result.imagesMirrored ?? 0,
      },
    });
  } catch { /* non-critical */ }

  revalidatePath("/goo-studio/products");
  revalidatePath("/");

  return NextResponse.json({
    ok: true,
    productId: result.productId,
    updated: result.updated,
    imagesMirrored: result.imagesMirrored ?? 0,
    imagesFailed: result.imagesFailed ?? 0,
  });
}
