import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
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
import { outfitStylePath } from "@/lib/landing-paths";
import { seasonsLabel } from "@/lib/seasons";
import { genderLabel, outfitGenderOf } from "@/lib/outfit-gender";
import { outfitKind, outfitKindLabel } from "@/lib/outfit-kind";
import { styleLabel } from "@/lib/style-keywords";
import Price from "@/components/ui/Price";
import JsonLd from "@/components/seo/JsonLd";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  fittedTitle,
  breadcrumbJsonLd,
  buildOutfitSeo,
  outfitDisplayName,
  outfitJsonLd,
} from "@/lib/seo";

// Cached and regenerated at most every five minutes, like a product page: it
// was rendered from the database on every visit. An empty list prerenders none
// at build time and caches each outfit on its first visit.
export const revalidate = 300;
export async function generateStaticParams(): Promise<{ id: string }[]> {
  return [];
}

interface Props {
  params: Promise<{ id: string }>;
}

// generateMetadata and the page both need the outfit; one request reads it once.
const loadOutfit = cache((id: string) => getOutfitById(id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const outfit = await loadOutfit(id);
  if (!outfit) return {};

  // The outfit's own name with its piece count and price; its own description,
  // or a sentence from its brands when it has none (lib/seo).
  const { title, description } = buildOutfitSeo(outfit);

  return {
    title: fittedTitle(title),
    description,
    alternates: { canonical: `${SITE_URL}/outfit/${id}` },
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      url: `${SITE_URL}/outfit/${id}`,
      type: "website",
      images: outfit.imageUrl ? [{ url: outfit.imageUrl, alt: outfitDisplayName(outfit) }] : [DEFAULT_OG_IMAGE],
    },
  };
}

export default async function OutfitDetailPage({ params }: Props) {
  const { id } = await params;
  const outfit = await loadOutfit(id);

  if (!outfit) notFound();

  // The four newest sharing a style with this one — asked for as such, not
  // picked out of every outfit on the site. Styles took over from the
  // occasion, which this row used to match on (CEO, 2026-10-27).
  const relatedOutfits = await getLatestOutfits({
    limit: 4,
    styles: outfit.styleKeywords,
    excludeId: outfit.id,
  });

  // The name and description the studio has for it, word for word.
  const heading = outfitDisplayName(outfit);
  const description = outfit.description.trim();
  // Home / Browse / Outfits / Style / AI / Name — the optional steps drop
  // out when the outfit doesn't carry them, and each links back into the
  // catalog with that filter applied.
  const q = (params: Record<string, string>) =>
    `/browse?${new URLSearchParams({ view: "outfits", ...params })}`;
  const outfitCrumbs: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Browse", href: "/browse" },
    { label: "Outfits", href: q({}) },
  ];
  const style = outfit.styleKeywords[0];
  if (style) outfitCrumbs.push({ label: styleLabel(style), href: q({ style }) });
  if (outfit.isAIGenerated) outfitCrumbs.push({ label: "AI", href: q({ ai: "1" }) });
  outfitCrumbs.push({ label: heading });

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", url: SITE_URL },
    { name: "Outfits", url: absoluteUrl("/browse?view=outfits") },
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
                  alt={outfitDisplayName(outfit)}
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
              {/* Who put it together, as on its card (lib/outfit-kind). */}
              <div className="absolute top-3.5 left-3.5 md:top-4 md:left-4">
                <span
                  data-outfit-kind={outfitKind(outfit)}
                  className="block rounded-full bg-white/80 md:bg-black/60 md:backdrop-blur-sm text-black md:text-white text-[11px] md:text-[9px] font-semibold md:font-medium md:tracking-[0.16em] md:uppercase px-[9px] py-1 md:px-3 md:py-1.5"
                >
                  {outfitKindLabel(outfitKind(outfit))}
                </span>
              </div>

              <OutfitLikeButton outfitId={outfit.id} />
            </div>
          </div>

          {/* Right: Outfit Info + Items */}
          <div className="md:rounded-2xl md:border md:border-[var(--border)] md:bg-[var(--background)] px-1 md:px-10 md:py-12 flex flex-col">
            {/* Header */}
            <div className="mb-3 md:mb-10">
              <p className="text-[13px] md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium text-[var(--foreground-muted)] md:text-[var(--foreground-subtle)] mb-1 md:mb-3">
                {genderLabel(outfitGenderOf(outfit))} · {seasonsLabel(outfit.seasons)}
              </p>
              {/* One line each, chevron for the rest: outfit names and blurbs can
                  run long and would otherwise push the bag button and the piece
                  list off the screen. Phones show the whole name — the bag
                  button lives in the bar there. Desktop's −0.015em is spelled
                  out: any tracking class turns off the size-based rule in
                  globals.css (DESIGN_SYSTEM.md §12.13). */}
              <div className="mb-2 md:mb-4">
                <ClampedHeading
                  text={heading}
                  money
                  label="outfit name"
                  lines={1}
                  className="max-md:line-clamp-none text-[22px] md:text-4xl font-semibold md:font-bold md:uppercase tracking-[-0.01em] md:tracking-[-0.015em] text-[var(--foreground)] leading-tight"
                />
              </div>
              {/* Prices in the words follow the reader's currency (MoneyText).
                  No description, no paragraph: one made up from the brands
                  read as the studio's words when they were not (CEO, 2026-10-29). */}
              {description && (
                <ClampedDescription text={description} money lines={1} className="max-md:line-clamp-none" />
              )}

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

            {/* Style tags — each leads to that style's outfit ideas */}
            <div className="flex flex-wrap gap-1.5 md:gap-2 mb-5 md:mb-10">
              {outfit.styleKeywords.map((kw) => (
                <Link
                  key={kw}
                  href={outfitStylePath(kw)}
                  className="max-md:relative max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-2 inline-flex md:inline items-center h-7 md:h-auto px-3 md:py-1.5 rounded-full bg-[var(--fg-overlay-08)] md:bg-transparent md:border md:border-[var(--border)] text-[12px] md:text-[9px] md:tracking-[0.16em] md:uppercase text-[var(--foreground)] md:text-[var(--foreground-muted)] md:hover:text-[var(--foreground)] md:hover:border-[var(--foreground-muted)] capitalize transition-colors duration-200"
                >
                  {kw}
                </Link>
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
