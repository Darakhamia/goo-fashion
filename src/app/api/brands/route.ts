import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server/admin-auth";

// Default list used when Supabase is not configured
const DEFAULT_BRANDS = [
  "Acne Studios", "Arket", "& Other Stories", "A.P.C.", "Balenciaga",
  "Bottega Veneta", "Burberry", "Cos", "Fear of God", "Gucci",
  "Jacquemus", "Jil Sander", "Lemaire", "Louis Vuitton", "Maison Margiela",
  "Massimo Dutti", "Miu Miu", "Nike", "Prada", "Sandro", "The Row",
  "Toteme", "Valentino", "Zara",
];

export async function GET() {
  if (!isSupabaseConfigured || !supabase) {
    const res = NextResponse.json(DEFAULT_BRANDS.map((name) => ({ name, logoUrl: null, url: null })));
    res.headers.set("X-Brands-Table-Missing", "true");
    return res;
  }
  // Prefer name + logo_url + url; gracefully fall back to narrower selects if a
  // column hasn't been added yet (migration not run).
  type BrandRow = { name: string; logo_url?: string | null; url?: string | null };
  let rows: BrandRow[] = [];
  const withAll = await supabase
    .from("brands")
    .select("name, logo_url, url")
    .order("name", { ascending: true });
  if (!withAll.error) {
    rows = (withAll.data ?? []) as BrandRow[];
  } else {
    const withLogo = await supabase
      .from("brands")
      .select("name, logo_url")
      .order("name", { ascending: true });
    if (!withLogo.error) {
      rows = (withLogo.data ?? []) as BrandRow[];
    } else {
      const nameOnly = await supabase
        .from("brands")
        .select("name")
        .order("name", { ascending: true });
      if (nameOnly.error) {
        // Table doesn't exist yet — return defaults and signal to client
        const res = NextResponse.json(DEFAULT_BRANDS.map((name) => ({ name, logoUrl: null, url: null })));
        res.headers.set("X-Brands-Table-Missing", "true");
        return res;
      }
      rows = (nameOnly.data ?? []) as BrandRow[];
    }
  }

  return NextResponse.json(
    rows.map((r) => ({ name: r.name, logoUrl: r.logo_url ?? null, url: r.url ?? null })),
  );
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured.", code: "NO_DB" }, { status: 501 });
  }
  const { name, url } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const cleanUrl = typeof url === "string" && url.trim() ? url.trim() : null;
  // Try inserting with the url column; if it doesn't exist yet, fall back to
  // name-only so adding a store still works before the migration is run.
  let { data, error } = await supabase
    .from("brands")
    .insert(cleanUrl ? { name: name.trim(), url: cleanUrl } : { name: name.trim() })
    .select("name")
    .single();
  if (error && (error.code === "PGRST204" || error.message?.includes("url"))) {
    ({ data, error } = await supabase
      .from("brands")
      .insert({ name: name.trim() })
      .select("name")
      .single());
  }
  if (error) {
    // Postgres undefined_table (42P01) or schema-cache miss
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return NextResponse.json({ error: "Brands table not found.", code: "TABLE_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
