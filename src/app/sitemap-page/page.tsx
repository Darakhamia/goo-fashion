import type { Metadata } from "next";
import Link from "next/link";
import { getAllProducts, getAllOutfits, getAllBlogPosts } from "@/lib/data/db";

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
    ],
  },
];

export default async function SitemapPage() {
  const [products, outfits, blogPosts] = await Promise.all([
    getAllProducts().catch(() => []),
    getAllOutfits().catch(() => []),
    getAllBlogPosts({ publishedOnly: true }).catch(() => []),
  ]);

  return (
    <div className="pt-16 min-h-screen">

      {/* Hero */}
      <section className="max-w-[1440px] mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-16">
        <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-[var(--foreground-subtle)] mb-4">
          Navigation
        </p>
        <h1 className="font-display text-5xl md:text-6xl font-light text-[var(--foreground)] leading-[1.05]">
          Sitemap
        </h1>
        <p className="mt-4 text-sm text-[var(--foreground-muted)] max-w-sm">
          Every page on GOO — organised by section.
        </p>
      </section>

      {/* Static sections */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border)]">
            {SITE_SECTIONS.map((section) => (
              <div key={section.label} className="bg-[var(--background)] p-8">
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-6">
                  {section.label}
                </p>
                <ul className="space-y-3">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-150"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Outfits count tile */}
            <div className="bg-[var(--background)] p-8 flex flex-col justify-between">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-6">
                Outfits
              </p>
              <p className="font-display text-5xl font-light text-[var(--foreground)]">
                {outfits.length}
              </p>
              <Link
                href="/browse"
                className="mt-6 self-start text-[10px] tracking-[0.14em] uppercase text-[var(--foreground)] border border-[var(--border)] px-4 py-2 hover:border-[var(--foreground)] transition-colors duration-200"
              >
                Browse all →
              </Link>
            </div>

            {/* Products count tile */}
            <div className="bg-[var(--surface)] p-8 flex flex-col justify-between">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-6">
                Products
              </p>
              <p className="font-display text-5xl font-light text-[var(--foreground)]">
                {products.length}
              </p>
              <Link
                href="/browse"
                className="mt-6 self-start text-[10px] tracking-[0.14em] uppercase text-[var(--foreground)] border border-[var(--border)] px-4 py-2 hover:border-[var(--foreground)] transition-colors duration-200"
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
          <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-12 md:gap-20 items-start">
              <div>
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-2">
                  Outfits
                </p>
                <p className="font-display text-3xl font-light text-[var(--foreground)]">
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
                        <p className="text-sm text-[var(--foreground)] group-hover:opacity-60 transition-opacity duration-150 truncate">
                          {outfit.name}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5 capitalize">
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
          <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-12 md:gap-20 items-start">
              <div>
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-2">
                  Products
                </p>
                <p className="font-display text-3xl font-light text-[var(--foreground)]">
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
                        <p className="text-sm text-[var(--foreground)] group-hover:opacity-60 transition-opacity duration-150 truncate">
                          {product.name}
                        </p>
                        <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">
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
          <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-16 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr] gap-12 md:gap-20 items-start">
              <div>
                <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-2">
                  Journal
                </p>
                <p className="font-display text-3xl font-light text-[var(--foreground)]">
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
                        <p className="text-sm text-[var(--foreground)] group-hover:opacity-60 transition-opacity duration-150">
                          {post.title}
                        </p>
                        {post.publishedAt && (
                          <p className="text-[10px] text-[var(--foreground-subtle)] mt-1">
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
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-10 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
            goo-fashion.com · Updated hourly
          </p>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
          >
            XML Sitemap ↗
          </a>
        </div>
      </section>

    </div>
  );
}
