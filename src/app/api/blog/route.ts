import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase";
import { createBlogPost, readAllBlogPosts, blogPostToDb } from "@/lib/data/db";
import { requireAdmin } from "@/lib/server/admin-auth";

// Admin list only — drafts included. The public /blog pages read posts through
// db.ts on the server and never call this route.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { posts, error } = await readAllBlogPosts();
  if (error) {
    return NextResponse.json({ error: `Could not load posts: ${error}` }, { status: 500 });
  }
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
