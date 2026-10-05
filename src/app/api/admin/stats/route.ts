import { NextResponse } from "next/server";
import type { User } from "@clerk/nextjs/server";
import { isSuperAdminId, requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { envAdminIds, planOf, scanUsers } from "../users/user-list";
import { paymentsOff, probeServices, type ServiceCheck } from "@/lib/server/system-health";
import { readAllSubscriptions, summarizeBilling } from "@/lib/server/billing-health";
import { checkSchemaCached } from "@/lib/server/schema-check";
import { buildAttention } from "@/lib/server/attention";
import { resolveAdminEmails, type AdminAction } from "@/lib/server/audit";
import { withTimeout } from "@/lib/server/with-timeout";

export const dynamic = "force-dynamic";

/*
 * GET /api/admin/stats[?fresh=1] — everything the dashboard shows (GS4-12):
 *
 * - kpis: products, outfits, customers, paying, brands. Customers leave out the
 *   team (ADMIN_USER_IDS, isAdmin, the super admin), growth is the absolute
 *   number this month, and the percentage only comes with it once last month's
 *   stretch had enough to compare with (GS1-4).
 * - services: Supabase and Clerk by this request's own reads, the rest probed
 *   (GS1-1, lib/server/system-health).
 * - attention: what is broken or waits for a person (GS1-2, lib/server/attention).
 * - recent: new customers; the catalogue's latest changes from the admin log,
 *   for the super admin only (the log is theirs: /goo-studio/activity), and the
 *   newest outfits for everyone else.
 *
 * A metric whose read failed is null — "—" on the page, never a zero that looks
 * real. Every source has a time limit, so one that hangs costs the dashboard
 * seconds, not the whole page.
 */

/** A source that does not answer in this time is shown as unknown. */
const SOURCE_TIMEOUT_MS = 8_000;
/** Below this many in last month's stretch, a percentage says more about chance than growth. */
const PCT_MIN_BASE = 50;

/** The admin log entries that change the catalogue: the dashboard's "Catalogue activity". */
const CATALOGUE_ACTIONS: AdminAction[] = [
  "parser.product_imported",
  "parser.crawl_batch",
  "parser.collect_ingest",
  "import.csv",
  "categories.updated",
  "products.created",
  "products.updated",
  "products.deleted",
  "products.bulk_deleted",
  "products.bulk_edited",
  "products.recategorized",
  "products.recategorize_undone",
  "products.styles_reset",
  "products.styles_reset_undone",
  "products.label_fixed",
  "products.bg_color_sampled",
  "products.bg_color_undone",
  "products.duplicates_merged",
  "products.colour_group_split",
  "products.colourways_grouped",
  "catalogue_check.fixed",
  "catalogue_check.brands_unified",
  "catalogue_check.applied",
  "catalogue_check.undone",
  "outfits.created",
  "outfits.updated",
  "outfits.deleted",
  "looks.approved",
  "looks.rejected",
  "brands.created",
  "brands.deleted",
  "retailer_domain.saved",
  "retailer_domain.deleted",
  "retailer_domain.applied",
];

type Count = number | null;

/** Count from a head/count query, or null when the query failed. */
function countOf(q: { count: number | null; error: unknown }): Count {
  return q.error ? null : (q.count ?? 0);
}

/** Month to date, and the same elapsed stretch of last month (capped at its end). */
function periods(now: Date) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Comparing a partial month with a full one made every number read about
  // −90% in the first days of a month.
  const prevEnd = new Date(Math.min(prevMonthStart.getTime() + (now.getTime() - monthStart.getTime()), monthStart.getTime()));
  return { monthStart, prevMonthStart, prevEnd };
}

function growth(thisMonth: Count, prev: Count): { thisMonth: Count; pct: number | null } {
  if (thisMonth === null || prev === null || prev < PCT_MIN_BASE) return { thisMonth, pct: null };
  return { thisMonth, pct: Math.round(((thisMonth - prev) / prev) * 100) };
}

type Recent = { id: string; name: string; image_url?: string | null; created_at: string };

async function readCatalogue(now: Date) {
  const { monthStart, prevMonthStart, prevEnd } = periods(now);
  const sb = supabase!;
  const head = { count: "exact" as const, head: true };
  const started = Date.now();
  const [
    products,
    productsThis,
    productsPrev,
    outfits,
    outfitsAI,
    brands,
    pendingLooks,
    withoutEmbedding,
    aiSuggestions,
    recentOutfits,
  ] = await Promise.all([
    sb.from("products").select("id", head),
    sb.from("products").select("id", head).gte("created_at", monthStart.toISOString()),
    sb.from("products").select("id", head).gte("created_at", prevMonthStart.toISOString()).lt("created_at", prevEnd.toISOString()),
    sb.from("outfits").select("id", head),
    sb.from("outfits").select("id", head).eq("is_ai_generated", true),
    sb.from("brands").select("id", head),
    sb.from("pending_looks").select("id", head).eq("status", "pending"),
    // A missing column (migration 007) errors and reads null: the migrations
    // item covers it, rather than "every product lacks an embedding".
    sb.from("products").select("id", head).is("embedding", null),
    sb.from("catalogue_check_fixes").select("id", head).eq("status", "suggested"),
    sb.from("outfits").select("id,name,image_url,created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  const error = products.error?.message ?? outfits.error?.message ?? null;
  return {
    ok: !error,
    error,
    ms: Date.now() - started,
    products: countOf(products),
    productsGrowth: growth(countOf(productsThis), countOf(productsPrev)),
    outfits: countOf(outfits),
    outfitsAI: countOf(outfitsAI),
    brands: countOf(brands),
    pendingLooks: countOf(pendingLooks),
    withoutEmbedding: countOf(withoutEmbedding),
    aiSuggestions: countOf(aiSuggestions),
    recentOutfits: ((recentOutfits.data as Recent[] | null) ?? []).map((o) => ({ ...o, image_url: o.image_url ?? null })),
  };
}

type CatalogueRead = Awaited<ReturnType<typeof readCatalogue>>;

/** The team: env admins, admins granted in the Users panel, and the super admin. */
function isTeam(u: User, envIds: Set<string>): boolean {
  if (envIds.has(u.id) || isSuperAdminId(u.id)) return true;
  return ((u.publicMetadata ?? {}) as { isAdmin?: boolean }).isAdmin === true;
}

async function readCustomers(now: Date) {
  const { monthStart, prevMonthStart, prevEnd } = periods(now);
  const started = Date.now();
  const scan = await scanUsers();
  const envIds = new Set(envAdminIds());
  const customers = scan.users.filter((u) => !isTeam(u, envIds));
  const team = scan.users.length - customers.length;
  const inRange = (from: Date, to: Date) => customers.filter((u) => u.createdAt >= from.getTime() && u.createdAt < to.getTime()).length;
  return {
    ok: true,
    ms: Date.now() - started,
    // Users Clerk holds beyond the scan cap are counted as customers: the team is small.
    total: scan.totalCount - team,
    team,
    partial: scan.truncated,
    growth: growth(inRange(monthStart, new Date(now.getTime() + 1)), inRange(prevMonthStart, prevEnd)),
    recent: customers.slice(0, 5).map((u) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.emailAddresses[0]?.emailAddress ?? null,
      imageUrl: u.imageUrl,
      createdAt: u.createdAt,
      plan: planOf(u),
    })),
  };
}

type CustomersRead = Awaited<ReturnType<typeof readCustomers>>;

/** The catalogue's latest changes from the admin log, newest first. */
async function readActivity() {
  const { data, error } = await supabase!
    .from("admin_audit_log")
    .select("id,admin_id,admin_email,action,target_id,metadata,created_at")
    .in("action", CATALOGUE_ACTIONS)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return null;
  const rows = (data ?? []) as {
    id: number;
    admin_id: string;
    admin_email: string | null;
    action: string;
    target_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }[];
  const emails = await resolveAdminEmails(rows.filter((r) => !r.admin_email).map((r) => r.admin_id));
  return rows.map((r) => {
    const m = r.metadata ?? {};
    const name = [m.name, m.title, m.domain, m.brand].find((v): v is string => typeof v === "string" && v.trim() !== "");
    const count = [m.count, m.created, m.imported, m.applied, m.total].find((v): v is number => typeof v === "number");
    return {
      id: r.id,
      action: r.action,
      name: name ?? null,
      count: count ?? null,
      who: r.admin_email ?? emails.get(r.admin_id) ?? null,
      at: r.created_at,
    };
  });
}

function sourceCheck(key: "supabase" | "clerk", read: { ok: boolean; ms: number; error?: string | null } | null): ServiceCheck {
  if (!read) return { key, state: "err", code: "timeout" };
  if (!read.ok) return { key, state: "err", code: "error", message: read.error ?? undefined };
  return { key, state: "ok", code: "answered", ms: read.ms };
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const db = isSupabaseConfigured && !!supabase;
  const superAdmin = isSuperAdminId(admin.userId);

  const [catalogue, customers, probes, subs, schema, activity] = await Promise.all([
    db ? withTimeout<CatalogueRead | null>(readCatalogue(now), null, "dashboard catalogue", SOURCE_TIMEOUT_MS) : Promise.resolve(null),
    withTimeout<CustomersRead | null>(readCustomers(now), null, "dashboard customers", SOURCE_TIMEOUT_MS),
    probeServices(fresh),
    db ? withTimeout(readAllSubscriptions(), null, "dashboard subscriptions", SOURCE_TIMEOUT_MS) : Promise.resolve(null),
    db ? withTimeout(checkSchemaCached(fresh), null, "dashboard schema", SOURCE_TIMEOUT_MS) : Promise.resolve(null),
    db && superAdmin ? withTimeout(readActivity(), null, "dashboard activity", SOURCE_TIMEOUT_MS) : Promise.resolve(null),
  ]);

  const billing = subs && !subs.error ? summarizeBilling(subs.data, now.getTime()) : null;

  const services: ServiceCheck[] = [
    db ? sourceCheck("supabase", catalogue) : { key: "supabase", state: "err", code: "no_key" },
    sourceCheck("clerk", customers),
    ...probes,
  ];

  const attention = buildAttention({
    services,
    missingMigrations: schema ? schema.missingMigrations : null,
    billing: paymentsOff || !billing ? null : billing,
    withoutEmbedding: catalogue?.withoutEmbedding ?? null,
    aiSuggestions: catalogue?.aiSuggestions ?? null,
    pendingLooks: catalogue?.pendingLooks ?? null,
  });

  return NextResponse.json({
    generatedAt: now.toISOString(),
    paymentsOff,
    kpis: {
      products: { total: catalogue?.products ?? null, ...(catalogue?.productsGrowth ?? { thisMonth: null, pct: null }) },
      outfits: { total: catalogue?.outfits ?? null, ai: catalogue?.outfitsAI ?? null, pending: catalogue?.pendingLooks ?? null },
      customers: customers
        ? { total: customers.total, team: customers.team, partial: customers.partial, ...customers.growth }
        : { total: null, team: null, partial: false, thisMonth: null, pct: null },
      paying: billing ? { total: billing.active, mrrUah: Math.round(billing.mrrMinor / 100) } : { total: null, mrrUah: null },
      brands: { total: catalogue?.brands ?? null, products: catalogue?.products ?? null },
    },
    attention,
    services,
    recent: {
      customers: customers?.recent ?? null,
      // null for everyone but the super admin: the page shows the newest outfits instead.
      activity,
      outfits: catalogue?.recentOutfits ?? null,
    },
  });
}
