import type { Metadata } from "next";
import { getAllBlogPosts } from "@/lib/data/db";
import JournalFeed from "@/components/blog/JournalFeed";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Journal — GOO",
  description:
    "Style essays, shopping guides, product updates and announcements from GOO. Filter by topic or year.",
  openGraph: {
    title: "Journal — GOO",
    description:
      "Style essays, shopping guides, product updates and announcements from GOO.",
    type: "website",
  },
};

export default async function BlogPage() {
  const posts = await getAllBlogPosts({ publishedOnly: true });

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="pt-16 md:pt-24 mb-10 md:mb-14">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-4">
            Journal
          </p>
          <h1 className="text-5xl md:text-7xl font-black uppercase text-[var(--foreground)] leading-[0.95] tracking-tight">
            Style, explained.
          </h1>
          <p className="mt-6 max-w-xl text-sm text-[var(--foreground-muted)] leading-relaxed">
            What we are reading in fashion, and what we are shipping at GOO.
          </p>
        </div>

        {posts.length === 0 ? (
          <p className="border-t border-[var(--border)] pt-8 text-sm text-[var(--foreground-muted)]">
            New posts coming soon.
          </p>
        ) : (
          // The feed and its filters are the only client-side part of the page;
          // the shell above stays static and cached.
          <JournalFeed posts={posts} />
        )}

        <div className="mb-16" />
      </div>
    </div>
  );
}
