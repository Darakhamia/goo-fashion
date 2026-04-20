import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { updateBlogPost, deleteBlogPost, blogPostToDb } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";

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
  const { post, error } = await updateBlogPost(id, row);

  if (!post) {
    const msg = error ?? "Failed to update blog post.";
    const status = msg.includes("duplicate") || msg.includes("unique") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

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
  const ok = await deleteBlogPost(id);

  if (!ok) {
    return NextResponse.json({ error: "Failed to delete blog post." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
