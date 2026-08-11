import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "@/components/ui/Image";
import OutfitCard from "@/components/outfit/OutfitCard";
import OutfitCollage from "@/components/outfit/OutfitCollage";
import OutfitActions from "@/components/outfit/OutfitActions";
import OutfitLikeButton from "@/components/outfit/OutfitLikeButton";
import OutfitPieces from "@/components/outfit/OutfitPieces";
import RecordRecentView from "@/components/RecordRecentView";
import RecentlyViewed from "@/components/product/RecentlyViewed";
import { ClampedHeading, ClampedDescription } from "@/components/ui/ClampedText";
import Breadcrumbs, { type Crumb } from "@/components/ui/Breadcrumbs";
import { getOutfitById, getAllOutfits } from "@/lib/data/db";
import Price from "@/components/ui/Price";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, absoluteUrl, buildOutfitSeo, outfitJsonLd, breadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const outfit = await getOutfitById(id);
  if (!outfit) return {};

  // Derive a unique title/description from the outfit's own data so the
  // generically-named "Community Look" pages don't read as duplicates.
  const { title, description } = buildOutfitSeo(outfit);

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/outfit/${id}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/outfit/${id}`,
      type: "website",
      images: outfit.imageUrl ? [{ url: outfit.imageUrl, alt: outfit.name }] : [],
    },
  };
}

export default async function OutfitDetailPage({ params }: Props) {
  const { id } = await params;
  const [outfit, allOutfits] = await Promise.all([getOutfitById(id), getAllOutfits()]);

  if (!outfit) notFound();

  const relatedOutfits = allOutfits
    .filter((o) => o.id !== outfit.id && o.occasion === outfit.occasion)
    .slice(0, 4);

  const { heading, description: seoDescription } = buildOutfitSeo(outfit);
  // Home / Browse / Outfits / Occasion / AI / Name — the optional steps drop
  // out when the outfit doesn't carry them, and each links back into the
  // catalog with that filter applied.
  const q = (params: Record<string, string>) =>
    `/browse?${new URLSearchParams({ view: "outfits", ...params })}`;
  const outfitCrumbs: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/browse" },
    { label: "Outfits", href: q({}) },
  ];
  if (outfit.occasion) outfitCrumbs.push({ label: outfit.occasion, href: q({ occasion: outfit.occasion }) });
  if (outfit.isAIGenerated) outfitCrumbs.push({ label: "AI", href: q({ ai: "1" }) });
  outfitCrumbs.push({ label: heading });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Outfits", url: absoluteUrl("/browse") },
    { name: heading },
  ]);

  return (
    <div className="min-h-screen">
      <JsonLd data={[outfitJsonLd(outfit, heading), breadcrumb]} />
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <RecordRecentView kind="outfit" id={outfit.id} />

        <Breadcrumbs items={outfitCrumbs} />

        {/* Main layout — same column sizing as the product page, so the image
            keeps a sane width and the info panel takes the rest. */}
        <div className="mt-8 md:mt-12 grid grid-cols-1 md:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] gap-6 md:gap-10">
          {/* Left: Editorial Image */}
          <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--background)] md:self-start">
            <div className="relative aspect-[3/4] overflow-hidden">
              {outfit.imageUrl ? (
                <Image
                  src={outfit.imageUrl}
                  alt={outfit.name}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <OutfitCollage
                  outfit={outfit}
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              )}
              {outfit.isAIGenerated && (
                <div className="absolute top-4 left-4">
                  <span className="text-[9px] tracking-[0.16em] uppercase font-medium bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full block">
                    AI Generated
                  </span>
                </div>
              )}

              <OutfitLikeButton outfitId={outfit.id} />
            </div>
          </div>

          {/* Right: Outfit Info + Items */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] px-6 md:px-10 py-8 md:py-12 flex flex-col">
            {/* Header */}
            <div className="mb-8 md:mb-10">
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3 capitalize">
                {outfit.occasion} · {outfit.season !== "all" ? outfit.season : "All Season"}
              </p>
              {/* One line each, chevron for the rest: outfit names and blurbs are
                  generated from the pieces, so they run long and would otherwise
                  push the bag button and the piece list off the screen. */}
              <div className="mb-4">
                <ClampedHeading
                  text={heading}
                  label="outfit name"
                  lines={1}
                  className="text-3xl md:text-4xl font-bold uppercase text-[var(--foreground)] leading-tight"
                />
              </div>
              <ClampedDescription text={outfit.description || seoDescription} lines={1} />

              <div className="mt-6 flex items-center gap-6">
                <div>
                  <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">
                    Total
                  </p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    <Price amount={outfit.totalPriceMin} />
                    <span className="text-base text-[var(--foreground-muted)]">
                      {" "}
                      — <Price amount={outfit.totalPriceMax} />
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">
                    Pieces
                  </p>
                  <p className="text-2xl font-bold text-[var(--foreground)]">
                    {outfit.items.length}
                  </p>
                </div>
              </div>
            </div>

            {/* Style tags */}
            <div className="flex flex-wrap gap-2 mb-10">
              {outfit.styleKeywords.map((kw) => (
                <span
                  key={kw}
                  className="text-[9px] tracking-[0.16em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] px-3 py-1.5 rounded-full capitalize"
                >
                  {kw}
                </span>
              ))}
            </div>

            {/* Actions */}
            <OutfitActions outfitId={outfit.id} items={outfit.items} />

            {/* Items in outfit */}
            <OutfitPieces items={outfit.items} />
          </div>
        </div>

        {/* Related Outfits */}
        {relatedOutfits.length > 0 && (
          <section className="mt-20 md:mt-28">
            <div className="mb-8">
              <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
                Similar Outfits
              </p>
              <h2 className="text-2xl md:text-3xl font-bold uppercase text-[var(--foreground)]">
                You might also like
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedOutfits.map((related) => (
                <div key={related.id} className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200">
                  <OutfitCard outfit={related} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recently viewed — last, and only if this browser has a history */}
        <RecentlyViewed kind="outfit" currentId={outfit.id} />
      </div>
    </div>
  );
}
