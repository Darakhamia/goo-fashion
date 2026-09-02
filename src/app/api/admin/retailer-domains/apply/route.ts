import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { logAdminAction } from "@/lib/server/audit";
import {
  domainCandidates,
  domainFromUrl,
  loadRetailerRules,
  normalizeDomain,
} from "@/lib/server/retailer-domains";

export const dynamic = "force-dynamic";

const SCAN_LIMIT = 5000;

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

  const { data, error } = await supabase
    .from("products")
    .select("id, retailers")
    .limit(SCAN_LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updates: { id: string; retailers: StoredRetailer[] }[] = [];

  for (const row of data ?? []) {
    const { id, retailers } = row as { id: string; retailers?: unknown };
    if (!Array.isArray(retailers)) continue;

    let changed = false;
    const next = (retailers as StoredRetailer[]).map((entry) => {
      // Matched the same way an import would: the rule owns this domain and any
      // subdomain of it that has no rule of its own.
      const host = domainFromUrl(String(entry?.url ?? ""));
      if (!host || !domainCandidates(host).includes(domain)) return entry;
      // A subdomain with its own, more specific rule belongs to that rule.
      const owner = domainCandidates(host).find((c) => rules.has(c));
      if (owner !== domain) return entry;
      if (entry.name === rule.name && entry.isOfficial === rule.isOfficial) return entry;
      changed = true;
      return { ...entry, name: rule.name, isOfficial: rule.isOfficial };
    });

    if (changed) updates.push({ id, retailers: next });
  }

  // One row at a time, in small waves: this touches a jsonb column on products
  // that may be being read at the same time, and a failure halfway through
  // should leave a partial, correct result rather than an unknown one.
  let updated = 0;
  const failures: string[] = [];
  const WAVE = 20;
  for (let i = 0; i < updates.length; i += WAVE) {
    const wave = updates.slice(i, i + WAVE);
    const results = await Promise.all(
      wave.map(async (u) => {
        const { error: e } = await supabase!
          .from("products")
          .update({ retailers: u.retailers })
          .eq("id", u.id);
        return e ? u.id : null;
      }),
    );
    for (const failed of results) {
      if (failed) failures.push(failed);
      else updated += 1;
    }
  }

  await logAdminAction({
    admin_id: admin.userId,
    action: "retailer_domain.applied",
    target_type: "retailer_domain",
    target_id: domain,
    metadata: { name: rule.name, isOfficial: rule.isOfficial, updated, failed: failures.length },
  });

  return NextResponse.json({
    ok: true,
    matched: updates.length,
    updated,
    failed: failures.length,
    scanLimit: SCAN_LIMIT,
    scanned: (data ?? []).length,
  });
}
