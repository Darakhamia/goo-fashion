import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllBlogPosts, getBlogPostBySlug } from "@/lib/data/db";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) {
    return { title: "Post not found — GOO" };
  }
  const title = post.metaTitle || `${post.title} — GOO Journal`;
  const description = post.metaDescription || post.excerpt;
  const image = post.ogImage || post.coverImageUrl;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: image ? [{ url: image }] : undefined,
      publishedTime: post.publishedAt,
      authors: [post.authorName],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post || !post.isPublished) notFound();

  const all = await getAllBlogPosts({ publishedOnly: true });
  const related = all.filter((p) => p.slug !== post.slug).slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: post.coverImageUrl || undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: post.authorName },
    articleSection: post.category,
  };

  return (
    <article className="pt-16 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-[820px] mx-auto px-6 md:px-12 pt-12 md:pt-20 pb-8">
        {/* Breadcrumb */}
        <Link
          href="/blog"
          className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          ← Journal
        </Link>

        {/* Meta row */}
        <div className="flex items-center gap-4 mt-10 mb-5">
          <span className="text-[9px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] border border-[var(--border)] px-2.5 py-1">
            {post.category}
          </span>
          <span className="text-[10px] text-[var(--foreground-subtle)]">
            {post.readTime} read
          </span>
          <span className="text-[10px] text-[var(--foreground-subtle)]">
            {formatDate(post.publishedAt)}
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] leading-tight tracking-tight mb-6">
          {post.title}
        </h1>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-base md:text-lg text-[var(--foreground-muted)] leading-relaxed mb-10">
            {post.excerpt}
          </p>
        )}
      </div>

      {/* Cover */}
      {post.coverImageUrl && (
        <div className="max-w-[1200px] mx-auto px-6 md:px-12 mb-12">
          <div className="aspect-[16/9] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImageUrl}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-[720px] mx-auto px-6 md:px-12 pb-16">
        {post.body ? (
          <div
            className="blog-prose text-[var(--foreground)] text-base leading-relaxed"
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
        ) : (
          <p className="text-sm text-[var(--foreground-muted)] italic">
            Full article coming soon.
          </p>
        )}

        <div className="mt-16 pt-8 border-t border-[var(--border)]">
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">
            Written by {post.authorName}
          </p>
        </div>
      </div>

      {/* Related */}
      {related.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-6 md:px-12 pb-20">
          <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
            Keep reading
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group bg-[var(--background)] flex flex-col"
              >
                <div className="overflow-hidden aspect-[3/2]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.coverImageUrl}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[9px] tracking-[0.16em] uppercase font-medium text-[var(--foreground-subtle)]">
                      {p.category}
                    </span>
                    <span className="w-px h-3 bg-[var(--border-strong)]" />
                    <span className="text-[10px] text-[var(--foreground-subtle)]">
                      {p.readTime} read
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-light text-[var(--foreground)] leading-snug group-hover:opacity-70 transition-opacity duration-200">
                    {p.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
