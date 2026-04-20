import Link from "next/link";
import type { Metadata } from "next";
import { getAllBlogPosts } from "@/lib/data/db";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Journal — GOO",
  description:
    "Style essays, shopping guides, and insights from the GOO stylist team. Updated weekly.",
  openGraph: {
    title: "Journal — GOO",
    description:
      "Style essays, shopping guides, and insights from the GOO stylist team.",
    type: "website",
  },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default async function BlogPage() {
  const posts = await getAllBlogPosts({ publishedOnly: true });

  if (posts.length === 0) {
    return (
      <div className="pt-16 min-h-screen">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 pt-16 md:pt-24">
          <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-[var(--foreground-subtle)] mb-4">
            Journal
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-light text-[var(--foreground)] leading-[0.95] tracking-tight">
            Style, explained.
          </h1>
          <p className="mt-8 text-sm text-[var(--foreground-muted)]">
            New posts coming soon.
          </p>
        </div>
      </div>
    );
  }

  const [featured, ...rest] = posts;

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">

        {/* Header */}
        <div className="pt-16 md:pt-24 mb-16 md:mb-20">
          <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-[var(--foreground-subtle)] mb-4">
            Journal
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-light text-[var(--foreground)] leading-[0.95] tracking-tight">
            Style, explained.
          </h1>
        </div>

        {/* Featured post */}
        <Link href={`/blog/${featured.slug}`} className="group block mb-px">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border)]">
            <div className="bg-[var(--background)] overflow-hidden">
              <div className="aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={featured.coverImageUrl}
                  alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
                />
              </div>
            </div>
            <div className="bg-[var(--background)] p-8 md:p-12 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[9px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] border border-[var(--border)] px-2.5 py-1">
                    {featured.category}
                  </span>
                  <span className="text-[10px] text-[var(--foreground-subtle)]">
                    {featured.readTime} read
                  </span>
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)] leading-snug mb-4 group-hover:opacity-70 transition-opacity duration-200">
                  {featured.title}
                </h2>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                  {featured.excerpt}
                </p>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <span className="text-xs text-[var(--foreground-subtle)]">
                  {formatDate(featured.publishedAt)}
                </span>
                <span className="text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] group-hover:text-[var(--foreground)] transition-colors duration-200">
                  Read →
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* Post grid */}
        {rest.length > 0 && (
          <div className="mt-px grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
            {rest.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group bg-[var(--background)] flex flex-col"
              >
                <div className="overflow-hidden aspect-[3/2]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.coverImageUrl}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                  />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-[9px] tracking-[0.16em] uppercase font-medium text-[var(--foreground-subtle)]">
                      {post.category}
                    </span>
                    <span className="w-px h-3 bg-[var(--border-strong)]" />
                    <span className="text-[10px] text-[var(--foreground-subtle)]">
                      {post.readTime} read
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-light text-[var(--foreground)] leading-snug mb-3 group-hover:opacity-70 transition-opacity duration-200">
                    {post.title}
                  </h3>
                  <p className="text-xs text-[var(--foreground-muted)] leading-relaxed flex-1">
                    {post.excerpt}
                  </p>
                  <p className="mt-4 text-[10px] text-[var(--foreground-subtle)]">
                    {formatDate(post.publishedAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Newsletter strip */}
        <div className="mt-px bg-[var(--border)]">
          <div className="bg-[var(--surface)] px-8 md:px-16 py-12 md:py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
                Newsletter
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)]">
                Style notes, weekly.
              </h2>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                One email. No spam. Unsubscribe anytime.
              </p>
            </div>
            <div className="flex gap-0 w-full md:w-auto">
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 md:w-64 px-4 py-3 text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] outline-none focus:border-[var(--foreground-muted)] transition-colors duration-200"
              />
              <button className="px-6 py-3 text-xs tracking-[0.14em] uppercase font-medium bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity duration-200 shrink-0">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        <div className="mb-16" />
      </div>
    </div>
  );
}
