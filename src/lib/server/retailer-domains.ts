/**
 * Per-domain retailer rules: what a shop is called, and whether it is the
 * brand's own shop.
 *
 * Without a rule both facts are guesses made from the link. The name is the
 * host's second-to-last label with a capital letter bolted on, and "official
 * store" is true when the host happens to contain the brand's letters. Those
 * guesses are right often enough to be worth keeping as a fallback and wrong
 * often enough that an admin needs somewhere to overrule them — which is what
 * `retailer_domains` is. A rule is stored once per domain and applies to every
 * product imported from it afterwards.
 */
import { supabase } from "@/lib/supabase";
import { storeNameFromUrl, isOfficialStore } from "@/lib/server/product-fields";
import type { Gender } from "@/lib/types";

// Re-exported: the retailer-domains route reads "table not there yet" from here.
export { isMissingTable } from "@/lib/server/db-errors";

/**
 * The table is there but predates `default_gender` (migration 022). PostgREST
 * says PGRST204 for a column missing from its cache, Postgres 42703.
 */
export const MISSING_COLUMN_CODES = new Set(["PGRST204", "42703"]);
export const MISSING_GENDER_COLUMN_MESSAGE =
  "Saving a store's gender needs supabase/migrations/022_retailer_default_gender.sql — run it, then save again.";

/**
 * What to show instead of PostgREST's "could not find the table … in the schema
 * cache", which tells an admin nothing: the actual next action.
 */
export const MISSING_TABLE_MESSAGE =
  "The retailer_domains table does not exist yet — run supabase/migrations/018_retailer_domains.sql, then reload this page.";

export interface RetailerRule {
  domain: string;
  name: string;
  isOfficial: boolean;
  /**
   * Who this store's pieces are for when a page does not say — its "All"
   * section's convention. Unset means the store has no stated convention.
   */
  defaultGender?: Gender;
  note?: string;
  updatedAt?: string;
}

const GENDERS: readonly string[] = ["men", "women", "unisex"];

/** A gender value as stored, or undefined for anything else. */
export function parseStoreGender(value: unknown): Gender | undefined {
  return typeof value === "string" && GENDERS.includes(value) ? (value as Gender) : undefined;
}

/**
 * How long a loaded rule set is reused.
 *
 * A bulk import resolves thousands of links in a row and must not make a
 * database round trip per link; an admin who has just fixed a name should not
 * have to wait long to see it take. A minute serves both — it collapses an
 * entire crawl into one read, and no edit is stale for longer than that.
 */
const CACHE_TTL_MS = 60_000;

let cache: { rules: Map<string, RetailerRule>; at: number } | null = null;

/** Bare, lowercase host with any leading "www." removed. */
export function normalizeDomain(value: string): string {
  const raw = (value ?? "").trim().toLowerCase();
  if (!raw) return "";
  // Accept a pasted URL as readily as a bare domain — an admin copying from the
  // address bar should not have to trim it by hand.
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const host = withoutScheme.split("/")[0].split("?")[0].split("#")[0];
  return host.replace(/^www\./, "").replace(/\.$/, "");
}

/** The host of a product link, in the same shape rules are keyed by. */
export function domainFromUrl(url: string): string {
  try {
    return normalizeDomain(new URL(url).hostname);
  } catch {
    return "";
  }
}

/**
 * Candidate keys for a host, longest first: "uk.farfetch.com" before
 * "farfetch.com". A rule therefore matches a subdomain when one was entered for
 * it, and otherwise falls back to the parent domain.
 *
 * Deliberately no public-suffix list. The candidates are only ever compared
 * against domains an admin actually typed, so "asos.co.uk" matches its own rule
 * and the nonsensical "co.uk" candidate simply never matches anything.
 */
export function domainCandidates(host: string): string[] {
  const parts = normalizeDomain(host).split(".").filter(Boolean);
  if (parts.length < 2) return parts.length ? [parts.join(".")] : [];
  const out: string[] = [];
  for (let i = 0; i <= parts.length - 2; i++) out.push(parts.slice(i).join("."));
  return out;
}

function rowToRule(r: Record<string, unknown>): RetailerRule {
  return {
    domain: String(r.domain ?? ""),
    name: String(r.name ?? ""),
    isOfficial: r.is_official === true,
    defaultGender: parseStoreGender(r.default_gender),
    note: (r.note as string | null) ?? undefined,
    updatedAt: (r.updated_at as string | null) ?? undefined,
  };
}

/**
 * Every rule, keyed by domain.
 *
 * A database without the table yet (migration 018 not run) is not an error
 * here: it means "no rules", and resolution falls back to the guesses it used
 * before this feature existed. An import must never fail because an optional
 * table is missing.
 */
export async function loadRetailerRules(force = false): Promise<Map<string, RetailerRule>> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rules;
  const rules = new Map<string, RetailerRule>();
  if (supabase) {
    try {
      const { data, error } = await supabase.from("retailer_domains").select("*");
      if (!error) {
        for (const row of data ?? []) {
          const rule = rowToRule(row as Record<string, unknown>);
          if (rule.domain) rules.set(rule.domain, rule);
        }
      }
    } catch {
      // Unreachable database — fall through with no rules rather than throwing
      // into the middle of an import.
    }
  }
  cache = { rules, at: Date.now() };
  return rules;
}

/** Drop the cache so the next read sees a just-saved edit immediately. */
export function invalidateRetailerRules(): void {
  cache = null;
}

/** Rows per request: PostgREST answers at most 1000 rows unless told otherwise. */
const SCAN_PAGE = 1000;

/** Safety ceiling on a catalogue scan; reaching it is reported, never silent. */
export const RETAILER_SCAN_MAX = 50_000;

export interface ProductRetailersRow {
  id: string;
  retailers?: unknown;
}

/**
 * Every product's `retailers`, read a page at a time in id order.
 *
 * A single `.limit(n)` read stops at PostgREST's 1000-row ceiling without
 * saying so, which left the domain list and "Apply to existing" working on part
 * of any catalogue past that size. Paging by id reads all of it; `truncated`
 * says the safety ceiling was reached before the end.
 */
export async function scanProductRetailers(
  max = RETAILER_SCAN_MAX,
): Promise<{ rows: ProductRetailersRow[]; truncated: boolean }> {
  if (!supabase) throw new Error("Database not configured");
  const rows: ProductRetailersRow[] = [];
  for (let from = 0; from < max; from += SCAN_PAGE) {
    const to = Math.min(from + SCAN_PAGE, max) - 1;
    const { data, error } = await supabase
      .from("products")
      .select("id, retailers")
      .order("id")
      .range(from, to);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as ProductRetailersRow[];
    rows.push(...batch);
    if (batch.length < to - from + 1) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/**
 * The admin's stated gender for a link's store, from the most specific rule
 * that states one ("uk.shop.com" before "shop.com").
 */
export function storeDefaultGender(url: string, rules: Map<string, RetailerRule>): Gender | undefined {
  for (const candidate of domainCandidates(domainFromUrl(url))) {
    const gender = rules.get(candidate)?.defaultGender;
    if (gender) return gender;
  }
  return undefined;
}

export interface ResolvedRetailer {
  name: string;
  isOfficial: boolean;
  /** The rule that decided it, when one did. Useful for reporting an import. */
  matchedDomain?: string;
}

/**
 * The store name and official-store flag for one product link.
 *
 * `preferredName` is a name the source already asserted — a CSV's merchant
 * column, say. A rule outranks it, because the rule is the admin's explicit
 * correction and the merchant column is exactly what tends to be wrong.
 */
export function resolveRetailer(
  url: string,
  brand: string,
  rules: Map<string, RetailerRule>,
  preferredName = "",
): ResolvedRetailer {
  for (const candidate of domainCandidates(domainFromUrl(url))) {
    const rule = rules.get(candidate);
    if (rule?.name) {
      return { name: rule.name, isOfficial: rule.isOfficial, matchedDomain: rule.domain };
    }
  }
  const fallbackName = preferredName.trim() || storeNameFromUrl(url, brand);
  return { name: fallbackName, isOfficial: isOfficialStore(url, brand) };
}
