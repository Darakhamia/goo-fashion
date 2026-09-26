import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { updateBlogPost, deleteBlogPost, blogPostToDb } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";

/**
 * The post's slug as stored now, read before a rename or delete: /blog/<slug>
 * is cached, and the old address has to be dropped from that cache too.
 */
async function currentSlug(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[api/blog] current slug:", error.message);
    return null;
  }
  return (data?.slug as string | undefined) || null;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const { id } = await params;
  const body = await req.json();
  const row = blogPostToDb(body);
  const previousSlug = await currentSlug(id);
  const { post, error } = await updateBlogPost(id, row);

  if (!post) {
    const msg = error ?? "Failed to update blog post.";
    const status = msg.includes("duplicate") || msg.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  if (previousSlug && previousSlug !== post.slug) revalidatePath(`/blog/${previousSlug}`);
  revalidatePath("/sitemap.xml");

  return NextResponse.json(post);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "Database not configured." }, { status: 501 });
  }

  const { id } = await params;
  const slug = await currentSlug(id);
  const ok = await deleteBlogPost(id);

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete blog post." }, { status: 500 });
  }

  revalidatePath("/blog");
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath("/sitemap.xml");

  return NextResponse.json({ success: true });
}
