// ISR: serve a cached page, regenerate at most once a minute — homepage
// content (outfits, featured looks) doesn't change in real time.
export const revalidate = 60;

import Link from "next/link";
import FadeInView from "@/components/ui/FadeInView";
import { HeroSection } from "@/components/home/HeroSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import FeaturesBento from "@/components/home/FeaturesBento";
import OutfitExamplesCarousel from "@/components/home/OutfitExamplesCarousel";
import { getAllOutfits, getFeaturedOutfits } from "@/lib/data/db";
import JsonLd from "@/components/seo/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

// ── DATA ─────────────────────────────────────────────────────────────────────

async function getData() {
  const [allOutfits, featuredForBento] = await Promise.all([
    getAllOutfits(),
    getFeaturedOutfits(),
  ]);
  return {
    allOutfits,
    bentoFeaturedOutfits: featuredForBento,
  };
}

// ── LAYOUT PRIMITIVES ────────────────────────────────────────────────────────

function Section({
  children,
  soft,
  className = "",
}: {
  children: React.ReactNode;
  soft?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`py-24 md:py-32 ${soft ? "bg-[var(--surface)]" : "bg-[var(--background)]"} ${className}`}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">{children}</div>
    </section>
  );
}

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
  const { allOutfits, bentoFeaturedOutfits } = await getData();

  // Outfit examples: up to 9 so carousel has 3 full pages
  const carouselOutfits = allOutfits.slice(0, 9);

  return (
    <>
      {/* Structured data: Organization + WebSite (with sitelinks SearchAction) */}
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />

      {/* ── HERO ── */}
      <HeroSection />

      {/* ── HOW IT WORKS ── */}
      <HowItWorksSection />

      {/* ── FEATURES BENTO ── */}
      <Section>
        <FadeInView>
          <Kicker>Features</Kicker>
          <SectionH2>Real outfits, ready to shop.</SectionH2>
        </FadeInView>
        <FeaturesBento outfits={bentoFeaturedOutfits} />
      </Section>

      {/* ── OUTFIT EXAMPLES ── */}
      <Section>
        <FadeInView className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
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
      </Section>

    </>
  );
}
