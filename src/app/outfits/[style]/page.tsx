import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { LandingShell } from "@/components/landing/LandingView";
import OutfitCard from "@/components/outfit/OutfitCard";
import { otherStyles, outfitLanding, outfitLandingCopy } from "@/lib/server/outfit-landing";
import { LANDING_MAX_PRODUCTS } from "@/lib/server/landing";
import { clipText, outfitDisplayName, pageMetadata } from "@/lib/seo";

// Cached and regenerated at most every five minutes, like an outfit page.
export const revalidate = 300;
export async function generateStaticParams(): Promise<{ style: string }[]> {
  return [];
}

interface Props {
  params: Promise<{ style: string }>;
}

const load = cache(async (style: string) => {
  const page = await outfitLanding(style);
  if (!page) return undefined;
  return { page, copy: outfitLandingCopy(page) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { style } = await params;
  const found = await load(style);
  if (!found) return {};
  const { page, copy } = found;
  const cover = page.outfits.find((o) => o.imageUrl);
  return pageMetadata({
    title: copy.title,
    description: clipText(copy.intro),
    path: page.path,
    noindex: !page.indexable,
    ...(cover ? { images: [{ url: cover.imageUrl, alt: outfitDisplayName(cover) }] } : {}),
  });
}

/**
 * Outfit ideas of one style — "Streetwear Outfit Ideas": complete looks a
 * shopper can buy piece by piece, which no single store's page offers (SEO-17).
 */
export default async function OutfitStylePage({ params }: Props) {
  const { style } = await params;
  const found = await load(style);
  if (!found) notFound();
  const { page, copy } = found;
  const shown = page.outfits.slice(0, LANDING_MAX_PRODUCTS);
  const hidden = page.outfits.length - shown.length;
  const others = await otherStyles(page);

  return (
    <LandingShell
      path={page.path}
      copy={copy}
      eyebrow="Outfit ideas"
      crumbs={[
        { label: "Home", href: "/" },
        { label: "Outfits", href: "/browse?view=outfits" },
        { label: page.label },
      ]}
      related={others.length ? [{ title: "Other styles", links: others }] : []}
      items={shown.map((o) => ({ url: `/outfit/${o.id}`, name: outfitDisplayName(o) }))}
      browseHref={`/browse?view=outfits&style=${page.style}`}
      browseLabel={hidden > 0 ? `See all ${page.outfits.length} in the catalog` : "Filter and sort in the catalog"}
    >
      {shown.map((outfit) => (
        <div key={outfit.id} className="rounded-xl bg-[var(--background)] hover:shadow-md transition-colors duration-200">
          <OutfitCard outfit={outfit} />
        </div>
      ))}
    </LandingShell>
  );
}
