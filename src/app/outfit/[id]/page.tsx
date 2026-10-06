import type { Metadata } from "next";
import { cache } from "react";
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
import { getOutfitById, getLatestOutfits } from "@/lib/data/db";
import Price from "@/components/ui/Price";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL, absoluteUrl, buildOutfitSeo, outfitJsonLd, breadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ id: string }>;
}

// generateMetadata and the page both need the outfit; one request reads it once.
const loadOutfit = cache((id: string) => getOutfitById(id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const outfit = await loadOutfit(id);
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
  const outfit = await loadOutfit(id);

  if (!outfit) notFound();

  // The four newest of the same occasion — asked for as such, not picked out
  // of every outfit on the site.
  const relatedOutfits = await getLatestOutfits({
    limit: 4,
    occasion: outfit.occasion,
    excludeId: outfit.id,
  });

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
      <div className="max-w-[1440px] mx-auto px-3 md:px-12">
        <RecordRecentView kind="outfit" id={outfit.id} />

        {/* Phones go back with the header's back button; the trail is desktop's. */}
        <div className="hidden md:block">
          <Breadcrumbs items={outfitCrumbs} />
        </div>

        {/* Main layout — same column sizing as the product page, so the image
            keeps a sane width and the info panel takes the rest. */}
        <div className="mt-3 md:mt-12 grid grid-cols-1 md:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)] gap-4 md:gap-10">
          {/* Left: Editorial Image — on phones a borderless card (DESIGN_SYSTEM.md §12.2) */}
          <div className="rounded-3xl md:rounded-2xl overflow-hidden md:border md:border-[var(--border)] bg-[var(--background)] md:self-start">
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
                <div className="absolute top-3.5 left-3.5 md:top-4 md:left-4">
                  <span className="block rounded-full bg-white/80 md:bg-black/60 md:backdrop-blur-sm text-black md:text-white text-[11px] md:text-[9px] font-semibold md:font-medium md:tracking-[0.16em] md:uppercase px-[9px] py-1 md:px-3 md:py-1.5">
                    AI Generated
                  </span>
                </div>
              )}

              <OutfitLikeButton outfitId={outfit.id} />
            </div>
          </div>

          {/* Right: Outfit Info + Items */}
          <div className="md:rounded-2xl md:border md:border-[var(--border)] md:bg-[var(--background)] px-1 md:px-10 md:py-12 flex flex-col">
            {/* Header */}
            <div className="mb-3 md:mb-10">
              <p className="text-[13px] md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mb-1 md:mb-3 capitalize">
                {outfit.occasion} · {outfit.season !== "all" ? outfit.season : "All Season"}
              </p>
              {/* One line each, chevron for the rest: outfit names and blurbs are
                  generated from the pieces, so they run long and would otherwise
                  push the bag button and the piece list off the screen. Phones
                  show the whole name — the bag button lives in the bar there.
                  Desktop's −0.015em is spelled out: any tracking class turns off
                  the size-based rule in globals.css (DESIGN_SYSTEM.md §12.13). */}
              <div className="mb-2 md:mb-4">
                <ClampedHeading
                  text={heading}
                  label="outfit name"
                  lines={1}
                  className="max-md:line-clamp-none text-[22px] md:text-4xl font-semibold md:font-bold md:uppercase tracking-[-0.01em] md:tracking-[-0.015em] text-[var(--foreground)] leading-tight"
                />
              </div>
              <ClampedDescription text={outfit.description || seoDescription} lines={1} className="max-md:line-clamp-none" />

              {/* Total and count — phones read them in the buy bar */}
              <div className="mt-6 hidden md:flex items-center gap-6">
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
            <div className="flex flex-wrap gap-1.5 md:gap-2 mb-5 md:mb-10">
              {outfit.styleKeywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex md:inline items-center h-7 md:h-auto px-3 md:py-1.5 rounded-full bg-[var(--fg-overlay-08)] md:bg-transparent md:border md:border-[var(--border)] text-[12px] md:text-[9px] md:tracking-[0.16em] md:uppercase text-[var(--foreground)] md:text-[var(--foreground-muted)] capitalize"
                >
                  {kw}
                </span>
              ))}
            </div>

            {/* Actions */}
            <OutfitActions outfitId={outfit.id} items={outfit.items} priceMin={outfit.totalPriceMin} priceMax={outfit.totalPriceMax} />

            {/* Items in outfit */}
            <OutfitPieces items={outfit.items} />
          </div>
        </div>

        {/* Related Outfits */}
        {relatedOutfits.length > 0 && (
          <section className="mt-10 md:mt-28">
            <div className="mb-3 md:mb-8">
              <p className="text-[13px] md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mb-1 md:mb-3">
                Similar outfits
              </p>
              <h2 className="text-[20px] md:text-3xl font-semibold md:font-bold md:uppercase max-md:tracking-[-0.01em] text-[var(--foreground)]">
                You might also like
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-4">
              {relatedOutfits.map((related) => (
                <div key={related.id} className="rounded-xl bg-[var(--background)] hover:shadow-md transition-colors duration-200">
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
