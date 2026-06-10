import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Returns the current user's publication submissions (pending_looks rows)
 * so the saved page can show Pending approval / Published / Rejected badges.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("pending_looks")
    .select("id, look_id, generated_image, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    // look_id column may not exist on older databases — retry without it
    const fallback = await supabase
      .from("pending_looks")
      .select("id, generated_image, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (fallback.error) {
      return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    }
    return NextResponse.json(
      (fallback.data ?? []).map((r) => ({
        id: r.id,
        lookId: null,
        generatedImage: r.generated_image,
        status: r.status,
      }))
    );
  }

  return NextResponse.json(
    (data ?? []).map((r) => ({
      id: r.id,
      lookId: r.look_id ?? null,
      generatedImage: r.generated_image,
      status: r.status,
    }))
  );
}
