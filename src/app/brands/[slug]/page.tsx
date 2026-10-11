import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import LandingView from "@/components/landing/LandingView";
import { brandLanding, landingCopy, loadLandingCatalog, relatedLinks } from "@/lib/server/landing";
import { clipText, pageMetadata } from "@/lib/seo";

// Cached and regenerated at most every five minutes, like a product page; an
// empty list prerenders none at build time and caches each on its first visit.
export const revalidate = 300;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

interface Props {
  params: Promise<{ slug: string }>;
}

const load = cache(async (slug: string) => {
  const page = await brandLanding(slug);
  if (!page) return undefined;
  const { tree } = await loadLandingCatalog();
  return { page, copy: landingCopy(page, tree) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
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

/** A brand's landing page: every product of it, newest first (SEO-17). */
export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { page, copy } = found;

  return (
    <LandingView
      page={page}
      copy={copy}
      eyebrow="Brand"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Brands", href: "/brands" },
        { label: page.name },
      ]}
      related={await relatedLinks(page)}
    />
  );
}
