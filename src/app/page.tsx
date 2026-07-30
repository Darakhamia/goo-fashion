// ISR: serve a cached page, regenerate at most once a minute — homepage
// content (outfits, featured looks) doesn't change in real time.
export const revalidate = 60;

import Link from "next/link";
import FadeInView from "@/components/ui/FadeInView";
import { HeroSection } from "@/components/home/HeroSection";
import HomeSection from "@/components/home/HomeSection";
import HomeFullPageScroll from "@/components/home/HomeFullPageScroll";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import AIStylistShowcase from "@/components/home/AIStylistShowcase";
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
    <p className="text-[11px] tracking-[0.22em] uppercase font-medium mb-4 text-[var(--foreground-subtle)]">
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
      className={`text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.04] text-[var(--foreground)] ${
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

  // Outfit examples: up to 9 so carousel has 3 full pages
  const carouselOutfits = allOutfits.slice(0, 9);

  return (
    <>
      {/* Structured data: Organization + WebSite (with sitelinks SearchAction) */}
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />

      {/* One wheel notch / swipe / arrow key moves to the next section below. */}
      <HomeFullPageScroll />

      {/* ── HERO ── */}
      <HeroSection />

      {/* ── HOW IT WORKS ── */}
      <HomeSection className="bg-[#050505]">
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

      {/* ── OUTFIT EXAMPLES ── */}
      <HomeSection className="bg-[var(--background)]">
        <section className="py-10 md:py-12">
          <div className="max-w-[1280px] mx-auto px-6 md:px-12">
            <FadeInView className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
              <div>
                <Kicker>Outfit examples</Kicker>
                <SectionH2>Explore ready-made outfit ideas.</SectionH2>
              </div>
              <Link
                href="/browse"
                className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-4 shrink-0"
              >
                Browse all outfits
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
