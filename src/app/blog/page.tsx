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

        {/* Newsletter strip */}
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-8 md:px-16 py-12 md:py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
              Newsletter
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-[var(--foreground)]">
              Style notes, weekly.
            </h2>
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              One email. No spam. Unsubscribe anytime.
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            {/* min-w-0: an input's min-width defaults to its intrinsic size, so
                flex-1 alone won't let it shrink and the row pushes the page wide. */}
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 min-w-0 md:w-64 px-4 py-3 text-base md:text-[13px] bg-[var(--background)] border border-[var(--border)] rounded-xl text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--border-strong)] transition-colors duration-200"
            />
            <button className="px-6 py-3 text-xs tracking-[0.14em] uppercase font-medium rounded-xl bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity duration-200 shrink-0">
              Subscribe
            </button>
          </div>
        </div>

        <div className="mb-16" />
      </div>
    </div>
  );
}
