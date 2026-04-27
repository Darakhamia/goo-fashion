import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { ProductReview } from "@/lib/types";

const PAGE_SIZE = 10;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ reviews: [], total: 0, hasMore: false });
  }

  const { data, count, error } = await supabase
    .from("product_reviews")
    .select("*", { count: "exact" })
    .eq("product_id", id)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const reviews: ProductReview[] = (data ?? []).map((r) => ({
    id: r.id as string,
    productId: r.product_id as string,
    userId: r.user_id as string,
    userName: r.user_name as string,
    rating: r.rating as number,
    text: r.text as string,
    createdAt: r.created_at as string,
  }));

  return NextResponse.json({
    reviews,
    total: count ?? 0,
    hasMore: from + PAGE_SIZE < (count ?? 0),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured || !supabase)
    return NextResponse.json({ error: "DB not configured" }, { status: 501 });

  const { id } = await params;
  const { rating, text } = await req.json();
  if (!rating || rating < 1 || rating > 5)
    return NextResponse.json({ error: "rating 1–5 required" }, { status: 400 });

  // Check for duplicate
  const { data: existing } = await supabase
    .from("product_reviews")
    .select("id")
    .eq("product_id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  // Get user display name from Clerk
  let userName = "Anonymous";
  try {
    const cc = await clerkClient();
    const user = await cc.users.getUser(userId);
    userName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.emailAddresses[0]?.emailAddress?.split("@")[0] ||
      "Anonymous";
  } catch { /* keep Anonymous */ }

  const { error } = await supabase.from("product_reviews").insert({
    product_id: id,
    user_id: userId,
    user_name: userName,
    rating,
    text: text?.trim() ?? "",
    is_approved: false, // pending moderation
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, pending: true });
}
