import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getOpenAIKey } from "@/lib/server/get-openai-key";
import { isMonobankConfigured } from "@/lib/server/monobank";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface RecentRow {
  id: string;
  name: string;
  created_at: string;
  image_url?: string;
  brand?: string;
}

type HealthItem = { ok: boolean; detail: string };

interface HealthReport {
  supabase:  HealthItem;
  clerk:     HealthItem;
  openai:    HealthItem;
  replicate: HealthItem;
  monobank:  HealthItem;
  resend:    HealthItem;
}

type ClerkUserLite = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string;
  createdAt: number;
  plan: string;
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

/** null when either side is unknown — the dashboard then shows no growth pill. */
function growthPct(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null) return null;
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

/** Count from a head/count query, or null when the query failed. */
function countOf(q: { count: number | null; error: unknown }): number | null {
  return q.error ? null : (q.count ?? 0);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // Growth compares equal stretches: month-to-date against the same elapsed
  // time from the start of last month (capped at its end, e.g. 31 March →
  // all of February). Comparing a partial month with a full one made every
  // card read about −90% in the first days of a month.
  const prevPeriodEnd = new Date(
    Math.min(prevMonthStart.getTime() + (now.getTime() - monthStart.getTime()), monthStart.getTime())
  );
  const sevenDaysAgo = daysAgo(7);

  // ── Supabase counts ────────────────────────────────────────────────────────
  // A metric whose query failed stays null ("—" on the dashboard) so an outage
  // never reads as a real zero.
  let productsTotal: number | null = null;
  let productsThisMonth: number | null = null;
  let productsPrevPeriod: number | null = null;
  let outfitsTotal: number | null = null;
  let outfitsThisMonth: number | null = null;
  let outfitsPrevPeriod: number | null = null;
  let outfitsAI: number | null = null;
  let brandsTotal: number | null = null;
  let recentProducts: RecentRow[] = [];
  let recentOutfits: RecentRow[] = [];
  let supabaseOk = false;
  let supabaseDetail = "Not configured";

  if (isSupabaseConfigured && supabase) {
    try {
      const [
        productsTotalQ,
        productsThisQ,
        productsPrevQ,
        outfitsTotalQ,
        outfitsThisQ,
        outfitsPrevQ,
        outfitsAIQ,
        brandsQ,
        recentProductsQ,
        recentOutfitsQ,
      ] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
        supabase.from("products").select("*", { count: "exact", head: true }).gte("created_at", prevMonthStart.toISOString()).lt("created_at", prevPeriodEnd.toISOString()),
        supabase.from("outfits").select("*", { count: "exact", head: true }),
        supabase.from("outfits").select("*", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
        supabase.from("outfits").select("*", { count: "exact", head: true }).gte("created_at", prevMonthStart.toISOString()).lt("created_at", prevPeriodEnd.toISOString()),
        supabase.from("outfits").select("*", { count: "exact", head: true }).eq("is_ai_generated", true),
        supabase.from("brands").select("*", { count: "exact", head: true }),
        supabase.from("products").select("id,name,brand,image_url,created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("outfits").select("id,name,image_url,created_at").order("created_at", { ascending: false }).limit(6),
      ]);

      productsTotal      = countOf(productsTotalQ);
      productsThisMonth  = countOf(productsThisQ);
      productsPrevPeriod = countOf(productsPrevQ);
      outfitsTotal       = countOf(outfitsTotalQ);
      outfitsThisMonth   = countOf(outfitsThisQ);
      outfitsPrevPeriod  = countOf(outfitsPrevQ);
      outfitsAI          = countOf(outfitsAIQ);
      brandsTotal        = countOf(brandsQ);
      recentProducts     = (recentProductsQ.data as RecentRow[] | null) ?? [];
      recentOutfits      = (recentOutfitsQ.data as RecentRow[] | null)  ?? [];

      const firstError = [productsTotalQ, outfitsTotalQ].find((q) => q.error)?.error;
      supabaseOk = !firstError;
      supabaseDetail = firstError ? firstError.message || "Query error" : "Connected";
    } catch (e) {
      supabaseDetail = e instanceof Error ? e.message : "Unknown error";
    }
  }

  // ── Clerk user stats ───────────────────────────────────────────────────────
  let usersTotal: number | null = null;
  let usersThisMonth: number | null = null;
  let usersPrevPeriod: number | null = null;
  let activeWeek: number | null = null;
  let recentSignups: ClerkUserLite[] = [];
  let clerkOk = false;
  let clerkDetail = "Not configured";

  try {
    const cc = await clerkClient();
    const [total, activeList, signupSample] = await Promise.all([
      cc.users.getCount(),
      cc.users.getUserList({ last_active_at_since: sevenDaysAgo.getTime(), limit: 1 }),
      // Newest 200 users: feeds both "Recent signups" and the month deltas.
      // Known limit: with more than 200 signups across this month and last,
      // the sample no longer reaches back to the start of last month, so the
      // previous period is undercounted and user growth reads too high.
      cc.users.getUserList({ orderBy: "-created_at", limit: 200 }),
    ]);
    usersTotal  = total;
    activeWeek  = activeList.totalCount ?? 0;
    usersThisMonth = signupSample.data.filter((u) => u.createdAt >= monthStart.getTime()).length;
    usersPrevPeriod = signupSample.data.filter(
      (u) => u.createdAt >= prevMonthStart.getTime() && u.createdAt < prevPeriodEnd.getTime()
    ).length;
    recentSignups = signupSample.data.slice(0, 6).map((u) => {
      const meta = (u.publicMetadata ?? {}) as { plan?: string };
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.emailAddresses[0]?.emailAddress ?? null,
        imageUrl: u.imageUrl,
        createdAt: u.createdAt,
        plan: meta.plan ?? "free",
      };
    });
    clerkOk = true;
    clerkDetail = "Connected";
  } catch (e) {
    clerkDetail = e instanceof Error ? e.message : "Unknown error";
  }

  // ── Integrations ───────────────────────────────────────────────────────────
  // OpenAI: the key may live in env or in the settings table (saved via
  // Settings); every AI feature resolves it through getOpenAIKey().
  let openai: HealthItem;
  try {
    const key = await getOpenAIKey();
    const source = process.env.OPENAI_API_KEY?.trim() ? "env" : "database";
    openai = key
      ? { ok: true, detail: `Key present (${source})` }
      : { ok: false, detail: "No key in env or Settings" };
  } catch (e) {
    openai = { ok: false, detail: e instanceof Error ? e.message : "Key lookup failed" };
  }

  const health: HealthReport = {
    supabase: { ok: supabaseOk, detail: supabaseDetail },
    clerk:    { ok: clerkOk,    detail: clerkDetail },
    openai,
    replicate:{
      ok: Boolean(process.env.REPLICATE_API_TOKEN),
      detail: process.env.REPLICATE_API_TOKEN ? "Token present" : "REPLICATE_API_TOKEN missing",
    },
    monobank: {
      ok: isMonobankConfigured,
      detail: isMonobankConfigured ? "Token present" : "MONOBANK_TOKEN missing",
    },
    resend: {
      ok: Boolean(process.env.RESEND_API_KEY),
      detail: process.env.RESEND_API_KEY ? "Key present" : "RESEND_API_KEY missing",
    },
  };

  return NextResponse.json({
    generatedAt: now.toISOString(),
    summary: {
      products: { total: productsTotal, thisMonth: productsThisMonth, growthPct: growthPct(productsThisMonth, productsPrevPeriod) },
      outfits:  { total: outfitsTotal,  growthPct: growthPct(outfitsThisMonth, outfitsPrevPeriod), aiGenerated: outfitsAI },
      users:    { total: usersTotal,    growthPct: growthPct(usersThisMonth,   usersPrevPeriod),   activeWeek },
      brands:   { total: brandsTotal },
    },
    recent: {
      products: recentProducts,
      outfits:  recentOutfits,
      signups:  recentSignups,
    },
    health,
  });
}
