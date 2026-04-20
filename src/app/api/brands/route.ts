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
    const res = NextResponse.json(DEFAULT_BRANDS.map((name) => ({ name })));
    res.headers.set("X-Brands-Table-Missing", "true");
    return res;
  }
  const { data, error } = await supabase
    .from("brands")
    .select("name")
    .order("name", { ascending: true });
  if (error) {
    // Table doesn't exist yet — return defaults and signal to client
    const res = NextResponse.json(DEFAULT_BRANDS.map((name) => ({ name })));
    res.headers.set("X-Brands-Table-Missing", "true");
    return res;
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured.", code: "NO_DB" }, { status: 501 });
  }
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("brands")
    .insert({ name: name.trim() })
    .select("name")
    .single();
  if (error) {
    // Postgres undefined_table (42P01) or schema-cache miss
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return NextResponse.json({ error: "Brands table not found.", code: "TABLE_MISSING" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
