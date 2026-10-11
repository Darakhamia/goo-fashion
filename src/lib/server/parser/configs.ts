/**
 * Persistence + lookup for parser configuration.
 *
 * Everything lives in the existing `settings` key/value table (no new
 * migration), mirroring how the OpenAI key and prompt overrides are stored:
 *   - parser_site_configs    → JSON ParserSiteConfig[]
 *   - parser_ai_settings     → JSON ParserAiSettings
 */
import { supabase } from "@/lib/supabase";
import { DEFAULT_AI_SETTINGS } from "./types";
import type { ParserSiteConfig, ParserAiSettings } from "./types";

export const SETTING_CONFIGS = "parser_site_configs";
export const SETTING_AI = "parser_ai_settings";

/**
 * Seed recipes. Farfetch (and most luxury retailers) embed a schema.org Product
 * JSON-LD block, so the generic extractor already covers them — a recipe is only
 * needed for overrides. These ship enabled so the screen is useful out of the box.
 */
export const DEFAULT_SITE_CONFIGS: ParserSiteConfig[] = [
  {
    id: "farfetch",
    name: "Farfetch",
    domain: "farfetch.com",
    enabled: true,
    notes:
      "Farfetch ships full Product JSON-LD (name, brand, image[], offers). Generic extraction handles it; add regex rules only if a field is missed.",
  },
  {
    id: "ssense",
    name: "SSENSE",
    domain: "ssense.com",
    enabled: true,
    notes: "JSON-LD + OpenGraph. Usually parses with no overrides.",
  },
  {
    id: "mrporter",
    name: "Mr Porter",
    domain: "mrporter.com",
    enabled: true,
    notes: "Net-a-Porter group. JSON-LD Product present.",
  },
  {
    id: "example-single-brand",
    name: "Example — single-brand store",
    domain: "example.com",
    enabled: false,
    brandOverride: "Example Brand",
    notes:
      "Template: for a one-brand store, set Brand override and (optionally) a Gender override so every import is tagged correctly.",
  },
];

async function readSetting(key: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return (data as { value: string } | null)?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: "Database not configured" };
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  return { error: error?.message ?? null };
}

export async function getAiSettings(): Promise<ParserAiSettings> {
  const raw = await readSetting(SETTING_AI);
  if (!raw) return { ...DEFAULT_AI_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<ParserAiSettings>;
    return { ...DEFAULT_AI_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export async function saveAiSettings(settings: ParserAiSettings) {
  return writeSetting(SETTING_AI, JSON.stringify(settings));
}

export async function getSiteConfigs(): Promise<ParserSiteConfig[]> {
  const raw = await readSetting(SETTING_CONFIGS);
  if (!raw) return DEFAULT_SITE_CONFIGS;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ParserSiteConfig[]) : DEFAULT_SITE_CONFIGS;
  } catch {
    return DEFAULT_SITE_CONFIGS;
  }
}

export async function saveSiteConfigs(configs: ParserSiteConfig[]) {
  return writeSetting(SETTING_CONFIGS, JSON.stringify(configs));
}

/** Find the enabled recipe whose domain matches a URL's hostname. */
export function matchSiteConfig(url: string, configs: ParserSiteConfig[]): ParserSiteConfig | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  for (const c of configs) {
    if (!c.enabled || !c.domain) continue;
    const d = c.domain.toLowerCase().replace(/^www\./, "");
    if (host === d || host.endsWith(`.${d}`)) return c;
  }
  return null;
}
