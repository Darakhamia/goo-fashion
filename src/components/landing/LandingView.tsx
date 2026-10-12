import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import Breadcrumbs, { type Crumb } from "@/components/ui/Breadcrumbs";
import JsonLd from "@/components/seo/JsonLd";
import { absoluteUrl, breadcrumbJsonLd } from "@/lib/seo";
import type { Landing, LandingCopy, LandingLink } from "@/lib/server/landing";

interface ShellProps {
  path: string;
  copy: LandingCopy;
  /** Small caps above the heading, from md: "Brand", "Category". */
  eyebrow: string;
  crumbs: Crumb[];
  related: { title: string; links: LandingLink[] }[];
  /** What the page lists, for its ItemList markup. */
  items: { url: string; name: string }[];
  /** The catalogue view with the same items, and what the link says. */
  browseHref: string;
  browseLabel: string;
  /** The grid of cards. */
  children: React.ReactNode;
}

/**
 * The frame every landing page shares: heading, a paragraph about what is
 * here, links to the neighbouring pages, the cards and a way on into the
 * catalogue (docs/SEO_PLAN.md, SEO-17). Server-rendered throughout, so the
 * list is in the HTML a crawler reads.
 */
export function LandingShell({ path, copy, eyebrow, crumbs, related, items, browseHref, browseLabel, children }: ShellProps) {
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: copy.title,
    description: copy.intro,
    url: absoluteUrl(path),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(item.url),
        name: item.name,
      })),
    },
  };
  const breadcrumb = breadcrumbJsonLd(
    crumbs.map((c) => ({ name: c.label, ...(c.href ? { url: absoluteUrl(c.href) } : {}) })),
  );

  return (
    <div className="min-h-screen">
      <JsonLd data={[collection, breadcrumb]} />
      <div className="max-w-[1440px] mx-auto px-3 md:px-12">
        {/* Phones go back with the header's back button; the trail is desktop's. */}
        <div className="hidden md:block">
          <Breadcrumbs items={crumbs} />
        </div>

        <header className="px-1 md:px-0 pt-4 md:pt-12 max-w-2xl">
          <p className="hidden md:block text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-[-0.015em] md:text-5xl md:font-black md:uppercase md:tracking-[-0.022em] text-[var(--foreground)]">
            {copy.heading}
          </h1>
          <p className="mt-2 md:mt-4 text-[15px] leading-[1.5] md:text-sm md:leading-relaxed text-[var(--foreground-muted)]">
            {copy.intro}
          </p>
        </header>

        {related.map((section) => (
          <nav key={section.title} aria-label={section.title} className="mt-5 md:mt-8 px-1 md:px-0">
            <p className="text-[15px] md:text-[10px] font-semibold md:font-medium md:tracking-[0.18em] md:uppercase text-[var(--foreground)] md:text-[var(--foreground-subtle)] mb-2 md:mb-3">
              {section.title}
            </p>
            <ul className="flex flex-wrap gap-2">
              {section.links.map((link) => (
                <li key={link.path}>
                  <Link
                    href={link.path}
                    className="max-md:relative max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-1 inline-flex items-center gap-1.5 h-9 md:h-auto px-3.5 md:px-3 md:py-1.5 rounded-full bg-[var(--fg-overlay-08)] md:bg-transparent md:border md:border-[var(--border)] text-[13px] md:text-[11px] text-[var(--foreground)] md:text-[var(--foreground-muted)] md:hover:text-[var(--foreground)] md:hover:border-[var(--foreground-muted)] transition-colors duration-200"
                  >
                    {link.name}
                    {link.count > 0 && <span className="text-[var(--foreground-subtle)]">{link.count}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="mt-5 md:mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 md:gap-4">
          {children}
        </div>

        <div className="mt-6 md:mt-10 md:pb-16 px-1 md:px-0">
          <Link
            href={browseHref}
            className="inline-flex items-center h-11 md:h-auto text-[14px] md:text-sm text-[var(--foreground)] md:text-[var(--foreground-muted)] md:hover:text-[var(--foreground)] underline underline-offset-4 transition-colors duration-200"
          >
            {browseLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

interface Props {
  page: Landing;
  copy: LandingCopy;
  eyebrow: string;
  crumbs: Crumb[];
  related: { title: string; links: LandingLink[] }[];
  /** Most products to list; the rest are behind the "see all" link. */
  limit?: number;
}

/** A landing page of products: a brand, a category, a brand's kind of thing. */
export default function LandingView({ page, copy, eyebrow, crumbs, related, limit }: Props) {
  const shown = limit ? page.products.slice(0, limit) : page.products;
  const hidden = page.products.length - shown.length;

  return (
    <LandingShell
      path={page.path}
      copy={copy}
      eyebrow={eyebrow}
      crumbs={crumbs}
      related={related}
      items={shown.map((p) => ({ url: `/product/${p.id}`, name: p.name }))}
      browseHref={page.browseHref}
      browseLabel={hidden > 0 ? `See all ${page.products.length} in the catalog` : "Filter and sort in the catalog"}
    >
      {shown.map((product) => (
        <div key={product.id} className="rounded-xl bg-[var(--background)] hover:shadow-md transition-colors duration-200">
          <ProductCard product={product} />
        </div>
      ))}
    </LandingShell>
  );
}
