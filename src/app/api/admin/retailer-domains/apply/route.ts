import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logAdminAction } from "@/lib/server/audit";
import { AUDIT_PREVIOUS_CAP } from "@/lib/server/bulk-edit";
import {
  domainCandidates,
  domainFromUrl,
  loadRetailerRules,
  normalizeDomain,
  RETAILER_SCAN_MAX,
  scanProductRetailers,
} from "@/lib/server/retailer-domains";

export const dynamic = "force-dynamic";

interface StoredRetailer {
  name?: unknown;
  url?: unknown;
  isOfficial?: unknown;
  [key: string]: unknown;
}

/**
 * Apply one domain's rule to products already in the catalogue.
 *
 * Rules are applied at import time, so on their own they only ever fix what
 * arrives next; everything imported before the rule existed keeps the name it
 * was guessed into. This is the deliberate, opt-in catch-up for those, run one
 * domain at a time so the blast radius is always a number the admin has seen.
 *
 * It overwrites names that were corrected by hand on individual products, which
 * is the point — the rule is now the source of truth for this domain — but it
 * is why this is a button rather than something that happens on save.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const domain = normalizeDomain(String(body?.domain ?? ""));
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });

  const rules = await loadRetailerRules(true);
  const rule = rules.get(domain);
  if (!rule) return NextResponse.json({ error: `No rule for ${domain}` }, { status: 404 });

  let scan: Awaited<ReturnType<typeof scanProductRetailers>>;
  try {
    scan = await scanProductRetailers();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read products" },
      { status: 500 },
    );
  }

  // The rule applied to one product's links. Only this domain's entries are
  // touched; `before` keeps what each of them said, for the audit entry.
  const applyRule = (retailers: unknown) => {
    if (!Array.isArray(retailers)) return null;
    const before: { url: unknown; name: unknown; isOfficial: unknown }[] = [];
    const next = (retailers as StoredRetailer[]).map((entry) => {
      // Matched the same way an import would: the rule owns this domain and any
      // subdomain of it that has no rule of its own.
      const host = domainFromUrl(String(entry?.url ?? ""));
      if (!host || !domainCandidates(host).includes(domain)) return entry;
      // A subdomain with its own, more specific rule belongs to that rule.
      const owner = domainCandidates(host).find((c) => rules.has(c));
      if (owner !== domain) return entry;
      if (entry.name === rule.name && entry.isOfficial === rule.isOfficial) return entry;
      before.push({ url: entry.url, name: entry.name, isOfficial: entry.isOfficial });
      return { ...entry, name: rule.name, isOfficial: rule.isOfficial };
    });
    return before.length ? { next, before } : null;
  };

  const matched = scan.rows.filter((r) => applyRule(r.retailers)).map((r) => r.id);

  // One row at a time, in small waves: this touches a jsonb column on products
  // that may be being read at the same time, and a failure halfway through
  // should leave a partial, correct result rather than an unknown one.
  //
  // Each wave is re-read right before it is written. The scan can be minutes
  // old on a large catalogue, and writing back the array it read would drop a
  // link an import added to the product in the meantime.
  let updated = 0;
  const failures: string[] = [];
  const previous: { id: string; before: unknown }[] = [];
  const WAVE = 20;
  for (let i = 0; i < matched.length; i += WAVE) {
    const ids = matched.slice(i, i + WAVE);
    const { data: fresh, error: readError } = await supabase
      .from("products")
      .select("id, retailers")
      .in("id", ids);
    if (readError) {
      failures.push(...ids);
      continue;
    }
    const results = await Promise.all(
      ((fresh ?? []) as { id: string; retailers?: unknown }[]).map(async (row) => {
        const change = applyRule(row.retailers);
        // Already right (or the link is gone): nothing to write.
        if (!change) return null;
        const { error: e } = await supabase!
          .from("products")
          .update({ retailers: change.next })
          .eq("id", row.id);
        if (e) return row.id;
        previous.push({ id: row.id, before: change.before });
        updated += 1;
        return null;
      }),
    );
    for (const failed of results) if (failed) failures.push(failed);
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "retailer_domain.applied",
    target_type: "retailer_domain",
    target_id: domain,
    metadata: {
      name: rule.name,
      isOfficial: rule.isOfficial,
      updated,
      failed: failures.length,
      // What the rule replaced, per product, so a rule applied to the wrong
      // store can be put back.
      previous: previous.slice(0, AUDIT_PREVIOUS_CAP),
      previousTotal: previous.length,
    },
  });

  return NextResponse.json({
    ok: true,
    matched: matched.length,
    updated,
    failed: failures.length,
    scanLimit: RETAILER_SCAN_MAX,
    scanned: scan.rows.length,
    truncated: scan.truncated,
  });
}
