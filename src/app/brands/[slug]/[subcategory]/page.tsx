import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import LandingView from "@/components/landing/LandingView";
import {
  LANDING_MAX_PRODUCTS,
  brandSubcategoryLanding,
  landingCopy,
  loadLandingCatalog,
  relatedLinks,
} from "@/lib/server/landing";
import { clipText, pageMetadata } from "@/lib/seo";

// Cached and regenerated at most every five minutes, like a product page.
export const revalidate = 300;
export async function generateStaticParams(): Promise<{ slug: string; subcategory: string }[]> {
  return [];
}

interface Props {
  params: Promise<{ slug: string; subcategory: string }>;
}

const load = cache(async (slug: string, subcategory: string) => {
  const page = await brandSubcategoryLanding(slug, subcategory);
  if (!page?.products.length) return undefined;
  const { tree } = await loadLandingCatalog();
  return { page, copy: landingCopy(page, tree) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, subcategory } = await params;
  const found = await load(slug, subcategory);
  if (!found) return {};
  const { page, copy } = found;
  const cover = page.products.find((p) => p.imageUrl);
  return pageMetadata({
    title: copy.title,
    description: clipText(copy.intro),
    path: page.path,
    noindex: !page.indexable,
    ...(cover ? { images: [{ url: cover.imageUrl, alt: `${page.name} — ${cover.name}` }] } : {}),
  });
}

/**
 * One brand's pieces of one kind — "Timberland Boots", "Balenciaga Sneakers":
 * the query a shopper types when they already know what they want (SEO-17).
 */
export default async function BrandSubcategoryPage({ params }: Props) {
  const { slug, subcategory } = await params;
  const found = await load(slug, subcategory);
  if (!found) notFound();
  const { page, copy } = found;

  return (
    <LandingView
      page={page}
      copy={copy}
      eyebrow={page.parent?.name ?? "Brand"}
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Brands", href: "/brands" },
        ...(page.parent ? [{ label: page.parent.name, href: page.parent.path }] : []),
        { label: page.facet?.label ?? page.name },
      ]}
      related={await relatedLinks(page)}
      limit={LANDING_MAX_PRODUCTS}
    />
  );
}
