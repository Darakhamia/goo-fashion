import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import LandingView from "@/components/landing/LandingView";
import {
  LANDING_MAX_PRODUCTS,
  landingCopy,
  loadLandingCatalog,
  relatedLinks,
  subcategoryLanding,
} from "@/lib/server/landing";
import { clipText, pageMetadata } from "@/lib/seo";

// Cached and regenerated at most every five minutes, like a product page.
export const revalidate = 300;
export async function generateStaticParams(): Promise<{ category: string; subcategory: string }[]> {
  return [];
}

interface Props {
  params: Promise<{ category: string; subcategory: string }>;
}

const load = cache(async (groupId: string, slug: string) => {
  const page = await subcategoryLanding(groupId, slug);
  if (!page?.products.length) return undefined;
  const { tree } = await loadLandingCatalog();
  return { page, copy: landingCopy(page, tree) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, subcategory } = await params;
  const found = await load(decodeURIComponent(category), subcategory);
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

/** A subcategory's landing page — "Boots", "Sneakers" (SEO-17). */
export default async function SubcategoryPage({ params }: Props) {
  const { category, subcategory } = await params;
  const found = await load(decodeURIComponent(category), subcategory);
  if (!found) notFound();
  const { page, copy } = found;

  return (
    <LandingView
      page={page}
      copy={copy}
      eyebrow={page.parent?.name ?? "Category"}
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Browse", href: "/browse" },
        ...(page.parent ? [{ label: page.parent.name, href: page.parent.path }] : []),
        { label: page.name },
      ]}
      related={await relatedLinks(page)}
      limit={LANDING_MAX_PRODUCTS}
    />
  );
}
