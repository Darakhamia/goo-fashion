/**
 * Bulk catalog collection: paste one URL, get products in the database.
 *
 * Split into two actions the admin screen drives in a loop, because a full crawl
 * cannot finish inside one serverless invocation:
 *
 *   discover — walk the listing (and its pagination) and return product URLs
 *   batch    — parse + import a handful of those URLs, with per-URL outcomes
 *
 * Keeping the loop on the client means live progress, a Stop button that works,
 * and no request that runs past `maxDuration`.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { clerkClient } from "@clerk/nextjs/server";
import { parsePage } from "@/lib/server/parser/parse-page";
import { discoverProductUrls } from "@/lib/server/parser/crawl";
import { importParsedProduct } from "@/lib/server/parser/import-product";
import {
  getFetchSettings,
  getFetchApiKey,
  getSiteConfigs,
  getAiSettings,
} from "@/lib/server/parser/configs";
import type { CrawlItemResult } from "@/lib/server/parser/types";

export const maxDuration = 60;

/** URLs handled per batch call — sized so a batch finishes inside maxDuration. */
const MAX_BATCH = 5;

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action === "batch" ? "batch" : "discover";

  const [fetchSettings, keyInfo, siteConfigs, aiSettings] = await Promise.all([
    getFetchSettings(),
    getFetchApiKey(),
    getSiteConfigs(),
    getAiSettings(),
  ]);

  // ── discover ───────────────────────────────────────────────────────────────
  if (action === "discover") {
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    const result = await discoverProductUrls(url, {
      fetchSettings,
      fetchApiKey: keyInfo.key,
      siteConfigs,
      limit: Math.max(1, Math.min(Number(body?.limit) || 60, 500)),
      maxPages: Math.max(1, Math.min(Number(body?.maxPages) || 1, 20)),
    });

    return NextResponse.json(result);
  }

  // ── batch ──────────────────────────────────────────────────────────────────
  const urls = (Array.isArray(body?.urls) ? body.urls : [])
    .filter((u: unknown): u is string => typeof u === "string" && /^https?:\/\//.test(u.trim()))
    .map((u: string) => u.trim())
    .slice(0, MAX_BATCH);

  if (!urls.length) return NextResponse.json({ error: "urls is required" }, { status: 400 });

  const useAi = typeof body?.useAi === "boolean" ? body.useAi : aiSettings.enabled;
  const mirrorImages =
    typeof body?.mirrorImages === "boolean" ? body.mirrorImages : aiSettings.downloadImages;
  const dryRun = body?.dryRun === true;

  const results: CrawlItemResult[] = [];

  for (const url of urls) {
    // A jittered gap between products of the same batch. Five page loads back
    // to back from one address is what a rate limiter is built to catch, and
    // being caught costs the run; a second spread across the batch does not.
    if (results.length) await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
    try {
      const parsed = await parsePage(url, {
        fetchSettings,
        fetchApiKey: keyInfo.key,
        siteConfigs,
        aiSettings,
        useAi,
      });

      const usedAi = (parsed.diagnostics.aiFields?.length ?? 0) > 0;

      if (!parsed.ok) {
        results.push({ url, status: "failed", reason: parsed.error ?? "Fetch failed", usedAi });
        continue;
      }

      const product = parsed.products[0];
      if (!product || !product.name) {
        results.push({
          url,
          status: "skipped",
          reason: parsed.diagnostics.aiError ?? "No product data found on the page",
          usedAi,
        });
        continue;
      }

      if (dryRun) {
        results.push({ url, status: "skipped", reason: "Dry run", name: product.name, usedAi });
        continue;
      }

      const imported = await importParsedProduct(
        product as unknown as Record<string, unknown>,
        product.sourceUrl || url,
        { mirrorImages },
      );

      if (!imported.ok) {
        results.push({ url, status: "failed", reason: imported.error, name: product.name, usedAi });
        continue;
      }

      results.push({
        url,
        status: imported.updated ? "updated" : "imported",
        productId: imported.productId ?? undefined,
        name: product.name,
        usedAi,
        imagesMirrored: imported.imagesMirrored ?? 0,
      });
    } catch (err) {
      results.push({
        url,
        status: "failed",
        reason: err instanceof Error ? err.message : "Unexpected error",
      });
    }
  }

  const imported = results.filter((r) => r.status === "imported").length;
  const updated = results.filter((r) => r.status === "updated").length;

  if (imported || updated) {
    revalidatePath("/goo-studio/products");
    revalidatePath("/");
    try {
      const cc = await clerkClient();
      const adminUser = await cc.users.getUser(admin.userId);
      void logAdminAction({
        admin_id: admin.userId,
        admin_email: adminUser.emailAddresses[0]?.emailAddress,
        action: "parser.crawl_batch",
        target_type: "product",
        metadata: { imported, updated, failed: results.length - imported - updated, urls: urls.length },
      });
    } catch { /* non-critical */ }
  }

  return NextResponse.json({ ok: true, results, imported, updated });
}
