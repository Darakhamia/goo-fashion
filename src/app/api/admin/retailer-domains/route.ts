import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logAdminAction } from "@/lib/server/audit";
import {
  domainCandidates,
  domainFromUrl,
  invalidateRetailerRules,
  isMissingTable,
  loadRetailerRules,
  MISSING_COLUMN_CODES,
  MISSING_GENDER_COLUMN_MESSAGE,
  MISSING_TABLE_MESSAGE,
  normalizeDomain,
  parseStoreGender,
  RETAILER_SCAN_MAX,
  scanProductRetailers,
  type RetailerRule,
} from "@/lib/server/retailer-domains";

export const dynamic = "force-dynamic";

interface StoredRetailer {
  name?: unknown;
  url?: unknown;
  isOfficial?: unknown;
}

interface DiscoveredDomain {
  domain: string;
  /** Products with at least one link on this domain. */
  productCount: number;
  /** The names those links currently carry, most common first. */
  currentNames: string[];
  /** How many of those links are already flagged as the brand's own shop. */
  officialCount: number;
  /** The rule that would apply to this domain, if any. */
  ruledBy?: string;
}

/**
 * Which domains the catalogue actually links to.
 *
 * A rules table nobody can populate is useless: the admin does not know which
 * domains exist, and the ones that need fixing are precisely the ones with an
 * odd name. So the list is derived from the products themselves, carrying the
 * names those links currently show — the wrong name is the thing to recognise
 * the row by.
 */
async function discoverDomains(
  rules: Map<string, RetailerRule>,
): Promise<{ domains: DiscoveredDomain[]; scanned: number; truncated: boolean }> {
  const { rows, truncated } = await scanProductRetailers();

  const byDomain = new Map<string, { products: number; names: Map<string, number>; official: number }>();

  for (const row of rows) {
    const retailers = row.retailers;
    if (!Array.isArray(retailers)) continue;
    // Per product, not per link: two links to the same shop are one product.
    const seen = new Set<string>();
    for (const entry of retailers as StoredRetailer[]) {
      const domain = domainFromUrl(String(entry?.url ?? ""));
      if (!domain) continue;
      let bucket = byDomain.get(domain);
      if (!bucket) {
        bucket = { products: 0, names: new Map(), official: 0 };
        byDomain.set(domain, bucket);
      }
      if (!seen.has(domain)) {
        bucket.products += 1;
        seen.add(domain);
      }
      const name = String(entry?.name ?? "").trim();
      if (name) bucket.names.set(name, (bucket.names.get(name) ?? 0) + 1);
      if (entry?.isOfficial === true) bucket.official += 1;
    }
  }

  const ruleFor = (domain: string) =>
    domainCandidates(domain).find((c) => rules.has(c));

  const domains = [...byDomain.entries()]
    .map(([domain, b]) => ({
      domain,
      productCount: b.products,
      currentNames: [...b.names.entries()]
        .sort((a, z) => z[1] - a[1])
        .slice(0, 3)
        .map(([n]) => n),
      officialCount: b.official,
      ruledBy: ruleFor(domain),
    }))
    .sort((a, z) => z.productCount - a.productCount);
  return { domains, scanned: rows.length, truncated };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  // Probe the table directly. `loadRetailerRules` treats an unreachable table
  // as "no rules", which is right for an import — it must never fail because of
  // an optional table — but wrong here: an editor showing an empty list when
  // the table is simply absent tells the admin nothing.
  const { error: probeError } = await supabase.from("retailer_domains").select("domain").limit(1);
  const tableMissing = isMissingTable(probeError);

  const rules = tableMissing ? new Map<string, RetailerRule>() : await loadRetailerRules(true);

  let discovered: DiscoveredDomain[] = [];
  let scanned = 0;
  let scanTruncated = false;
  let discoverError: string | null = null;
  try {
    ({ domains: discovered, scanned, truncated: scanTruncated } = await discoverDomains(rules));
  } catch (err) {
    // The rules are the point of the page; the catalogue scan is a convenience.
    // Losing the scan must not take the editor down with it.
    discoverError = err instanceof Error ? err.message : "Could not scan the catalogue";
  }

  return NextResponse.json({
    rules: [...rules.values()].sort((a, z) => a.domain.localeCompare(z.domain)),
    discovered,
    discoverError,
    scanLimit: RETAILER_SCAN_MAX,
    scanned,
    scanTruncated,
    tableMissing,
    setupHint: tableMissing ? MISSING_TABLE_MESSAGE : null,
    // Anything else wrong with the table is worth surfacing too, rather than
    // being read as "no rules yet".
    rulesError: !tableMissing && probeError ? probeError.message : null,
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const domain = normalizeDomain(String(body?.domain ?? ""));
  const name = String(body?.name ?? "").trim().slice(0, 120);

  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "A domain like farfetch.com is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "A store name is required" }, { status: 400 });
  }

  const defaultGender = parseStoreGender(body?.defaultGender) ?? null;
  const row = {
    domain,
    name,
    is_official: body?.isOfficial === true,
    default_gender: defaultGender,
    note: String(body?.note ?? "").trim().slice(0, 500) || null,
    updated_at: new Date().toISOString(),
  };
  const upsert = (r: Record<string, unknown>) =>
    supabase!.from("retailer_domains").upsert(r, { onConflict: "domain" });

  let { error } = await upsert(row);
  // A database that has not run migration 022 has no `default_gender`. A rule
  // that sets no gender loses nothing by leaving the column out; one that sets
  // a gender must not be saved as if it had worked.
  if (error?.code && MISSING_COLUMN_CODES.has(error.code) && /default_gender/.test(error.message ?? "")) {
    if (defaultGender) return NextResponse.json({ error: MISSING_GENDER_COLUMN_MESSAGE }, { status: 503 });
    const withoutGender: Record<string, unknown> = { ...row };
    delete withoutGender.default_gender;
    ({ error } = await upsert(withoutGender));
  }

  if (isMissingTable(error)) {
    return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateRetailerRules();
  await logAdminAction({
    admin_id: admin.userId,
    action: "retailer_domain.saved",
    target_type: "retailer_domain",
    target_id: domain,
    metadata: { name, isOfficial: body?.isOfficial === true, defaultGender },
  });

  return NextResponse.json({ ok: true, domain });
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const domain = normalizeDomain(new URL(req.url).searchParams.get("domain") ?? "");
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

  const { error } = await supabase.from("retailer_domains").delete().eq("domain", domain);
  if (isMissingTable(error)) {
    return NextResponse.json({ error: MISSING_TABLE_MESSAGE }, { status: 503 });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateRetailerRules();
  await logAdminAction({
    admin_id: admin.userId,
    action: "retailer_domain.deleted",
    target_type: "retailer_domain",
    target_id: domain,
  });

  return NextResponse.json({ ok: true });
}
