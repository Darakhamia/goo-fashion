import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/server/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface RecentRow {
  id: string;
  name: string;
  created_at: string;
  image_url?: string;
  brand?: string;
}

interface HealthReport {
  supabase: { ok: boolean; detail: string };
  clerk:    { ok: boolean; detail: string };
  openai:   { ok: boolean; detail: string };
  replicate:{ ok: boolean; detail: string };
}

type ClerkUserLite = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string;
  createdAt: number;
  lastSignInAt: number | null;
  plan: string;
  isAdmin: boolean;
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}

function growthPct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sevenDaysAgo = daysAgo(7);

  // ── Supabase counts ────────────────────────────────────────────────────────
  let productsTotal = 0;
  let productsThisMonth = 0;
  let productsPrevMonth = 0;
  let outfitsTotal = 0;
  let outfitsThisMonth = 0;
  let outfitsPrevMonth = 0;
  let outfitsAI = 0;
  let brandsTotal = 0;
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
        supabase.from("products").select("*", { count: "exact", head: true }).gte("created_at", prevMonthStart.toISOString()).lt("created_at", monthStart.toISOString()),
        supabase.from("outfits").select("*", { count: "exact", head: true }),
        supabase.from("outfits").select("*", { count: "exact", head: true }).gte("created_at", monthStart.toISOString()),
        supabase.from("outfits").select("*", { count: "exact", head: true }).gte("created_at", prevMonthStart.toISOString()).lt("created_at", monthStart.toISOString()),
        supabase.from("outfits").select("*", { count: "exact", head: true }).eq("is_ai_generated", true),
        supabase.from("brands").select("*", { count: "exact", head: true }),
        supabase.from("products").select("id,name,brand,image_url,created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("outfits").select("id,name,image_url,created_at").order("created_at", { ascending: false }).limit(6),
      ]);

      productsTotal     = productsTotalQ.count ?? 0;
      productsThisMonth = productsThisQ.count  ?? 0;
      productsPrevMonth = productsPrevQ.count  ?? 0;
      outfitsTotal      = outfitsTotalQ.count  ?? 0;
      outfitsThisMonth  = outfitsThisQ.count   ?? 0;
      outfitsPrevMonth  = outfitsPrevQ.count   ?? 0;
      outfitsAI         = outfitsAIQ.count     ?? 0;
      // Brands table may not exist in all environments — treat as 0.
      brandsTotal       = brandsQ.error ? 0 : (brandsQ.count ?? 0);
      recentProducts    = (recentProductsQ.data as RecentRow[] | null) ?? [];
      recentOutfits     = (recentOutfitsQ.data as RecentRow[] | null)  ?? [];

      supabaseOk = !productsTotalQ.error && !outfitsTotalQ.error;
      supabaseDetail = supabaseOk ? "Connected" : productsTotalQ.error?.message ?? "Query error";
    } catch (e) {
      supabaseDetail = e instanceof Error ? e.message : "Unknown error";
    }
  }

  // ── Clerk user stats ───────────────────────────────────────────────────────
  let usersTotal = 0;
  let usersThisMonth = 0;
  let usersPrevMonth = 0;
  let activeWeek = 0;
  let recentSignups: ClerkUserLite[] = [];
  let clerkOk = false;
  let clerkDetail = "Not configured";

  try {
    const cc = await clerkClient();
    const [total, activeList, recentList, signupSample] = await Promise.all([
      cc.users.getCount(),
      cc.users.getUserList({ last_active_at_since: sevenDaysAgo.getTime(), limit: 1 }),
      cc.users.getUserList({ orderBy: "-created_at", limit: 6 }),
      // Pull a large-enough window to compute month deltas without a dedicated endpoint.
      cc.users.getUserList({ orderBy: "-created_at", limit: 200 }),
    ]);
    usersTotal  = total;
    activeWeek  = activeList.totalCount ?? 0;
    usersThisMonth = signupSample.data.filter((u) => u.createdAt >= monthStart.getTime()).length;
    usersPrevMonth = signupSample.data.filter(
      (u) => u.createdAt >= prevMonthStart.getTime() && u.createdAt < monthStart.getTime()
    ).length;
    recentSignups = recentList.data.map((u) => {
      const meta = (u.publicMetadata ?? {}) as { plan?: string; isAdmin?: boolean };
      return {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.emailAddresses[0]?.emailAddress ?? null,
        imageUrl: u.imageUrl,
        createdAt: u.createdAt,
        lastSignInAt: u.lastSignInAt,
        plan: meta.plan ?? "free",
        isAdmin: Boolean(meta.isAdmin),
      };
    });
    clerkOk = true;
    clerkDetail = "Connected";
  } catch (e) {
    clerkDetail = e instanceof Error ? e.message : "Unknown error";
  }

  const health: HealthReport = {
    supabase: { ok: supabaseOk, detail: supabaseDetail },
    clerk:    { ok: clerkOk,    detail: clerkDetail },
    openai:   {
      ok: Boolean(process.env.OPENAI_API_KEY),
      detail: process.env.OPENAI_API_KEY ? "Key present" : "OPENAI_API_KEY missing",
    },
    replicate:{
      ok: Boolean(process.env.REPLICATE_API_TOKEN),
      detail: process.env.REPLICATE_API_TOKEN ? "Token present" : "REPLICATE_API_TOKEN missing",
    },
  };

  return NextResponse.json({
    generatedAt: now.toISOString(),
    summary: {
      products: { total: productsTotal, thisMonth: productsThisMonth, growthPct: growthPct(productsThisMonth, productsPrevMonth) },
      outfits:  { total: outfitsTotal,  thisMonth: outfitsThisMonth,  growthPct: growthPct(outfitsThisMonth,  outfitsPrevMonth), aiGenerated: outfitsAI },
      users:    { total: usersTotal,    thisMonth: usersThisMonth,    growthPct: growthPct(usersThisMonth,    usersPrevMonth),    activeWeek },
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
