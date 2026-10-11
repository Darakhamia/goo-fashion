import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import LandingView from "@/components/landing/LandingView";
import {
  LANDING_MAX_PRODUCTS,
  categoryLanding,
  landingCopy,
  loadLandingCatalog,
  relatedLinks,
} from "@/lib/server/landing";
import { clipText, pageMetadata } from "@/lib/seo";

// Cached and regenerated at most every five minutes, like a product page.
export const revalidate = 300;
export async function generateStaticParams(): Promise<{ category: string }[]> {
  return [];
}

interface Props {
  params: Promise<{ category: string }>;
}

const load = cache(async (groupId: string) => {
  const page = await categoryLanding(groupId);
  if (!page?.products.length) return undefined;
  const { tree } = await loadLandingCatalog();
  return { page, copy: landingCopy(page, tree) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const found = await load(decodeURIComponent(category));
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

/** A category group's landing page — "Footwear", "Outerwear" (SEO-17). */
export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const found = await load(decodeURIComponent(category));
  if (!found) notFound();
  const { page, copy } = found;

  return (
    <LandingView
      page={page}
      copy={copy}
      eyebrow="Category"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Browse", href: "/browse" },
        { label: page.name },
      ]}
      related={await relatedLinks(page)}
      limit={LANDING_MAX_PRODUCTS}
    />
  );
}
