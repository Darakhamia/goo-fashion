import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { fetchHtml } from "@/lib/server/parser/fetch";
import { extractProduct } from "@/lib/server/parser/extract";
import { normalizeExtract } from "@/lib/server/parser/normalize";
import {
  getFetchSettings,
  getFetchApiKey,
  getSiteConfigs,
  matchSiteConfig,
  effectiveFetchSettings,
} from "@/lib/server/parser/configs";

export const maxDuration = 60;

// POST { url } — fetch + extract + normalise a single product page (no DB write).
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  const [baseSettings, keyInfo, configs] = await Promise.all([
    getFetchSettings(),
    getFetchApiKey(),
    getSiteConfigs(),
  ]);

  const matched = matchSiteConfig(url, configs);
  const settings = effectiveFetchSettings(baseSettings, matched);

  const fetched = await fetchHtml(url, settings, keyInfo.key);

  const diagnostics = {
    provider: settings.provider,
    status: fetched.status,
    htmlLength: fetched.html.length,
    finalUrl: fetched.finalUrl,
    matchedConfig: matched ? { id: matched.id, name: matched.name, domain: matched.domain } : null,
  };

  if (!fetched.ok || !fetched.html) {
    return NextResponse.json({
      ok: false,
      error: fetched.error ?? "Failed to fetch page",
      diagnostics,
    });
  }

  const raw = extractProduct(fetched.html, matched);
  const product = normalizeExtract(raw, fetched.finalUrl || url, matched);

  return NextResponse.json({
    ok: true,
    product,
    diagnostics: { ...diagnostics, strategies: product.strategies },
  });
}
