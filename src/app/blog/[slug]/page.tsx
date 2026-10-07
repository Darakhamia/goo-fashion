import Link from "next/link";
import Image from "@/components/ui/Image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllBlogPosts, getBlogPostBySlug } from "@/lib/data/db";
import { renderBlogBody } from "@/lib/blog-render";
import JsonLd from "@/components/seo/JsonLd";
import ReadingProgress from "@/components/blog/ReadingProgress";
import ShareRow from "@/components/blog/ShareRow";
import { SITE_URL, absoluteUrl, blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/seo";

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

  // getAllBlogPosts returns newest first, so the neighbours in that array are
  // the neighbours in time: previous = published before, next = after.
  const index = all.findIndex((p) => p.slug === post.slug);
  const newer = index > 0 ? all[index - 1] : null;
  const older = index >= 0 && index < all.length - 1 ? all[index + 1] : null;

  // Prefer posts from the same category, then fill up from the rest, so a
  // thinly-populated category still gets three cards under it.
  const others = all.filter((p) => p.slug !== post.slug);
  const related = [
    ...others.filter((p) => p.category === post.category),
    ...others.filter((p) => p.category !== post.category),
  ].slice(0, 3);

  const jsonLd = blogPostingJsonLd({
    title: post.title,
    excerpt: post.excerpt,
    coverImageUrl: post.coverImageUrl,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    authorName: post.authorName,
    category: post.category,
    slug: post.slug,
  });
  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Journal", url: absoluteUrl("/blog") },
    { name: post.title },
  ]);

  return (
    <article className="min-h-screen">
      <JsonLd data={[jsonLd, breadcrumb]} />
      <ReadingProgress />

      <div className="max-w-[820px] mx-auto px-4 md:px-12 pt-5 md:pt-20 pb-0 md:pb-8">
        {/* Desktop only: on a phone the header's back button leads to the Journal (R-03). */}
        <Link
          href="/blog"
          className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors max-md:hidden"
        >
          ← Journal
        </Link>

        {/* The category is a way back into the filtered feed, not just a label —
            it is how a reader who came in from search finds the rest of a run. */}
        <div className="flex flex-wrap items-center gap-3 mt-10 mb-6 max-md:mt-0 max-md:mb-3.5 max-md:gap-2">
          {/* Phones: a soft chip — 28px, with `after:` stretching it to a 44px target. */}
          <Link
            href={`/blog?category=${encodeURIComponent(post.category)}`}
            className="relative text-[10px] tracking-[0.16em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] px-3 py-1.5 rounded-full transition-colors duration-200 max-md:h-7 max-md:flex max-md:items-center max-md:px-[11px] max-md:py-0 max-md:border-0 max-md:bg-[var(--fg-overlay-08)] max-md:text-[12px] max-md:tracking-normal max-md:normal-case max-md:text-[var(--foreground)] max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-2"
          >
            {post.category}
          </Link>
          <span className="text-[10px] text-[var(--foreground-subtle)] max-md:text-[12px] max-md:text-[var(--foreground-muted)]">{post.readTime} read</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-[1.05] tracking-tight mb-6 max-md:text-[28px] max-md:font-semibold max-md:normal-case max-md:leading-[1.15] max-md:tracking-[-0.02em] max-md:mb-3">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-lg md:text-xl text-[var(--foreground-muted)] leading-relaxed mb-8 max-md:text-[17px] max-md:leading-[1.5] max-md:mb-3.5">
            {post.excerpt}
          </p>
        )}

        {/* Byline — a hairline rule instead of a boxed card, per the site's
            "depth is a 1px border" rule. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-5 max-md:border-0 max-md:pt-0 max-md:gap-x-1">
          <span className="text-[11px] font-medium text-[var(--foreground)] max-md:text-[13px] max-md:font-normal max-md:text-[var(--foreground-muted)]">{post.authorName}</span>
          <span className="w-px h-3 bg-[var(--border-strong)] max-md:hidden" />
          <span aria-hidden="true" className="md:hidden text-[13px] text-[var(--foreground-muted)]">·</span>
          <span className="text-[11px] text-[var(--foreground-subtle)] max-md:text-[13px] max-md:text-[var(--foreground-muted)]">
            {formatDate(post.publishedAt)}
          </span>
        </div>
      </div>

      {/* Cover */}
      {post.coverImageUrl && (
        <div className="max-w-[1200px] mx-auto px-4 md:px-12 mb-14 max-md:mt-[18px] max-md:mb-0">
          <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-[var(--border)] max-md:rounded-[18px] max-md:border-0">
            <Image
              src={post.coverImageUrl}
              alt={post.title}
              fill
              priority
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover"
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-[720px] mx-auto px-4 md:px-12 pb-16 max-md:pt-[22px] max-md:pb-7">
        {post.body ? (
          <div
            className="blog-prose text-[var(--foreground)]"
            dangerouslySetInnerHTML={{ __html: renderBlogBody(post.body) }}
          />
        ) : (
          <p className="text-sm text-[var(--foreground-muted)] italic max-md:text-[17px] max-md:leading-[1.6]">
            Full article coming soon.
          </p>
        )}

        <div className="mt-16 pt-8 border-t border-[var(--border)] max-md:mt-7 max-md:pt-0 max-md:border-0">
          <ShareRow title={post.title} />
        </div>
      </div>

      {/* Previous / next in time */}
      {(newer || older) && (
        <nav
          aria-label="More posts"
          className="max-w-[1440px] mx-auto px-3 md:px-12 pb-16 grid grid-cols-1 md:grid-cols-2 gap-4 max-md:pb-2 max-md:gap-2.5"
        >
          {[
            { post: older, label: "Previous" },
            { post: newer, label: "Next" },
          ].map(({ post: p, label }) =>
            p ? (
              <Link
                key={label}
                href={`/blog/${p.slug}`}
                className={`group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8 hover:border-[var(--border-strong)] transition-colors duration-200 max-md:rounded-[18px] max-md:border-0 max-md:p-4 ${
                  label === "Next" ? "md:text-right" : ""
                }`}
              >
                <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3 max-md:mb-1.5 max-md:text-[12px] max-md:tracking-normal max-md:normal-case max-md:font-normal max-md:text-[var(--foreground-muted)]">
                  {label === "Next" ? "Newer →" : "← Older"}
                </p>
                <p className="text-[15px] font-semibold text-[var(--foreground)] leading-snug group-hover:opacity-70 transition-opacity duration-200 max-md:text-[16px]">
                  {p.title}
                </p>
                <p className="mt-2 text-[10px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] max-md:mt-0.5 max-md:text-[12px] max-md:tracking-normal max-md:normal-case max-md:text-[var(--foreground-muted)]">
                  {p.category}
                </p>
              </Link>
            ) : (
              <span key={label} className="hidden md:block" />
            )
          )}
        </nav>
      )}

      {/* Related — same card recipe as the feed, so the two pages agree */}
      {related.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-4 md:px-12 pb-20 max-md:pt-6 max-md:pb-8">
          {/* Phones: a 20px section heading and a sideways rail of cards (mockup v2 «Б · Статья»). */}
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6 max-md:text-[20px] max-md:font-semibold max-md:tracking-[-0.01em] max-md:normal-case max-md:text-[var(--foreground)] max-md:mb-3">
            Keep reading
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-md:flex max-md:gap-2.5 max-md:overflow-x-auto max-md:no-scrollbar max-md:-mx-4 max-md:px-4">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--border-strong)] transition-colors duration-200 max-md:w-[250px] max-md:shrink-0 max-md:rounded-2xl max-md:border-0"
              >
                <div className="img-zoom relative aspect-[3/2] overflow-hidden">
                  <Image
                    src={p.coverImageUrl}
                    alt={p.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-6 max-md:px-3.5 max-md:pt-3 max-md:pb-3.5">
                  <div className="flex items-center gap-3 mb-3 max-md:gap-1 max-md:mb-0.5">
                    <span className="text-[10px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] max-md:text-[12px] max-md:tracking-normal max-md:normal-case max-md:text-[var(--foreground-muted)]">
                      {p.category}
                    </span>
                    <span className="w-px h-3 bg-[var(--border-strong)] max-md:hidden" />
                    <span aria-hidden="true" className="md:hidden text-[12px] text-[var(--foreground-muted)]">·</span>
                    <span className="text-[10px] text-[var(--foreground-subtle)] max-md:text-[12px] max-md:text-[var(--foreground-muted)]">
                      {p.readTime} read
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-[var(--foreground)] leading-snug group-hover:opacity-70 transition-opacity duration-200">
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
