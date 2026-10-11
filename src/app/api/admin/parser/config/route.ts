import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { logAdminAction } from "@/lib/server/audit";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getSiteConfigs,
  saveSiteConfigs,
  getAiSettings,
  saveAiSettings,
} from "@/lib/server/parser/configs";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { DEFAULT_AI_SETTINGS } from "@/lib/server/parser/types";
import type { ParserAiSettings, ParserSiteConfig } from "@/lib/server/parser/types";

async function buildState() {
  const [siteConfigs, aiSettings, openaiKey] = await Promise.all([
    getSiteConfigs(),
    getAiSettings(),
    getOpenAIKey(),
  ]);
  return {
    siteConfigs,
    aiSettings,
    // The AI fallback rides on the site's existing OpenAI key — the screen needs
    // to say whether one is actually there before promising AI extraction.
    openai: { configured: !!openaiKey },
  };
}

// GET — site recipes and the AI & images settings the extension's imports run on.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await buildState());
}

function sanitizeAiSettings(input: unknown): ParserAiSettings {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : DEFAULT_AI_SETTINGS.enabled,
    mode: o.mode === "always" ? "always" : "auto",
    downloadImages:
      typeof o.downloadImages === "boolean" ? o.downloadImages : DEFAULT_AI_SETTINGS.downloadImages,
  };
}

function sanitizeSiteConfigs(input: unknown): ParserSiteConfig[] | null {
  if (!Array.isArray(input)) return null;
  const out: ParserSiteConfig[] = [];
  for (const raw of input.slice(0, 200)) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const name = String(o.name ?? "").trim().slice(0, 80);
    const domain = String(o.domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").slice(0, 120);
    if (!name && !domain) continue;
    const rulesIn = (o.rules && typeof o.rules === "object" ? o.rules : {}) as Record<string, unknown>;
    const rules: ParserSiteConfig["rules"] = {};
    for (const [field, val] of Object.entries(rulesIn)) {
      const regex = (val && typeof val === "object" ? (val as Record<string, unknown>).regex : undefined);
      if (typeof regex === "string" && regex.trim()) {
        (rules as Record<string, { regex: string }>)[field] = { regex: regex.trim().slice(0, 500) };
      }
    }
    out.push({
      id: String(o.id ?? "").trim().slice(0, 60) || crypto.randomUUID(),
      name: name || domain,
      domain,
      enabled: !!o.enabled,
      brandOverride: o.brandOverride ? String(o.brandOverride).trim().slice(0, 80) : undefined,
      categoryOverride: o.categoryOverride ? (String(o.categoryOverride) as ParserSiteConfig["categoryOverride"]) : undefined,
      genderOverride: o.genderOverride ? (String(o.genderOverride) as ParserSiteConfig["genderOverride"]) : undefined,
      rules: Object.keys(rules).length ? rules : undefined,
      notes: o.notes ? String(o.notes).slice(0, 500) : undefined,
    });
  }
  return out;
}

// POST — partial update: any of { aiSettings, siteConfigs }.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const errors: string[] = [];

  if ("aiSettings" in body) {
    const { error } = await saveAiSettings(sanitizeAiSettings(body.aiSettings));
    if (error) errors.push(error);
  }

  if ("siteConfigs" in body) {
    const configs = sanitizeSiteConfigs(body.siteConfigs);
    if (!configs) errors.push("siteConfigs must be an array");
    else {
      const { error } = await saveSiteConfigs(configs);
      if (error) errors.push(error);
    }
  }

  if (errors.length) return NextResponse.json({ error: errors.join("; ") }, { status: 500 });

  try {
    const cc = await clerkClient();
    const adminUser = await cc.users.getUser(admin.userId);
    void logAdminAction({
      admin_id: admin.userId,
      admin_email: adminUser.emailAddresses[0]?.emailAddress,
      action: "parser.config_updated",
      target_type: "parser",
      metadata: { fields: Object.keys(body) },
    });
  } catch { /* non-critical */ }

  return NextResponse.json(await buildState());
}
