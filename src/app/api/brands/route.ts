import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

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
    return NextResponse.json(DEFAULT_BRANDS.map((name) => ({ name })));
  }
  const { data, error } = await supabase
    .from("brands")
    .select("name")
    .order("name", { ascending: true });
  if (error) {
    // Table may not exist yet — return defaults
    return NextResponse.json(DEFAULT_BRANDS.map((name) => ({ name })));
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
