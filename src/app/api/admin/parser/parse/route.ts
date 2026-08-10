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

// POST { url, useAi? } — fetch a page and return either a single product or, for
// a listing/category page, every product it contains (plus discovered links).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

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
  });

  return NextResponse.json(result);
}
