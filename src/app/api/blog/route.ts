import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createBlogPost, getAllBlogPosts, blogPostToDb } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  // ?all=true returns drafts too (admin list). Default: published-only.
  const publishedOnly = url.searchParams.get("all") !== "true";
  const posts = await getAllBlogPosts({ publishedOnly });
  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 501 }
    );
  }

  const body = await req.json();
  if (!body.slug || !body.title) {
    return NextResponse.json({ error: "slug and title are required." }, { status: 400 });
  }

  const row = blogPostToDb(body);
  const { post, error } = await createBlogPost(row);

  if (!post) {
    const msg = error ?? "Failed to create blog post.";
    const status = msg.includes("duplicate") || msg.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/sitemap.xml");

  return NextResponse.json(post, { status: 201 });
}
