// ISR: serve a cached page, regenerate at most once a minute — homepage
// content (outfits, featured looks) doesn't change in real time.
export const revalidate = 60;

import Link from "next/link";
import FadeInView from "@/components/ui/FadeInView";
import { HeroSection } from "@/components/home/HeroSection";
import HomeSection from "@/components/home/HomeSection";
import HomeFullPageScroll from "@/components/home/HomeFullPageScroll";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import AIStylistShowcase, {
  FeaturedProductShowcase,
} from "@/components/home/AIStylistShowcase";
import OutfitExamplesCarousel from "@/components/home/OutfitExamplesCarousel";
import {
  getAllOutfits,
  getHomepageShowcase,
  getHomepageStylist,
} from "@/lib/data/db";
import JsonLd from "@/components/seo/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

// ── DATA ─────────────────────────────────────────────────────────────────────

async function getData() {
  const [allOutfits, showcase, stylist] = await Promise.all([
    getAllOutfits(),
    getHomepageShowcase(),
    getHomepageStylist(),
  ]);
  return {
    allOutfits,
    showcase,
    stylist,
  };
}

// ── LAYOUT PRIMITIVES ────────────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    // Phones: a 13px muted eyebrow in sentence case (DESIGN_SYSTEM.md §12.13).
    <p className="text-[11px] tracking-[0.22em] uppercase font-medium mb-2.5 md:mb-4 text-[var(--foreground-subtle)] max-md:text-[13px] max-md:tracking-normal max-md:normal-case max-md:font-normal max-md:text-[var(--foreground-muted)] max-md:mb-1.5">
      {children}
    </p>
  );
}

function SectionH2({
  children,
  centered,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <h2
      className={`text-[30px] sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.04] text-[var(--foreground)] max-md:text-[26px] max-md:font-semibold max-md:tracking-[-0.02em] max-md:leading-[1.15] ${
        centered ? "text-center" : ""
      }`}
    >
      {children}
    </h2>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { allOutfits, showcase, stylist } = await getData();

  // Outfit examples: up to 9 so carousel has 3 full pages. The outfits an admin
  // starred ("Feature on homepage" in the studio) when there are any, newest
  // first; otherwise the newest outfits.
  const featuredOutfits = allOutfits.filter((o) => o.isHomepageFeatured);
  const carouselOutfits = (featuredOutfits.length > 0 ? featuredOutfits : allOutfits).slice(0, 9);

  return (
    <>
      {/* Structured data: Organization + WebSite (with sitelinks SearchAction) */}
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />

      {/* On wide screens, one wheel notch / swipe / arrow key moves to the next
          section below; phones and tablets scroll normally. */}
      <HomeFullPageScroll />

      {/* ── HERO ── */}
      <HeroSection />

      {/* ── HOW IT WORKS ── */}
      {/* Phones follow the theme (mockup v2 «Б · Главная, продолжение»); from md
          the section keeps its fixed dark stage. */}
      <HomeSection className="bg-[var(--background)] md:bg-[#050505]">
        <HowItWorksSection showcase={showcase} />
      </HomeSection>

      {/* ── AI STYLIST SHOWCASE ── */}
      <HomeSection className="bg-[var(--background)]">
        <AIStylistShowcase
          chatLooks={stylist.chatLooks}
          featuredProduct={stylist.featuredProduct}
          retailerLogos={stylist.retailerLogos}
          showcaseStores={stylist.showcaseStores}
        />
      </HomeSection>

      {/* ── FEATURED ITEM ──
          Its own screen on phones, where it can't share one with the stylist
          chat. Wide layouts keep it inside the stylist section above. */}
      {stylist.featuredProduct && (
        <div className="lg:hidden">
          <HomeSection className="bg-[var(--background)]">
            <FeaturedProductShowcase
              product={stylist.featuredProduct}
              retailerLogos={stylist.retailerLogos}
              showcaseStores={stylist.showcaseStores}
            />
          </HomeSection>
        </div>
      )}

      {/* ── OUTFIT EXAMPLES ── */}
      <HomeSection className="bg-[var(--background)]">
        <section className="py-4 md:py-12">
          <div className="max-w-[1280px] mx-auto px-4 md:px-12">
            <FadeInView className="flex flex-col md:flex-row md:items-end justify-between mb-6 md:mb-8 gap-3 md:gap-4 max-md:flex-row max-md:items-end max-md:mb-3.5">
              <div className="max-md:max-w-[250px]">
                <Kicker>Outfit examples</Kicker>
                <SectionH2>Explore ready-made outfit ideas.</SectionH2>
              </div>
              <Link
                href="/browse"
                className="self-end md:self-auto text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-4 shrink-0 max-md:h-11 max-md:flex max-md:items-center max-md:text-[14px] max-md:text-[var(--foreground)] max-md:no-underline"
              >
                <span className="md:hidden">All outfits</span>
                <span className="hidden md:inline">Browse all outfits</span>
              </Link>
            </FadeInView>
            {carouselOutfits.length > 0 ? (
              <OutfitExamplesCarousel outfits={carouselOutfits} />
            ) : (
              <div className="py-20 text-center text-[var(--foreground-muted)] text-sm">
                No outfits yet —{" "}
                <Link href="/builder" className="underline">
                  be the first to build one.
                </Link>
              </div>
            )}
          </div>
        </section>
      </HomeSection>

    </>
  );
}
