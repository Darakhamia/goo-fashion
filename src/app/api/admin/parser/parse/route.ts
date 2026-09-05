import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { parsePage } from "@/lib/server/parser/parse-page";
import {
  getFetchSettings,
  getFetchApiKey,
  getSiteConfigs,
  getAiSettings,
} from "@/lib/server/parser/configs";

export const maxDuration = 60;

/**
 * Largest pasted page we accept.
 *
 * The platform refuses a request body over ~4.5 MB before this route is even
 * entered, so the cap is here to answer with something an admin can act on
 * rather than an opaque platform error. The bookmarklet strips scripts, styles
 * and SVG before copying, which takes a typical retail page from megabytes to
 * a couple of hundred kilobytes, so hitting this means the strip did not run.
 */
const MAX_PASTED_HTML = 3_000_000;

// POST { url, html?, useAi? } — turn a page into products. `html` is markup the
// admin's own browser already has (bookmarklet or paste), used instead of
// fetching — the free way past a store that refuses us.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const html = typeof body?.html === "string" ? body.html : "";
  if (html.length > MAX_PASTED_HTML) {
    return NextResponse.json(
      {
        error: `Pasted page is ${Math.round(html.length / 1_000_000)} MB, over the ${MAX_PASTED_HTML / 1_000_000} MB limit. Use the bookmarklet — it strips scripts and styles before copying.`,
      },
      { status: 413 },
    );
  }

  const [fetchSettings, keyInfo, siteConfigs, aiSettings] = await Promise.all([
    getFetchSettings(),
    getFetchApiKey(),
    getSiteConfigs(),
    getAiSettings(),
  ]);

  const result = await parsePage(url, {
    fetchSettings,
    fetchApiKey: keyInfo.key,
    siteConfigs,
    aiSettings,
    useAi: typeof body?.useAi === "boolean" ? body.useAi : undefined,
    html: html || undefined,
  });

  return NextResponse.json(result);
}
