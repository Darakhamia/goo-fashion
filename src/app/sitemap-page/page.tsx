import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts, getAllOutfits, getAllBlogPosts } from "@/lib/data/db";
import { withTimeout } from "@/lib/server/with-timeout";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Sitemap — GOO",
  description: "Complete map of all pages, outfits, products, and articles on GOO.",
};

const SITE_SECTIONS = [
  {
    label: "Main",
    links: [
      { href: "/", label: "Home" },
      { href: "/browse", label: "Browse Outfits" },
      { href: "/plans", label: "Plans & Pricing" },
      { href: "/about", label: "About" },
      { href: "/blog", label: "Journal" },
    ],
  },
  {
    label: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/cookie", label: "Cookie Policy" },
      { href: "/refund", label: "Refund Policy" },
    ],
  },
];

export default async function SitemapPage() {
  // Bounded, not just error-handled: this runs during `next build`, and a
  // database that goes quiet rather than failing would otherwise hang the deploy
  // until the platform's own timeout kills it. See lib/server/with-timeout.
  const [products, outfits, blogPosts] = await Promise.all([
    withTimeout(getAllProducts(), [], "sitemap products"),
    withTimeout(getAllOutfits(), [], "sitemap outfits"),
    withTimeout(getAllBlogPosts({ publishedOnly: true }), [], "sitemap posts"),
  ]);

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="max-w-[1440px] mx-auto px-5 md:px-12 pt-6 md:pt-24 pb-8 md:pb-16">
        <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-[var(--foreground-subtle)] mb-4 max-md:hidden">
          Navigation
        </p>
        <h1 className="text-5xl md:text-6xl font-black uppercase text-[var(--foreground)] leading-[1.05] max-md:text-[28px] max-md:font-semibold max-md:normal-case max-md:leading-[1.15]">
          Sitemap
        </h1>
        <p className="mt-4 text-sm text-[var(--foreground-muted)] max-w-sm max-md:mt-1.5 max-md:text-[15px]">
          Every page on GOO — organised by section.
        </p>
      </section>

      {/* Static sections */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-8 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border)] max-md:gap-2.5 max-md:bg-transparent">
            {SITE_SECTIONS.map((section) => (
              <div key={section.label} className="bg-[var(--background)] p-8 max-md:rounded-2xl max-md:bg-[var(--surface)] max-md:px-4 max-md:pt-3.5 max-md:pb-1">
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-6 max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-1">
                  {section.label}
                </p>
                <ul className="space-y-3 max-md:space-y-0">
                  {section.links.map((link) => (
                    <li key={link.href} className="max-md:not-first:shadow-[inset_0_1px_0_var(--border)]">
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-150 max-md:flex max-md:h-11 max-md:items-center max-md:text-base max-md:text-[var(--foreground)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Outfits count tile */}
            <div className="bg-[var(--background)] p-8 flex flex-col justify-between max-md:rounded-2xl max-md:bg-[var(--surface)] max-md:p-4">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-6 max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-1">
                Outfits
              </p>
              <p className="text-5xl font-black text-[var(--foreground)] max-md:text-[32px] max-md:font-semibold">
                {outfits.length}
              </p>
              <Link
                href="/browse"
                className="mt-6 self-start text-[10px] tracking-[0.14em] uppercase text-[var(--foreground)] border border-[var(--border)] px-4 py-2 hover:border-[var(--foreground)] transition-colors duration-200 max-md:mt-3 max-md:inline-flex max-md:h-11 max-md:items-center max-md:px-4 max-md:py-0 max-md:rounded-full max-md:border-0 max-md:bg-[var(--fg-overlay-08)] max-md:text-[15px] max-md:normal-case max-md:tracking-normal"
              >
                Browse all →
              </Link>
            </div>

            {/* Products count tile */}
            <div className="bg-[var(--surface)] p-8 flex flex-col justify-between max-md:rounded-2xl max-md:p-4">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-6 max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-1">
                Products
              </p>
              <p className="text-5xl font-black text-[var(--foreground)] max-md:text-[32px] max-md:font-semibold">
                {products.length}
              </p>
              <Link
                href="/browse"
                className="mt-6 self-start text-[10px] tracking-[0.14em] uppercase text-[var(--foreground)] border border-[var(--border)] px-4 py-2 hover:border-[var(--foreground)] transition-colors duration-200 max-md:mt-3 max-md:inline-flex max-md:h-11 max-md:items-center max-md:px-4 max-md:py-0 max-md:rounded-full max-md:border-0 max-md:bg-[var(--fg-overlay-08)] max-md:text-[15px] max-md:normal-case max-md:tracking-normal"
              >
                Explore →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Outfits list */}
      {outfits.length > 0 && (
        <section className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-8 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-4 md:gap-20 items-start">
              <div>
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-2 max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-1">
                  Outfits
                </p>
                <p className="text-3xl font-bold text-[var(--foreground)] max-md:text-2xl max-md:font-semibold">
                  {outfits.length} looks
                </p>
              </div>
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-px">
                {outfits.map((outfit) => (
                  <div
                    key={outfit.id}
                    className="break-inside-avoid border-b border-[var(--border)] py-4 first:pt-0"
                  >
                    <Link
                      href={`/outfit/${outfit.id}`}
                      className="group flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--foreground)] group-hover:opacity-60 transition-opacity duration-150 truncate max-md:text-base">
                          {outfit.name}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5 capitalize max-md:text-[13px] max-md:text-[var(--foreground-muted)]">
                          {outfit.occasion}
                        </p>
                      </div>
                      <span className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)] transition-colors shrink-0 mt-0.5">
                        →
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Products list */}
      {products.length > 0 && (
        <section className="border-t border-[var(--border)]">
          <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-8 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-4 md:gap-20 items-start">
              <div>
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-2 max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-1">
                  Products
                </p>
                <p className="text-3xl font-bold text-[var(--foreground)] max-md:text-2xl max-md:font-semibold">
                  {products.length} items
                </p>
              </div>
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-px">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="break-inside-avoid border-b border-[var(--border)] py-4 first:pt-0"
                  >
                    <Link
                      href={`/product/${product.id}`}
                      className="group flex items-start justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--foreground)] group-hover:opacity-60 transition-opacity duration-150 truncate max-md:text-base">
                          {product.name}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5 max-md:text-[13px] max-md:text-[var(--foreground-muted)]">
                          {product.brand}
                        </p>
                      </div>
                      <span className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)] transition-colors shrink-0 mt-0.5">
                        →
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Blog list */}
      {blogPosts.length > 0 && (
        <section className="border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-8 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-4 md:gap-20 items-start">
              <div>
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-2 max-md:font-sans max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)] max-md:mb-1">
                  Journal
                </p>
                <p className="text-3xl font-bold text-[var(--foreground)] max-md:text-2xl max-md:font-semibold">
                  {blogPosts.length} articles
                </p>
              </div>
              <div className="space-y-0">
                {blogPosts.map((post) => (
                  <div
                    key={post.slug}
                    className="border-b border-[var(--border)] py-5 first:pt-0"
                  >
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group flex items-start justify-between gap-6"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--foreground)] group-hover:opacity-60 transition-opacity duration-150 max-md:text-base">
                          {post.title}
                        </p>
                        {post.publishedAt && (
                          <p className="text-[10px] text-[var(--foreground-subtle)] mt-1 max-md:text-[13px] max-md:text-[var(--foreground-muted)]">
                            {new Date(post.publishedAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      <span className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)] transition-colors shrink-0 mt-0.5">
                        →
                      </span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Footer note */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-5 md:px-12 py-6 md:py-10 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">
            goo-fashion.com · Updated hourly
          </p>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors max-md:py-2.5 max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]"
          >
            XML Sitemap ↗
          </a>
        </div>
      </section>

    </div>
  );
}
